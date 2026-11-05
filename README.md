# FestHub

A college-fest management platform built for the DBMS Level 3 project at PES University.
Admins set up events, venues, organizers and judges; organizers confirm registrations,
enter judges' scores and track expenses; students register individually or as a team and
get event recommendations. All the rules of the fest are enforced **inside the database**
(constraints, triggers, stored procedures, transactions and views).

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router), React 19, TypeScript |
| Main database | MySQL 8 (`FestHub_1`) via `mysql2` |
| Vector database | PostgreSQL + pgvector (`festhub_vectors`) via `pg` |
| Embeddings | all-MiniLM-L6-v2 (`@huggingface/transformers`, runs locally) |
| Auth | bcrypt password hashes, signed JWT in an HTTP-only cookie, role checks |

## Database features

| Feature | File |
|---|---|
| Schema (16 tables, keys, CHECK/UNIQUE/FK constraints, indexes) + demo data | `sql/07_build_festhub_1.sql` |
| Trigger: no venue double-booking | `sql/09_triggers_events.sql` |
| View: leaderboard with `RANK() OVER (PARTITION BY …)` | `sql/10_v_leaderboard.sql` |
| View: budget vs spending | `sql/11_v_budget_status.sql` |
| View: event readiness | `sql/12_v_event_readiness.sql` |
| Vector tables + HNSW index (PostgreSQL) | `sql/13_pgvector.sql` |
| Procedures `RegisterParticipant`, `RegisterTeam`, `sp_cancel_registration` (transaction + `SELECT … FOR UPDATE`); registration-type triggers | `sql/20_registrations.sql` |
| Team triggers (max 5 members, one team per event) + `AddParticipantToTeam` | `sql/21_teams.sql` |
| Rebuild everything in one step | `sql/run_all.sql` |

## Setup

### 1. MySQL

Create an app user (pick your own password):

```bash
sudo mysql -e "CREATE USER 'festhub_app'@'localhost' IDENTIFIED BY 'YourPass_123'; GRANT ALL PRIVILEGES ON FestHub_1.* TO 'festhub_app'@'localhost'; FLUSH PRIVILEGES;"
```

Build the database (from the project folder):

```bash
sudo mysql < sql/run_all.sql          # Windows: mysql -u root -p, then SOURCE sql/run_all.sql;
```

### 2. PostgreSQL + pgvector (for semantic search)

```bash
sudo apt install -y postgresql postgresql-16-pgvector    # use your PostgreSQL version number
sudo -u postgres psql -c "CREATE USER festhub_vec WITH PASSWORD 'Vec_pass_123';"
sudo -u postgres psql -c "CREATE DATABASE festhub_vectors OWNER festhub_vec;"
sudo -u postgres psql -d festhub_vectors -c "CREATE EXTENSION vector;"
psql "postgresql://festhub_vec:Vec_pass_123@localhost:5432/festhub_vectors" -f sql/13_pgvector.sql
```

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in `DB_PASSWORD`, `AUTH_SECRET` (at least 32 characters, e.g. `openssl rand -hex 32`) and the `PG_*` values.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Log in as `admin`, open **Fest overview** and click
**Re-embed all events** once to build the vectors.

## Demo logins

Password for all: `FestHub@123`

| Username | Role |
|---|---|
| admin | Admin |
| ananya.k | Organizer (Coding Contest, Hackathon, Tech Quiz) |
| rithvik.s | Organizer (cultural events) |
| rahul.sharma, karthik.kumar, sneha.reddy, aditi.k | Students |

## Folder structure

```
sql/          all database scripts (numbered, run in order by run_all.sql)
lib/          database connection (db.ts, sql.ts, tx.ts), auth, error handling, vector search
app/api/      API routes – the only code that talks to the databases
app/          pages (events, admin, organizer, student)
components/   shared UI components
proxy.ts      role-based page access
docs/         security checks
```

## Team and contributions

| Member | Area | Database features |
|---|---|---|
| Sarvani U N (sarvaniun) | Events, venues, organizers/judges, scores, budget, admin overview, recommendations, vector search | Schema rebuild, venue trigger, 3 views, scoring composite FKs, pgvector |
| Yeshaswinie D (Yesh-2516) | Login and roles, registrations, teams, student dashboard, participants, organizer accounts, security | Role CHECK, registration procedures + transactions, registration and team triggers |
