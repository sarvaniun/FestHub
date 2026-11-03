-- =====================================================================
-- FestHub Stage 3 – #20 Registrations: trigger + procedures + transaction
--   Linux:    sudo mysql FestHub_1 < sql/20_registrations.sql
--   Windows:  mysql -u root -p FestHub_1 < sql\20_registrations.sql   (Command Prompt)
-- =====================================================================
-- What this file adds
--   1. trg_registration_type_check   BEFORE INSERT/UPDATE trigger:
--      an Individual event only takes individual registrations, a Team
--      event only takes team registrations.
--   2. RegisterParticipant(event, participant)  procedure
--   3. RegisterTeam(event, team)                procedure
--      Both run ONE TRANSACTION:
--        START TRANSACTION
--        SELECT ... FROM EVENT ... FOR UPDATE   ← locks this event's row
--   (the other lookups use  SET v = (SELECT ...)  : a scalar subquery
--    gives NULL instead of a "no data" warning when no row matches)
--        count the seats already taken
--        if full → SIGNAL (error) → ROLLBACK
--        else     → INSERT the registration  → COMMIT
--   4. sp_cancel_registration(registration)     procedure
--
-- WHY the transaction + FOR UPDATE?  The "last seat" race.
--   Two students click Register at the same moment for the last seat.
--   Without a lock, both read "1 seat left", both insert → overbooked.
--   FOR UPDATE makes the second transaction WAIT at the SELECT until the
--   first one commits; it then counts again, sees 0 seats, and is refused.
--
-- Duplicates are already blocked by the UNIQUE keys from Stage 2:
--   uq_reg_event_participant (Event_ID, Participant_ID)
--   uq_reg_event_team        (Event_ID, Team_ID)
-- so the old prevent_duplicate_participant_registration trigger is not
-- needed (it also wrongly blocked re-registering after a cancellation).
-- =====================================================================

DROP TRIGGER IF EXISTS prevent_duplicate_participant_registration;
DROP TRIGGER IF EXISTS trg_registration_type_check;
DROP TRIGGER IF EXISTS trg_registration_type_check_update;
DROP PROCEDURE IF EXISTS RegisterParticipant;
DROP PROCEDURE IF EXISTS RegisterTeam;
DROP PROCEDURE IF EXISTS sp_cancel_registration;

DELIMITER //

-- ---------------------------------------------------------------------
-- 1. Registration type must match the event type
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_registration_type_check
BEFORE INSERT ON REGISTRATION
FOR EACH ROW
BEGIN
    DECLARE v_is_team BOOLEAN;

    -- TRUE for a Team event, FALSE for an Individual event
    SET v_is_team = (SELECT Event_Type = 'Team' FROM EVENT WHERE Event_ID = NEW.Event_ID);

    IF NOT v_is_team AND NEW.Team_ID IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This is an individual event: register yourself, not a team';
    END IF;

    IF v_is_team AND NEW.Participant_ID IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This is a team event: register a team, not an individual';
    END IF;
END //

CREATE TRIGGER trg_registration_type_check_update
BEFORE UPDATE ON REGISTRATION
FOR EACH ROW
BEGIN
    DECLARE v_is_team BOOLEAN;

    -- Only re-check when the event or the registrant changed
    -- (<=> is NULL-safe equality: NULL <=> NULL is TRUE)
    IF NEW.Event_ID <> OLD.Event_ID
       OR NOT (NEW.Participant_ID <=> OLD.Participant_ID)
       OR NOT (NEW.Team_ID <=> OLD.Team_ID) THEN

        SET v_is_team = (SELECT Event_Type = 'Team' FROM EVENT WHERE Event_ID = NEW.Event_ID);

        IF (NOT v_is_team AND NEW.Team_ID IS NOT NULL)
           OR (v_is_team AND NEW.Participant_ID IS NOT NULL) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Registration type does not match the event type';
        END IF;
    END IF;
END //

-- ---------------------------------------------------------------------
-- 2. RegisterParticipant: individual registration inside a transaction
--    CALL RegisterParticipant(1, 4);   → returns the new Registration_ID
-- ---------------------------------------------------------------------
CREATE PROCEDURE RegisterParticipant(
    IN p_event_id       INT,
    IN p_participant_id INT
)
BEGIN
    DECLARE v_capacity INT;
    DECLARE v_taken    INT;
    DECLARE v_existing INT;

    -- On ANY error: undo everything, then pass the same error to the app.
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Lock this event's row until COMMIT/ROLLBACK. A second session
    -- registering for the SAME event waits here.
    SELECT v.Capacity INTO v_capacity
    FROM EVENT e
    JOIN VENUE v ON v.Venue_ID = e.Venue_ID
    WHERE e.Event_ID = p_event_id
    FOR UPDATE;

    IF v_capacity IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Event not found';
    END IF;

    -- Seats taken: 1 per individual, 1 per member of a registered team.
    SET v_taken = (
        SELECT CAST(COALESCE(SUM(CASE
                      WHEN r.Participant_ID IS NOT NULL THEN 1
                      ELSE (SELECT COUNT(*) FROM TEAM_MEMBER tm WHERE tm.Team_ID = r.Team_ID)
                    END), 0) AS SIGNED)
        FROM REGISTRATION r
        WHERE r.Event_ID = p_event_id AND r.Status <> 'Cancelled'
    );

    IF v_taken + 1 > v_capacity THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sorry, this event is full';
    END IF;

    -- A cancelled registration can be re-activated instead of inserting a
    -- second row (the UNIQUE key allows only one row per student+event).
    SET v_existing = (
        SELECT Registration_ID
        FROM REGISTRATION
        WHERE Event_ID = p_event_id AND Participant_ID = p_participant_id AND Status = 'Cancelled'
        LIMIT 1
    );

    IF v_existing IS NOT NULL THEN
        UPDATE REGISTRATION
        SET Status = 'Pending', Registration_Time = NOW()
        WHERE Registration_ID = v_existing;
    ELSE
        INSERT INTO REGISTRATION (Event_ID, Participant_ID, Team_ID, Registration_Time, Status)
        VALUES (p_event_id, p_participant_id, NULL, NOW(), 'Pending');
        SET v_existing = LAST_INSERT_ID();
    END IF;

    COMMIT;

    SELECT v_existing AS Registration_ID;
