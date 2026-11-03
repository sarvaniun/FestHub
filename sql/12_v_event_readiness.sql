-- =====================================================================
-- FestHub Stage 3 – #12 View: V_EVENT_READINESS
-- Run on FestHub_1:   sudo mysql FestHub_1 < sql/12_v_event_readiness.sql
-- =====================================================================
-- Built from Stage 2 query Q9: what is each event still missing?
--
--   * scalar subqueries in the SELECT list count organizers, judges and
--     (non-cancelled) registrations for each event
--   * EXISTS / NOT EXISTS decide which pieces are missing
--   * CONCAT_WS(', ', ...) joins only the non-NULL parts, so we get e.g.
--     "Missing: judge, registrations" with no stray commas
-- =====================================================================

CREATE OR REPLACE VIEW V_EVENT_READINESS AS
SELECT e.Event_ID,
       e.Event_Name,
       e.Start_Time,
       (SELECT COUNT(*) FROM EVENT_ORGANIZER eo WHERE eo.Event_ID = e.Event_ID) AS Organizers,
       (SELECT COUNT(*) FROM EVENT_JUDGE ej     WHERE ej.Event_ID = e.Event_ID) AS Judges,
       (SELECT COUNT(*) FROM REGISTRATION r
         WHERE r.Event_ID = e.Event_ID AND r.Status <> 'Cancelled')            AS Registrations,
       CASE
         WHEN EXISTS (SELECT 1 FROM EVENT_ORGANIZER eo WHERE eo.Event_ID = e.Event_ID)
          AND EXISTS (SELECT 1 FROM EVENT_JUDGE ej     WHERE ej.Event_ID = e.Event_ID)
          AND EXISTS (SELECT 1 FROM REGISTRATION r     WHERE r.Event_ID  = e.Event_ID
                                                         AND r.Status <> 'Cancelled')
         THEN 'Ready'
         ELSE CONCAT('Missing: ', CONCAT_WS(', ',
                CASE WHEN NOT EXISTS (SELECT 1 FROM EVENT_ORGANIZER eo WHERE eo.Event_ID = e.Event_ID)
                     THEN 'organizer' END,
                CASE WHEN NOT EXISTS (SELECT 1 FROM EVENT_JUDGE ej WHERE ej.Event_ID = e.Event_ID)
                     THEN 'judge' END,
                CASE WHEN NOT EXISTS (SELECT 1 FROM REGISTRATION r WHERE r.Event_ID = e.Event_ID
                                                                   AND r.Status <> 'Cancelled')
                     THEN 'registrations' END))
       END AS Readiness
FROM EVENT e;

-- Try it:
SELECT * FROM V_EVENT_READINESS ORDER BY Readiness DESC, Event_Name;
