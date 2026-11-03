-- =====================================================================
-- FestHub – rebuild the WHOLE database in one go (fresh demo state)
--
--   cd into the project folder first, then open MySQL:
--     Linux:    sudo mysql
--     Windows:  mysql -u root -p
--   and type:   SOURCE sql/run_all.sql;
--
-- Safe to run again any time (e.g. before every rehearsal / the demo):
-- it drops FestHub_1 and builds it back with the demo data.
-- The vector database is separate: after a rebuild, log in as admin and
-- click "Re-embed all events" on /admin/overview.
-- =====================================================================
SOURCE sql/07_build_festhub_1.sql;
SOURCE sql/09_triggers_events.sql;
SOURCE sql/10_v_leaderboard.sql;
SOURCE sql/11_v_budget_status.sql;
SOURCE sql/12_v_event_readiness.sql;
SOURCE sql/20_registrations.sql;
SOURCE sql/21_teams.sql;
