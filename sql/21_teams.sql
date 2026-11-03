
-- =====================================================================
-- FestHub Stage 3 - #21 Team Management
--   Team size limit: 5 members
--   A participant can belong to only one team per event
--   Prevent individual + team registration conflicts
--   AddParticipantToTeam stored procedure
-- =====================================================================

USE FestHub_1;

-- ---------------------------------------------------------------------
-- Drop existing #21 triggers before recreating them
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_team_member_max_size;
DROP TRIGGER IF EXISTS trg_team_member_one_team_per_event;
DROP TRIGGER IF EXISTS trg_team_member_validate_insert;

DROP TRIGGER IF EXISTS trg_registration_no_individual_team_conflict;
DROP TRIGGER IF EXISTS trg_registration_no_individual_team_conflict_update;

DROP PROCEDURE IF EXISTS AddParticipantToTeam;

DELIMITER //

-- =====================================================================
-- 1. Validate team membership before inserting
-- =====================================================================

CREATE TRIGGER trg_team_member_validate_insert
BEFORE INSERT ON TEAM_MEMBER
FOR EACH ROW
BEGIN
    DECLARE v_event_id INT DEFAULT NULL;
    DECLARE v_locked_event_id INT DEFAULT NULL;
    DECLARE v_member_count INT DEFAULT 0;
    DECLARE v_existing_count INT DEFAULT 0;

    -- Obtain and lock the parent team row.
    SELECT Event_ID
    INTO v_event_id
    FROM TEAM
    WHERE Team_ID = NEW.Team_ID
    FOR UPDATE;

    IF v_event_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Team not found';
    END IF;

    -- Lock the event row to serialize membership changes
    -- across different teams belonging to the same event.
    SELECT Event_ID
    INTO v_locked_event_id
    FROM EVENT
    WHERE Event_ID = v_event_id
    FOR UPDATE;

    -- Enforce the maximum of five members.
    SELECT COUNT(*)
    INTO v_member_count
    FROM TEAM_MEMBER
    WHERE Team_ID = NEW.Team_ID;

    IF v_member_count >= 5 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Maximum team size of 5 members exceeded';
    END IF;

    -- Enforce one team per participant for this event.
    SELECT COUNT(*)
    INTO v_existing_count
    FROM TEAM_MEMBER tm
    JOIN TEAM t
        ON t.Team_ID = tm.Team_ID
    WHERE tm.Participant_ID = NEW.Participant_ID
      AND t.Event_ID = v_event_id;

    IF v_existing_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Participant is already in a team for this event';
    END IF;
END //


-- =====================================================================
-- 2. Prevent individual + team registration conflicts on INSERT
-- =====================================================================

CREATE TRIGGER trg_registration_no_individual_team_conflict
BEFORE INSERT ON REGISTRATION
FOR EACH ROW
BEGIN
    DECLARE v_conflict_count INT DEFAULT 0;
    DECLARE v_locked_event_id INT DEFAULT NULL;

    IF NEW.Status <> 'Cancelled' THEN

        -- Serialize registration conflict checks for this event.
        SELECT Event_ID
        INTO v_locked_event_id
        FROM EVENT
        WHERE Event_ID = NEW.Event_ID
        FOR UPDATE;

        -- Team registration conflicts with an active individual
        -- registration by any member of the team.
        IF NEW.Team_ID IS NOT NULL THEN

            SELECT COUNT(*)
            INTO v_conflict_count
            FROM TEAM_MEMBER tm
            JOIN REGISTRATION r
                ON r.Participant_ID = tm.Participant_ID
            WHERE tm.Team_ID = NEW.Team_ID
              AND r.Event_ID = NEW.Event_ID
              AND r.Status <> 'Cancelled';

            IF v_conflict_count > 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT =
                    'Participant already has an active individual registration for this event';
            END IF;

        -- Individual registration conflicts with an active
        -- team registration containing that participant.
        ELSEIF NEW.Participant_ID IS NOT NULL THEN

            SELECT COUNT(*)
            INTO v_conflict_count
            FROM TEAM_MEMBER tm
            JOIN REGISTRATION r
                ON r.Team_ID = tm.Team_ID
            WHERE tm.Participant_ID = NEW.Participant_ID
              AND r.Event_ID = NEW.Event_ID
              AND r.Status <> 'Cancelled';

            IF v_conflict_count > 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT =
                    'Participant already has an active team registration for this event';
            END IF;

        END IF;
    END IF;
