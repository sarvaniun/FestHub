-- =====================================================================
-- FestHub Stage 3 – #11 View: V_BUDGET_STATUS
-- Run on FestHub_1:   sudo mysql FestHub_1 < sql/11_v_budget_status.sql
-- =====================================================================
-- Built from Stage 2 query Q12a: budget vs actual spending per event.
--
--   * LEFT JOIN EXPENSE keeps events that have no expenses yet
--     (their SUM is NULL, and COALESCE turns it into 0)
--   * Spent, Remaining and Utilisation_Percent are DERIVED values: they
--     are computed from EXPENSE every time, never stored, so they can
--     never go out of sync with the expense rows
--   * NULLIF(e.Budget, 0) avoids dividing by zero for a ₹0 budget event
-- =====================================================================

CREATE OR REPLACE VIEW V_BUDGET_STATUS AS
SELECT e.Event_ID,
       e.Event_Name,
       e.Budget,
       COALESCE(SUM(x.Amount), 0)                                  AS Spent,
       e.Budget - COALESCE(SUM(x.Amount), 0)                       AS Remaining,
       ROUND(100 * COALESCE(SUM(x.Amount), 0) / NULLIF(e.Budget, 0), 1)
                                                                   AS Utilisation_Percent,
       CASE
           WHEN COALESCE(SUM(x.Amount), 0) > e.Budget        THEN 'Over budget'
           WHEN COALESCE(SUM(x.Amount), 0) >= 0.8 * e.Budget THEN 'Nearly used up'
           ELSE 'Within budget'
       END                                                         AS Budget_Status
FROM EVENT e
LEFT JOIN EXPENSE x ON x.Event_ID = e.Event_ID
GROUP BY e.Event_ID, e.Event_Name, e.Budget;

-- Try it:
SELECT * FROM V_BUDGET_STATUS ORDER BY Utilisation_Percent DESC;

-- Events that have gone over budget (Stage 2 Q12b, through the view):
SELECT Event_Name, Budget, Spent, -Remaining AS Over_By
FROM V_BUDGET_STATUS
WHERE Spent > Budget;