END //

-- ---------------------------------------------------------------------
-- 3. RegisterTeam: the whole team takes (members) seats
--    CALL RegisterTeam(2, 1);
-- The composite FK (Team_ID, Event_ID) → TEAM rejects a team that was
-- formed for a different event.
-- ---------------------------------------------------------------------
CREATE PROCEDURE RegisterTeam(
    IN p_event_id INT,
    IN p_team_id  INT
)
BEGIN
    DECLARE v_capacity INT;
    DECLARE v_taken    INT;
    DECLARE v_members  INT;
    DECLARE v_existing INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT v.Capacity INTO v_capacity
    FROM EVENT e
    JOIN VENUE v ON v.Venue_ID = e.Venue_ID
    WHERE e.Event_ID = p_event_id
    FOR UPDATE;

    IF v_capacity IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Event not found';
    END IF;

    SET v_members = (SELECT COUNT(*) FROM TEAM_MEMBER WHERE Team_ID = p_team_id);

    IF v_members = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The team has no members yet';
    END IF;

    SET v_taken = (
        SELECT CAST(COALESCE(SUM(CASE
                      WHEN r.Participant_ID IS NOT NULL THEN 1
                      ELSE (SELECT COUNT(*) FROM TEAM_MEMBER tm WHERE tm.Team_ID = r.Team_ID)
                    END), 0) AS SIGNED)
        FROM REGISTRATION r
        WHERE r.Event_ID = p_event_id AND r.Status <> 'Cancelled'
    );

    IF v_taken + v_members > v_capacity THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sorry, not enough seats left for the whole team';
    END IF;

    SET v_existing = (
        SELECT Registration_ID
        FROM REGISTRATION
        WHERE Event_ID = p_event_id AND Team_ID = p_team_id AND Status = 'Cancelled'
        LIMIT 1
    );

    IF v_existing IS NOT NULL THEN
        UPDATE REGISTRATION
        SET Status = 'Pending', Registration_Time = NOW()
        WHERE Registration_ID = v_existing;
    ELSE
        INSERT INTO REGISTRATION (Event_ID, Participant_ID, Team_ID, Registration_Time, Status)
        VALUES (p_event_id, NULL, p_team_id, NOW(), 'Pending');
        SET v_existing = LAST_INSERT_ID();
    END IF;

    COMMIT;

    SELECT v_existing AS Registration_ID;
END //

-- ---------------------------------------------------------------------
-- 4. sp_cancel_registration: soft delete (keep the row, set Cancelled)
--    Keeping the row keeps the history (and its scores, if any).
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_cancel_registration(IN p_registration_id INT)
BEGIN
    DECLARE v_status VARCHAR(20);

    SET v_status = (
        SELECT Status FROM REGISTRATION WHERE Registration_ID = p_registration_id
    );

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registration not found';
    END IF;

    IF v_status = 'Cancelled' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This registration is already cancelled';
    END IF;

    UPDATE REGISTRATION SET Status = 'Cancelled' WHERE Registration_ID = p_registration_id;

    SELECT p_registration_id AS Registration_ID, 'Cancelled' AS Status;
END //

DELIMITER ;

SHOW TRIGGERS WHERE `Table` = 'REGISTRATION';
SHOW PROCEDURE STATUS WHERE Db = DATABASE();

-- ---------------------------------------------------------------------
-- Screenshot tests (seed data: event 1 = Coding Contest (Individual),
-- event 2 = Hackathon (Team), participant 4 = Sneha, 7 = Meera)
-- ---------------------------------------------------------------------
-- a) Allowed:            CALL RegisterParticipant(1, 7);
-- b) Duplicate rejected: CALL RegisterParticipant(1, 7);
--      → ERROR 1062: Duplicate entry '1-7' for key ... uq_reg_event_participant
-- c) Wrong type:         CALL RegisterParticipant(2, 7);
--      → ERROR 1644: This is a team event: register a team, not an individual
-- d) Cancel:             CALL sp_cancel_registration(<id from a>);
--
-- e) The last-seat race (Quiz Room 404 has 10 seats; Tech Quiz = event 3):
--    First fill it to 9 seats, then open TWO terminals (two sessions):
--      Session 1:  START TRANSACTION;
--                  SELECT * FROM EVENT WHERE Event_ID = 3 FOR UPDATE;   -- holds the lock
--      Session 2:  CALL RegisterParticipant(3, 20);                     -- WAITS here
--      Session 1:  COMMIT;                                              -- session 2 continues
--    Or simply run CALL RegisterParticipant(3, x) in both terminals at once:
--    one succeeds, the other gets "Sorry, this event is full".
