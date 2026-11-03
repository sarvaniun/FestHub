-- =====================================================================
-- FestHub Stage 3 – #14 Vector store: PostgreSQL + pgvector
-- Run (as the app's Postgres user) on the festhub_vectors database:
--   psql "postgresql://festhub_vec:YOUR_PASSWORD@localhost:5432/festhub_vectors" -f sql/13_pgvector.sql
-- (CREATE EXTENSION needs a superuser the first time – see the setup steps.)
-- =====================================================================
-- WHY a second database?
--   MySQL is the system of record: events, students, registrations…
--   PostgreSQL + pgvector stores one EMBEDDING per event and per student:
--   a list of 384 numbers produced by the all-MiniLM-L6-v2 model from
--   the text "name + type + description + interest tags". Texts with a
--   similar MEANING get vectors that point in a similar direction, so
--   "AI hackathon" finds "Machine-learning Datathon" even with no shared
--   words – something LIKE '%…%' or an interest-tag join cannot do.
--
-- HOW similarity is measured: cosine distance, operator  <=>
--   0 = same direction (very similar) … 2 = opposite.
--   We show  1 - distance  as a "similarity" (1.0 = identical meaning).
--
-- HOW the two databases stay consistent: there cannot be a FOREIGN KEY
-- across two different database servers, so event_id here is a "logical"
-- reference to MySQL EVENT.Event_ID. The app keeps them in sync:
--   * create / edit an event or change its tags → re-embed that event
--   * delete an event → delete its row here
--   * "Re-embed all events" button (POST /api/vector/reindex) rebuilds
--     everything and removes rows for events that no longer exist.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- One vector per event.
CREATE TABLE IF NOT EXISTS event_embedding (
    event_id    INTEGER      PRIMARY KEY,          -- = MySQL EVENT.Event_ID
    content     TEXT         NOT NULL,             -- the text that was embedded
    embedding   vector(384)  NOT NULL,             -- all-MiniLM-L6-v2 → 384 numbers
    model_name  TEXT         NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One vector per student, built from their interests.
CREATE TABLE IF NOT EXISTS participant_embedding (
    participant_id  INTEGER      PRIMARY KEY,      -- = MySQL PARTICIPANT.Participant_ID
    content         TEXT         NOT NULL,
    embedding       vector(384)  NOT NULL,
    model_name      TEXT         NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- HNSW index (Hierarchical Navigable Small World graph) for fast
-- approximate nearest-neighbour search. vector_cosine_ops makes the index
-- usable by ORDER BY embedding <=> query (cosine distance).
-- With only a few dozen events Postgres may still choose a plain scan –
-- that is fine; the index matters as the table grows.
CREATE INDEX IF NOT EXISTS idx_event_embedding_hnsw
    ON event_embedding USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_participant_embedding_hnsw
    ON participant_embedding USING hnsw (embedding vector_cosine_ops);

-- Check:
\d event_embedding
\di

-- ---------------------------------------------------------------------
-- Queries to try (and screenshot) after "Re-embed all events":
-- ---------------------------------------------------------------------
-- How many events have a vector?
--   SELECT COUNT(*) FROM event_embedding;
--
-- The 5 events closest in meaning to event 1:
--   SELECT b.event_id, LEFT(b.content, 60) AS content,
--          ROUND((1 - (a.embedding <=> b.embedding))::numeric, 3) AS similarity
--   FROM event_embedding a
--   JOIN event_embedding b ON b.event_id <> a.event_id
--   WHERE a.event_id = 1
--   ORDER BY a.embedding <=> b.embedding
--   LIMIT 5;
--
-- The top 5 events for a student's interest profile (participant 4):
--   SELECT e.event_id, LEFT(e.content, 60) AS content,
--          ROUND((1 - (e.embedding <=> p.embedding))::numeric, 3) AS similarity
--   FROM participant_embedding p, event_embedding e
--   WHERE p.participant_id = 4
--   ORDER BY e.embedding <=> p.embedding
--   LIMIT 5;
--
-- See that the index can be used (SET enable_seqscan = off forces it on
-- a tiny table, just for the screenshot):
--   SET enable_seqscan = off;
--   EXPLAIN SELECT event_id FROM event_embedding
--   ORDER BY embedding <=> (SELECT embedding FROM event_embedding WHERE event_id = 1)
--   LIMIT 5;
--   RESET enable_seqscan;