END //


-- =====================================================================
-- 3. Prevent individual + team registration conflicts on UPDATE
--    This also handles reactivation of cancelled registrations.
-- =====================================================================

CREATE TRIGGER trg_registration_no_individual_team_conflict_update
BEFORE UPDATE ON REGISTRATION
FOR EACH ROW
BEGIN
    DECLARE v_conflict_count INT DEFAULT 0;
    DECLARE v_locked_event_id INT DEFAULT NULL;

    IF NEW.Status <> 'Cancelled' THEN

        -- Serialize registration conflict checks for this event.
        SELECT Event_ID
        INTO v_locked_event_id
        FROM EVENT
        WHERE Event_ID = NEW.Event_ID
        FOR UPDATE;

        -- Team registration conflicts with an active individual
        -- registration by any member of the team.
        IF NEW.Team_ID IS NOT NULL THEN

            SELECT COUNT(*)
            INTO v_conflict_count
            FROM TEAM_MEMBER tm
            JOIN REGISTRATION r
                ON r.Participant_ID = tm.Participant_ID
            WHERE tm.Team_ID = NEW.Team_ID
              AND r.Event_ID = NEW.Event_ID
              AND r.Status <> 'Cancelled'
              AND r.Registration_ID <> OLD.Registration_ID;

            IF v_conflict_count > 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT =
                    'Participant already has an active individual registration for this event';
            END IF;

        -- Individual registration conflicts with an active
        -- team registration containing that participant.
        ELSEIF NEW.Participant_ID IS NOT NULL THEN

            SELECT COUNT(*)
            INTO v_conflict_count
            FROM TEAM_MEMBER tm
            JOIN REGISTRATION r
                ON r.Team_ID = tm.Team_ID
            WHERE tm.Participant_ID = NEW.Participant_ID
              AND r.Event_ID = NEW.Event_ID
              AND r.Status <> 'Cancelled'
              AND r.Registration_ID <> OLD.Registration_ID;

            IF v_conflict_count > 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT =
                    'Participant already has an active team registration for this event';
            END IF;

        END IF;
    END IF;
END //


-- =====================================================================
-- 4. AddParticipantToTeam stored procedure
--    Adds a participant to a team.
--    The membership trigger enforces the team rules.
-- =====================================================================

CREATE PROCEDURE AddParticipantToTeam(
    IN p_team_id INT,
    IN p_participant_id INT
)
BEGIN
    DECLARE v_event_id INT DEFAULT NULL;
    DECLARE v_locked_event_id INT DEFAULT NULL;
    DECLARE v_participant_exists INT DEFAULT 0;

    -- Roll back the transaction if any SQL error occurs.
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Obtain and lock the team.
    SELECT Event_ID
    INTO v_event_id
    FROM TEAM
    WHERE Team_ID = p_team_id
    FOR UPDATE;

    IF v_event_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Team not found';
    END IF;

    -- Lock the event row.
    SELECT Event_ID
    INTO v_locked_event_id
    FROM EVENT
    WHERE Event_ID = v_event_id
    FOR UPDATE;

    -- Verify that the participant exists.
    SELECT COUNT(*)
    INTO v_participant_exists
    FROM PARTICIPANT
    WHERE Participant_ID = p_participant_id;

    IF v_participant_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Participant not found';
    END IF;

    -- The trigger enforces the team size and event membership rules.
    INSERT INTO TEAM_MEMBER (Team_ID, Participant_ID)
    VALUES (p_team_id, p_participant_id);

    COMMIT;

    SELECT
        'Participant added to team successfully' AS Message,
        p_team_id AS Team_ID,
        p_participant_id AS Participant_ID;
END //

DELIMITER ;
