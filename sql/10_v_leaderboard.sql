-- =====================================================================
-- FestHub Stage 3 – #10 View: V_LEADERBOARD
-- Run on FestHub_1:   sudo mysql FestHub_1 < sql/10_v_leaderboard.sql
-- =====================================================================
-- Built from Stage 2 query Q17. One row per scored registration with
-- its average judge score and its rank inside its event.
--
--   * the inner (derived) table groups SCORE rows per registration and
--     takes AVG(Score) and COUNT(*) (= how many judges scored it)
--   * RANK() OVER (PARTITION BY Event_ID ORDER BY Average_Score DESC)
--     restarts the numbering for every event; ties share a rank and
--     the next rank is skipped (1, 1, 3)
--   * COALESCE(p.Name, t.Team_Name) shows the student's name for an
--     individual registration and the team's name for a team one
--     (exactly one of them is set, because of the CHECK on REGISTRATION)
--
-- Why a view? The app runs   SELECT * FROM V_LEADERBOARD WHERE Event_ID = ?
-- instead of repeating this query, and the ranking logic lives in one
-- place in the database. A view stores no data: it is re-computed every
-- time it is queried, so a new score shows up immediately.
-- =====================================================================

CREATE OR REPLACE VIEW V_LEADERBOARD AS
SELECT Event_ID,
       Event_Name,
       Registration_ID,
       Registered_By,
       Average_Score,
       Judges,
       RANK() OVER (PARTITION BY Event_ID ORDER BY Average_Score DESC) AS Leaderboard_Rank
FROM (
    SELECT e.Event_ID,
           e.Event_Name,
           r.Registration_ID,
           COALESCE(p.Name, t.Team_Name) AS Registered_By,
           ROUND(AVG(s.Score), 2)        AS Average_Score,
           COUNT(*)                      AS Judges
    FROM SCORE s
    JOIN REGISTRATION r     ON r.Registration_ID = s.Registration_ID
    JOIN EVENT e            ON e.Event_ID = s.Event_ID
    LEFT JOIN PARTICIPANT p ON p.Participant_ID = r.Participant_ID
    LEFT JOIN TEAM t        ON t.Team_ID = r.Team_ID
    GROUP BY e.Event_ID, e.Event_Name, r.Registration_ID, p.Name, t.Team_Name
) per_registration;

-- Try it:
SELECT * FROM V_LEADERBOARD ORDER BY Event_Name, Leaderboard_Rank;

-- Top 3 of every event (this is exactly Stage 2 Q17, now through the view):
SELECT Event_Name, Leaderboard_Rank, Registered_By, Average_Score, Judges
FROM V_LEADERBOARD
WHERE Leaderboard_Rank <= 3
ORDER BY Event_Name, Leaderboard_Rank;

-- ---------------------------------------------------------------------
-- Screenshot for #10: a score from a judge who is NOT assigned to the
-- event is rejected by the composite foreign key
--   SCORE(Event_ID, Judge_ID) → EVENT_JUDGE(Event_ID, Judge_ID)
-- Find a judge who is not on the event first:
--   SELECT * FROM EVENT_JUDGE WHERE Event_ID = 1;
-- then (change the ids so that judge 6 is NOT assigned to event 1):
-- INSERT INTO SCORE (Event_ID, Judge_ID, Registration_ID, Score)
-- VALUES (1, 6, 1, 80);
--   → ERROR 1452 (23000): Cannot add or update a child row: a foreign key
--     constraint fails (... CONSTRAINT `fk_score_event_judge` ...)
-- ---------------------------------------------------------------------
