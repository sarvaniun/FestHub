-- =====================================================================
-- FestHub Stage 3 – #9 Trigger: prevent venue double-booking
-- Run on FestHub_1:   sudo mysql FestHub_1 < sql/09_triggers_events.sql
-- =====================================================================
-- Two time slots A and B overlap when  A.start < B.end  AND  B.start < A.end
-- (touching slots such as 10:00–12:00 and 12:00–14:00 do NOT overlap).
--
-- A CHECK constraint cannot do this, because CHECK can only look at the
-- row being written, not at OTHER rows of the table. A trigger can run a
-- query, so it can compare the new row against every event already in
-- the same venue.
--
-- If a clash is found the trigger raises SIGNAL SQLSTATE '45000'. That
-- aborts the INSERT/UPDATE, and the app's error handler (lib/http.ts)
-- shows the MESSAGE_TEXT to the user as a 400 error.
-- =====================================================================

DROP TRIGGER IF EXISTS trg_event_no_venue_clash_insert;
DROP TRIGGER IF EXISTS trg_event_no_venue_clash_update;

DELIMITER //

CREATE TRIGGER trg_event_no_venue_clash_insert
BEFORE INSERT ON EVENT
FOR EACH ROW
BEGIN
    DECLARE v_clash VARCHAR(100);
    DECLARE v_message VARCHAR(255);

    -- Name of any event in the same venue whose slot overlaps the new one
    -- (NULL when there is none).
    SET v_clash = (
        SELECT Event_Name
        FROM EVENT
        WHERE Venue_ID = NEW.Venue_ID
          AND NEW.Start_Time < End_Time
          AND Start_Time < NEW.End_Time
        LIMIT 1
    );

    IF v_clash IS NOT NULL THEN
        -- MESSAGE_TEXT must be a literal or a variable, so build it first.
        SET v_message = CONCAT('Venue is already booked at this time by: ', v_clash);
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = v_message;
    END IF;
END //

CREATE TRIGGER trg_event_no_venue_clash_update
BEFORE UPDATE ON EVENT
FOR EACH ROW
BEGIN
    DECLARE v_clash VARCHAR(100);
    DECLARE v_message VARCHAR(255);

    -- Only re-check when the venue or the time slot actually changed
    -- (OLD = the row before the update, NEW = the row after). So editing
    -- just the name, description or budget never trips the trigger.
    IF NEW.Venue_ID <> OLD.Venue_ID
       OR NEW.Start_Time <> OLD.Start_Time
       OR NEW.End_Time <> OLD.End_Time THEN

        -- Same check as on INSERT, but the event must not be compared
        -- with itself.
        SET v_clash = (
            SELECT Event_Name
            FROM EVENT
            WHERE Venue_ID = NEW.Venue_ID
              AND Event_ID <> NEW.Event_ID
              AND NEW.Start_Time < End_Time
              AND Start_Time < NEW.End_Time
            LIMIT 1
        );

        IF v_clash IS NOT NULL THEN
            SET v_message = CONCAT('Venue is already booked at this time by: ', v_clash);
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = v_message;
        END IF;
    END IF;
END //

DELIMITER ;

-- ---------------------------------------------------------------------
-- NOTE about the demo data: the seed deliberately has two events that
-- clash (Open Mic and Debate, for Stage 2 query Q7). The trigger does
-- not touch rows that already exist, so Q7 still finds them. Editing
-- their name/description/budget still works; changing their time or
-- venue is checked like any other event.
-- ---------------------------------------------------------------------

SHOW TRIGGERS WHERE `Trigger` LIKE 'trg_event_no_venue_clash%';

-- ---------------------------------------------------------------------
-- Screenshot tests (run these one at a time; they ROLLBACK, so nothing
-- is left behind). Change Venue_ID / times to match your data: use
-- SELECT Event_ID, Venue_ID, Start_Time, End_Time FROM EVENT; first.
-- ---------------------------------------------------------------------
-- START TRANSACTION;
-- -- 1) ALLOWED: a free slot (far in the future) in venue 1
-- INSERT INTO EVENT (Event_Name, Description, Start_Time, End_Time, Budget, Event_Type, Venue_ID)
-- VALUES ('Trigger Test OK', 'free slot', '2026-12-01 10:00:00', '2026-12-01 12:00:00', 1000, 'Individual', 1);
-- -- 2) ALLOWED: touches the end of test 1 exactly (12:00), not an overlap
-- INSERT INTO EVENT (Event_Name, Description, Start_Time, End_Time, Budget, Event_Type, Venue_ID)
-- VALUES ('Trigger Test Touch', 'starts when the other ends', '2026-12-01 12:00:00', '2026-12-01 13:00:00', 1000, 'Individual', 1);
-- -- 3) REJECTED: overlaps test 1 (11:00 is inside 10:00–12:00)
-- INSERT INTO EVENT (Event_Name, Description, Start_Time, End_Time, Budget, Event_Type, Venue_ID)
-- VALUES ('Trigger Test Clash', 'overlaps', '2026-12-01 11:00:00', '2026-12-01 11:30:00', 1000, 'Individual', 1);
-- --    → ERROR 1644 (45000): Venue is already booked at this time by: Trigger Test OK
-- ROLLBACK;
