-- =====================================================================
-- FestHub Stage 3 – #3 + #4: build FestHub_1 with the final schema and demo data
--
--   Linux:    cd ~/FestHub-app  &&  sudo mysql
--   Windows:  cd to the project folder, then  mysql -u root -p
--   then, at the mysql> prompt:      SOURCE sql/07_build_festhub_1.sql;
--
-- ⚠ This DROPS and re-creates FestHub_1. Anything you typed into it by
--   hand (test sign-ups etc.) is lost. Back it up first if you care:
--     mysqldump -u root -p FestHub_1 > festhub_1_backup.sql
--
-- WHY rebuild instead of ALTERing the old FestHub_1?
--   * The old FestHub_1 was made on Windows, where table names are stored
--     in lower case (event, registration...). On Linux, table names are
--     case-sensitive, so the app's  SELECT ... FROM EVENT  would fail.
--     Creating the tables from this script gives the same UPPER-CASE
--     names on every laptop.
--   * It is exactly the Stage 2 design that the report documents:
--       Part 1 = Stage 2 01_schema.sql      (the 10 original tables)
--       Part 2 = Stage 2 02_alter_new_tables_indexes.sql
--                (UNIQUE/CHECK constraints, SCORE, EVENT_INTEREST,
--                 EXPENSE, indexes)
--       Part 3 = Stage 2 03_seed_data.sql   (demo data + 7 demo logins)
--       Part 4 = fixes: interest spellings, AUTO_INCREMENT ids
--   * The old data problems (the duplicate registration, Arjun in two
--     Hackathon teams) are already fixed in the Stage 2 seed data:
--     Arjun is only in Code Warriors.
--
-- Triggers and procedures are NOT here: they live in their own files
--   sql/09_triggers_events.sql            (venue double-booking, #9)
--   sql/20_registrations.sql              (registration rules, #20)
--   sql/21_teams.sql                      (team rules, #21)
-- Run those after this file.
--
-- Demo logins (password for all: FestHub@123)
--   admin           ADMIN
--   ananya.k        ORGANIZER  (Coding Club: Coding Contest, Hackathon, Tech Quiz)
--   rithvik.s       ORGANIZER  (Cultural Committee)
--   rahul.sharma    STUDENT    karthik.kumar  STUDENT
--   sneha.reddy     STUDENT    aditi.k        STUDENT
-- =====================================================================


-- #####################################################################
-- PART 1 – tables (Stage 2 01_schema.sql)
-- #####################################################################

-- =====================================================================
-- FestHub  |  Stage 2  |  01_schema.sql
-- DDL: baseline schema (the 13 tables that already exist in FestHub_1)
-- DBMS: MySQL 8.0
--
-- Run on a FRESH database so the live application database (FestHub_1)
-- and its login data are never touched:
--     mysql -u root -p < 01_schema.sql
--
-- File order: 01_schema -> 02_alter_new_tables_indexes -> 03_seed_data
--             -> 04_dml -> 05_queries -> 06_tests
-- =====================================================================

-- Appropriate use of DROP: makes the script re-runnable from scratch.
DROP DATABASE IF EXISTS FestHub_1;
CREATE DATABASE FestHub_1;
USE FestHub_1;


-- =========================================================
-- 1. VENUE
-- =========================================================
CREATE TABLE VENUE (
    Venue_ID      INT           PRIMARY KEY,
    Venue_Name    VARCHAR(100)  NOT NULL,
    Capacity      INT           NOT NULL,
    Location      VARCHAR(100)
);


-- =========================================================
-- 2. EVENT                       VENUE 1 : N EVENT (HOSTS)
-- =========================================================
CREATE TABLE EVENT (
    Event_ID      INT            PRIMARY KEY,
    Event_Name    VARCHAR(100)   NOT NULL,
    Description   VARCHAR(500),
    Start_Time    DATETIME       NOT NULL,
    End_Time      DATETIME       NOT NULL,
    Budget        DECIMAL(12,2)  NOT NULL,
    Event_Type    ENUM('Individual', 'Team') NOT NULL,
    Venue_ID      INT            NOT NULL,

    -- No ON DELETE action = RESTRICT: a venue that still hosts
    -- events cannot be deleted.
    CONSTRAINT fk_event_venue
        FOREIGN KEY (Venue_ID) REFERENCES VENUE(Venue_ID),

    CONSTRAINT chk_event_time   CHECK (End_Time > Start_Time),
    CONSTRAINT chk_event_budget CHECK (Budget >= 0)
);


-- =========================================================
-- 3. PARTICIPANT
-- =========================================================
CREATE TABLE PARTICIPANT (
    Participant_ID  INT           PRIMARY KEY,
    Name            VARCHAR(100)  NOT NULL,
    Email           VARCHAR(150)  NOT NULL,
    Phone           VARCHAR(20),
    Department      VARCHAR(100)
);


-- =========================================================
-- 4. ORGANIZER
-- =========================================================
CREATE TABLE ORGANIZER (
    Organizer_ID  INT           PRIMARY KEY,
    Name          VARCHAR(100)  NOT NULL,
    Phone         VARCHAR(20),
    Email         VARCHAR(150)  NOT NULL
);


-- =========================================================
-- 5. JUDGE
-- =========================================================
CREATE TABLE JUDGE (
    Judge_ID   INT           PRIMARY KEY,
    Name       VARCHAR(100)  NOT NULL,
    Email      VARCHAR(150)  NOT NULL,
    Phone      VARCHAR(20),
    Expertise  VARCHAR(200)
);


-- =========================================================
-- 6. TEAM                        EVENT 1 : N TEAM (FORMED FOR)
-- =========================================================
CREATE TABLE TEAM (
    Team_ID    INT           PRIMARY KEY,
    Team_Name  VARCHAR(100)  NOT NULL,
    Event_ID   INT           NOT NULL,

    CONSTRAINT fk_team_event
        FOREIGN KEY (Event_ID) REFERENCES EVENT(Event_ID),

    -- Lets REGISTRATION reference the PAIR (Team_ID, Event_ID), so a
    -- team can only register for the event it was formed for.
    CONSTRAINT uq_team_event UNIQUE (Team_ID, Event_ID)
);


-- =========================================================
-- 7. EVENT_ORGANIZER             EVENT M : N ORGANIZER
-- =========================================================
CREATE TABLE EVENT_ORGANIZER (
    Event_ID      INT NOT NULL,
    Organizer_ID  INT NOT NULL,

    PRIMARY KEY (Event_ID, Organizer_ID),

    CONSTRAINT fk_eo_event
        FOREIGN KEY (Event_ID) REFERENCES EVENT(Event_ID) ON DELETE CASCADE,
    CONSTRAINT fk_eo_organizer
        FOREIGN KEY (Organizer_ID) REFERENCES ORGANIZER(Organizer_ID) ON DELETE CASCADE
);


-- =========================================================
-- 8. TEAM_MEMBER                 TEAM M : N PARTICIPANT
-- =========================================================
CREATE TABLE TEAM_MEMBER (
    Team_ID         INT NOT NULL,
    Participant_ID  INT NOT NULL,

    PRIMARY KEY (Team_ID, Participant_ID),

    CONSTRAINT fk_tm_team
        FOREIGN KEY (Team_ID) REFERENCES TEAM(Team_ID) ON DELETE CASCADE,
    CONSTRAINT fk_tm_participant
        FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID) ON DELETE CASCADE
);


-- =========================================================
-- 9. EVENT_JUDGE                 EVENT M : N JUDGE
-- =========================================================
CREATE TABLE EVENT_JUDGE (
    Event_ID  INT NOT NULL,
    Judge_ID  INT NOT NULL,

    PRIMARY KEY (Event_ID, Judge_ID),

    CONSTRAINT fk_ej_event
        FOREIGN KEY (Event_ID) REFERENCES EVENT(Event_ID) ON DELETE CASCADE,
    CONSTRAINT fk_ej_judge
        FOREIGN KEY (Judge_ID) REFERENCES JUDGE(Judge_ID) ON DELETE CASCADE
);


-- =========================================================
-- 10. REGISTRATION
--     EVENT 1:N, PARTICIPANT 1:N (individual), TEAM 1:N (team)
-- =========================================================
CREATE TABLE REGISTRATION (
    Registration_ID    INT          PRIMARY KEY,
    Event_ID           INT          NOT NULL,
    Participant_ID     INT,
    Team_ID            INT,
    Registration_Time  DATETIME     NOT NULL,
    Status             VARCHAR(30)  NOT NULL,

    CONSTRAINT fk_reg_event
        FOREIGN KEY (Event_ID) REFERENCES EVENT(Event_ID) ON DELETE CASCADE,

    -- MySQL 8 does not allow a CHECK constraint on a column whose FK has
    -- an ON DELETE CASCADE / SET NULL action (error 3823). Participant_ID
    -- and Team_ID are used in the CHECK below, so these two FKs keep the
    -- default RESTRICT behaviour.
    CONSTRAINT fk_reg_participant
        FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID),

    CONSTRAINT fk_reg_team_event
        FOREIGN KEY (Team_ID, Event_ID) REFERENCES TEAM(Team_ID, Event_ID),

    -- Exactly ONE of Participant_ID / Team_ID must be filled in.
    CONSTRAINT chk_registration_participant_or_team CHECK (
        (Participant_ID IS NOT NULL AND Team_ID IS NULL)
        OR
        (Participant_ID IS NULL AND Team_ID IS NOT NULL)
    )
);


-- =========================================================
-- 11. USER_ACCOUNT  (login accounts used by the Next.js app)
-- =========================================================
CREATE TABLE USER_ACCOUNT (
    User_ID         INT           AUTO_INCREMENT PRIMARY KEY,
    Email           VARCHAR(150)  NOT NULL UNIQUE,
    Username        VARCHAR(20)   NOT NULL UNIQUE,
    Password_Hash   VARCHAR(255)  NOT NULL,          -- bcrypt hash, never plain text
    Role            ENUM('STUDENT', 'ORGANIZER', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    Participant_ID  INT           NULL UNIQUE,       -- 1:1 with PARTICIPANT
    Organizer_ID    INT           NULL UNIQUE,       -- 1:1 with ORGANIZER
    Is_Active       BOOLEAN       NOT NULL DEFAULT TRUE,
    Created_At      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- RESTRICT (no ON DELETE action) for the same MySQL rule as above:
    -- both columns are used in chk_user_role_link.
    CONSTRAINT fk_user_participant
        FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID),
    CONSTRAINT fk_user_organizer
        FOREIGN KEY (Organizer_ID) REFERENCES ORGANIZER(Organizer_ID),

    -- STUDENT -> linked to a participant, ORGANIZER -> linked to an
    -- organizer, ADMIN -> linked to neither.
    CONSTRAINT chk_user_role_link CHECK (
        (Role = 'STUDENT'   AND Participant_ID IS NOT NULL AND Organizer_ID IS NULL)
        OR
        (Role = 'ORGANIZER' AND Organizer_ID IS NOT NULL AND Participant_ID IS NULL)
        OR
        (Role = 'ADMIN'     AND Participant_ID IS NULL AND Organizer_ID IS NULL)
    )
);


-- =========================================================
-- 12. INTERESTS  (selectable interest tags)
-- =========================================================
CREATE TABLE INTERESTS (
    Interest_ID    INT           AUTO_INCREMENT PRIMARY KEY,
    Interest_Name  VARCHAR(100)  NOT NULL
);


-- =========================================================
-- 13. PARTICIPANT_INTEREST       PARTICIPANT M : N INTERESTS
-- =========================================================
CREATE TABLE PARTICIPANT_INTEREST (
    Participant_ID  INT NOT NULL,
    Interest_ID     INT NOT NULL,

    PRIMARY KEY (Participant_ID, Interest_ID),

    CONSTRAINT fk_pi_participant
        FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID) ON DELETE CASCADE,
    CONSTRAINT fk_pi_interest
        FOREIGN KEY (Interest_ID) REFERENCES INTERESTS(Interest_ID) ON DELETE CASCADE
);


-- Evidence: list every table that was created.


-- #####################################################################
-- PART 2 – constraints, new tables, indexes (Stage 2 02)
-- #####################################################################

-- =====================================================================
-- FestHub  |  Stage 2  |  02_alter_new_tables_indexes.sql
-- DDL: schema evolution for Stage 2
--   A. ALTER TABLE  - integrity rules missing from the baseline schema
--   B. CREATE TABLE - SCORE, EVENT_INTEREST, EXPENSE
--   C. CREATE INDEX - indexes for the frequent queries
--   D. DROP         - removing a redundant index
-- Run after 01_schema.sql.
-- =====================================================================
USE FestHub_1;


-- =====================================================================
-- A. ALTER TABLE
-- =====================================================================

-- A1. One person = one email. The baseline schema did not enforce this.
ALTER TABLE PARTICIPANT ADD CONSTRAINT uq_participant_email UNIQUE (Email);
ALTER TABLE ORGANIZER   ADD CONSTRAINT uq_organizer_email   UNIQUE (Email);
ALTER TABLE JUDGE       ADD CONSTRAINT uq_judge_email       UNIQUE (Email);

-- A2. A venue must hold at least one person.
ALTER TABLE VENUE ADD CONSTRAINT chk_venue_capacity CHECK (Capacity > 0);

-- A3. Registration rules:
--   * a participant can register for an event only once
--   * a team can register for an event only once
--   * Status can only be one of three values; defaults to 'Pending'
--   * Registration_Time defaults to the moment of insertion
--   (MySQL allows several NULLs in a UNIQUE column, so team registrations,
--    which have Participant_ID = NULL, do not clash with each other.)
ALTER TABLE REGISTRATION
    ADD CONSTRAINT uq_reg_event_participant UNIQUE (Event_ID, Participant_ID),
    ADD CONSTRAINT uq_reg_event_team        UNIQUE (Event_ID, Team_ID),
    MODIFY Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    MODIFY Registration_Time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD CONSTRAINT chk_reg_status
        CHECK (Status IN ('Pending', 'Confirmed', 'Cancelled'));

-- A4. Needed so SCORE can reference the pair (Registration_ID, Event_ID)
--     and guarantee a score belongs to a registration of the same event.
ALTER TABLE REGISTRATION
    ADD CONSTRAINT uq_reg_id_event UNIQUE (Registration_ID, Event_ID);

-- A5. Interest names must not repeat.
ALTER TABLE INTERESTS ADD CONSTRAINT uq_interest_name UNIQUE (Interest_Name);

-- A6. New attribute: the club an organizer represents.
ALTER TABLE ORGANIZER ADD COLUMN Club VARCHAR(100) AFTER `Name`;


-- =====================================================================
-- B. NEW TABLES
-- =====================================================================

-- B1. SCORE - one judge's score for one registration.
--     Source data for the event leaderboard.
CREATE TABLE SCORE (
    Event_ID         INT           NOT NULL,
    Judge_ID         INT           NOT NULL,
    Registration_ID  INT           NOT NULL,
    Score            DECIMAL(5,2)  NOT NULL,
    Remarks          VARCHAR(255),
    Scored_At        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- A judge scores a registration at most once.
    PRIMARY KEY (Judge_ID, Registration_ID),

    -- Only a judge ASSIGNED to this event (EVENT_JUDGE) can score it.
    -- RESTRICT: a judge cannot be un-assigned after scoring.
    CONSTRAINT fk_score_event_judge
        FOREIGN KEY (Event_ID, Judge_ID)
        REFERENCES EVENT_JUDGE(Event_ID, Judge_ID),

    -- The registration must belong to the SAME event.
    -- If the registration is deleted, its scores go with it.
    CONSTRAINT fk_score_registration
        FOREIGN KEY (Registration_ID, Event_ID)
        REFERENCES REGISTRATION(Registration_ID, Event_ID)
        ON DELETE CASCADE,

    CONSTRAINT chk_score_range CHECK (Score BETWEEN 0 AND 100)
);

-- B2. EVENT_INTEREST - tags events with the same interests students pick.
--     EVENT M : N INTERESTS. Used for relational recommendations.
CREATE TABLE EVENT_INTEREST (
    Event_ID     INT NOT NULL,
    Interest_ID  INT NOT NULL,

    PRIMARY KEY (Event_ID, Interest_ID),

    CONSTRAINT fk_ei_event
        FOREIGN KEY (Event_ID) REFERENCES EVENT(Event_ID) ON DELETE CASCADE,
    CONSTRAINT fk_ei_interest
        FOREIGN KEY (Interest_ID) REFERENCES INTERESTS(Interest_ID) ON DELETE CASCADE
);

-- B3. EXPENSE - actual spending against an event's budget.
--     EVENT 1 : N EXPENSE. Budget left = Budget - SUM(Amount).
CREATE TABLE EXPENSE (
    Expense_ID    INT            AUTO_INCREMENT PRIMARY KEY,
    Event_ID      INT            NOT NULL,
    Description   VARCHAR(200)   NOT NULL,
    Category      ENUM('Venue', 'Equipment', 'Prizes', 'Food',
                       'Marketing', 'Logistics', 'Other')
                                 NOT NULL DEFAULT 'Other',
    Amount        DECIMAL(10,2)  NOT NULL,
    Expense_Date  DATE           NOT NULL,

    CONSTRAINT fk_expense_event
        FOREIGN KEY (Event_ID) REFERENCES EVENT(Event_ID) ON DELETE CASCADE,

    CONSTRAINT chk_expense_amount CHECK (Amount > 0)
);


-- =====================================================================
-- C. INDEXES
-- (MySQL already indexes every PRIMARY KEY, UNIQUE and FOREIGN KEY.
--  The indexes below cover the query patterns those do not.)
-- =====================================================================

-- C1. Venue schedule and venue-clash detection:
--     WHERE Venue_ID = ? ORDER BY Start_Time
CREATE INDEX idx_event_venue_time ON EVENT (Venue_ID, Start_Time);

-- C2. Fest timeline: events ordered or filtered by start time.
CREATE INDEX idx_event_start ON EVENT (Start_Time);

-- C3. Active registrations of an event:
--     WHERE Event_ID = ? AND Status <> 'Cancelled'
CREATE INDEX idx_reg_event_status ON REGISTRATION (Event_ID, Status);

-- C4. Department-wise reports.
CREATE INDEX idx_participant_department ON PARTICIPANT (Department);

-- C5. Spending per event over time.
CREATE INDEX idx_expense_event_date ON EXPENSE (Event_ID, Expense_Date);


-- =====================================================================
-- D. DROP - removing a redundant index
-- A single-column index on EVENT(Venue_ID) is redundant: by the
-- leftmost-prefix rule, idx_event_venue_time (Venue_ID, Start_Time)
-- already serves every lookup on Venue_ID alone, and it also satisfies
-- fk_event_venue. The extra index would only slow down INSERT/UPDATE.
-- =====================================================================
CREATE INDEX idx_event_venue_only ON EVENT (Venue_ID);
DROP INDEX idx_event_venue_only ON EVENT;


-- =====================================================================
-- Evidence
-- =====================================================================


-- #####################################################################
-- PART 3 – demo data (Stage 2 03_seed_data.sql)
-- #####################################################################

-- =====================================================================
-- FestHub  |  Stage 2  |  03_seed_data.sql
-- Sample data for a 3-day college fest (10-12 October 2026).
-- Run after 02_alter_new_tables_indexes.sql.
--
-- IDs 1-6 of participants, IDs 1-3 of events and teams, and
-- registrations 1-7 match the data already used in FestHub_1.
--
-- A few situations are included ON PURPOSE so the Stage 2 queries have
-- something to detect (Stage 3 triggers will prevent them):
--   * Open Mic (5) and Debate Championship (9) overlap in Seminar Hall 1
--   * Participant 9 (Aditi) is in two teams whose events overlap
--   * Robo Race (12) has no organizer, no judge and no registrations
--   * Hackathon (2) has spent more than its budget
--   * Judge 2 has not yet scored registration 10
-- =====================================================================
USE FestHub_1;


-- ---------------------------------------------------------------------
-- VENUE (7)
-- ---------------------------------------------------------------------
INSERT INTO VENUE (Venue_ID, Venue_Name, Capacity, Location) VALUES
(1, 'Main Auditorium',    600, 'Block A, Ground Floor'),
(2, 'Seminar Hall 1',     120, 'Block B, First Floor'),
(3, 'Computer Lab 3',      60, 'Block C, Second Floor'),
(4, 'Open Air Theatre',   800, 'Central Lawn'),
(5, 'Quiz Room 404',       10, 'Block B, Fourth Floor'),
(6, 'Innovation Lab',      80, 'Block D, Ground Floor'),
(7, 'Indoor Sports Hall', 200, 'Sports Complex');


-- ---------------------------------------------------------------------
-- EVENT (12)  - total fest budget = 2,58,000
-- ---------------------------------------------------------------------
INSERT INTO EVENT (Event_ID, Event_Name, Description, Start_Time, End_Time, Budget, Event_Type, Venue_ID) VALUES
(1,  'Coding Contest',
     'Competitive programming contest with algorithmic problems on data structures, graphs and dynamic programming.',
     '2026-10-10 09:00:00', '2026-10-10 13:00:00', 15000.00, 'Individual', 3),
(2,  'Hackathon',
     '24-hour hackathon where teams build a working software prototype that solves a real campus problem.',
     '2026-10-11 09:00:00', '2026-10-12 09:00:00', 60000.00, 'Team', 6),
(3,  'Tech Quiz',
     'Rapid-fire quiz on computing history, current technology and startups.',
     '2026-10-10 14:00:00', '2026-10-10 15:30:00',  5000.00, 'Individual', 5),
(4,  'Battle of Bands',
     'Live music competition for college bands, judged on originality, stage presence and sound.',
     '2026-10-10 18:00:00', '2026-10-10 21:30:00', 40000.00, 'Team', 4),
(5,  'Open Mic',
     'Open stage for poetry, stand-up comedy and acoustic performances.',
     '2026-10-10 15:00:00', '2026-10-10 17:00:00',  5000.00, 'Individual', 2),
(6,  'AI/ML Workshop',
     'Hands-on workshop on training and evaluating machine learning models in Python.',
     '2026-10-11 10:00:00', '2026-10-11 13:00:00', 12000.00, 'Individual', 2),
(7,  'Capture The Flag',
     'Cybersecurity challenge where teams solve cryptography, web security and forensics puzzles to capture flags.',
     '2026-10-11 14:00:00', '2026-10-11 18:00:00', 20000.00, 'Team', 3),
(8,  'UI/UX Designathon',
     'Design challenge to prototype an intuitive mobile app interface in Figma.',
     '2026-10-12 13:00:00', '2026-10-12 17:00:00', 15000.00, 'Team', 6),
(9,  'Debate Championship',
     'Parliamentary-style debate on technology, ethics and society.',
     '2026-10-10 16:00:00', '2026-10-10 18:00:00',  8000.00, 'Individual', 2),
(10, 'Dance Battle',
     'Inter-college group dance competition across hip-hop, contemporary and folk styles.',
     '2026-10-12 17:00:00', '2026-10-12 20:00:00', 35000.00, 'Team', 1),
(11, 'Datathon',
     'Data science challenge: clean, analyse and model a real-world dataset to answer a business question.',
     '2026-10-12 10:00:00', '2026-10-12 15:00:00', 18000.00, 'Team', 3),
(12, 'Robo Race',
     'Build and race remote-controlled robots through an obstacle course.',
     '2026-10-12 10:00:00', '2026-10-12 13:00:00', 25000.00, 'Team', 7);


-- ---------------------------------------------------------------------
-- PARTICIPANT (25)
-- 1-6 inserted directly; 7-25 bulk-loaded through a staging table.
-- ---------------------------------------------------------------------
INSERT INTO PARTICIPANT (Participant_ID, Name, Email, Phone, Department) VALUES
(1, 'Rahul Sharma',  'rahul@gmail.com',   '9876543210', 'CSE'),
(2, 'Ananya Rao',    'ananya@gmail.com',  '9876543211', 'ISE'),
(3, 'Karthik Kumar', 'karthik@gmail.com', '9876543212', 'CSE'),
(4, 'Sneha Reddy',   'sneha@gmail.com',   '9876543213', 'ECE'),
(5, 'Arjun Nair',    'arjun@gmail.com',   '9876543214', 'CSE'),
(6, 'Priya Menon',   'priya@gmail.com',   '9876543215', 'ISE');

-- Bulk load: rows go into a staging table first, are copied with
-- INSERT ... SELECT, and the staging table is then dropped
-- (appropriate use of DROP TABLE).
CREATE TABLE PARTICIPANT_STAGING (
    Participant_ID  INT,
    Name            VARCHAR(100),
    Email           VARCHAR(150),
    Phone           VARCHAR(20),
    Department      VARCHAR(100)
);

INSERT INTO PARTICIPANT_STAGING VALUES
(7,  'Meera Shah',      'meera.shah@gmail.com',      '9876543216', 'CSE'),
(8,  'Rohan Verma',     'rohan.verma@gmail.com',     '9876543217', 'ECE'),
(9,  'Aditi Kulkarni',  'aditi.kulkarni@gmail.com',  '9876543218', 'CSE'),
(10, 'Vikram Joshi',    'vikram.joshi@gmail.com',    '9876543219', 'AIML'),
(11, 'Nisha Iyer',      'nisha.iyer@gmail.com',      '9876543220', 'ISE'),
(12, 'Kabir Malhotra',  'kabir.malhotra@gmail.com',  '9876543221', 'ME'),
(13, 'Tanvi Desai',     'tanvi.desai@gmail.com',     '9876543222', 'EEE'),
(14, 'Siddharth Rao',   'siddharth.rao@gmail.com',   '9876543223', 'ME'),
(15, 'Pooja Hegde',     'pooja.hegde@gmail.com',     '9876543224', 'BT'),
(16, 'Aman Gupta',      'aman.gupta@gmail.com',      '9876543225', 'CSE'),
(17, 'Ishita Banerjee', 'ishita.banerjee@gmail.com', '9876543226', 'ECE'),
(18, 'Harsh Patel',     'harsh.patel@gmail.com',     '9876543227', 'CSE'),
(19, 'Divya Nambiar',   'divya.nambiar@gmail.com',   '9876543228', 'ISE'),
(20, 'Rahul Kumar',     'rahul.kumar@gmail.com',     '9876543229', 'AIML'),
(21, 'Sanya Kapoor',    'sanya.kapoor@gmail.com',    '9876543230', 'BT'),
(22, 'Arnav Singh',     'arnav.singh@gmail.com',     '9876543231', 'AIML'),
(23, 'Lakshmi Pillai',  'lakshmi.pillai@gmail.com',  '9876543232', 'ECE'),
(24, 'Yash Mehta',      'yash.mehta@gmail.com',      '9876543233', 'EEE'),
(25, 'Zoya Khan',       'zoya.khan@gmail.com',       '9876543234', 'CSE');

INSERT INTO PARTICIPANT (Participant_ID, Name, Email, Phone, Department)
SELECT Participant_ID, Name, Email, Phone, Department
FROM PARTICIPANT_STAGING;

DROP TABLE PARTICIPANT_STAGING;


-- ---------------------------------------------------------------------
-- ORGANIZER (6)
-- ---------------------------------------------------------------------
INSERT INTO ORGANIZER (Organizer_ID, Name, Club, Phone, Email) VALUES
(1, 'Ananya Krishnan', 'Coding Club',         '9845012301', 'ananya.krishnan@festhub.edu'),
(2, 'Rithvik Shetty',  'Cultural Committee',  '9845012302', 'rithvik.shetty@festhub.edu'),
(3, 'Neha Bhat',       'AI & ML Club',        '9845012303', 'neha.bhat@festhub.edu'),
(4, 'Varun Reddy',     'Cybersecurity Club',  '9845012304', 'varun.reddy@festhub.edu'),
(5, 'Shreya Menon',    'Design Club',         '9845012305', 'shreya.menon@festhub.edu'),
(6, 'Kiran Kumar',     'Student Council',     '9845012306', 'kiran.kumar@festhub.edu');


-- ---------------------------------------------------------------------
-- JUDGE (6)
-- ---------------------------------------------------------------------
INSERT INTO JUDGE (Judge_ID, Name, Email, Phone, Expertise) VALUES
(1, 'Dr. Ramesh Iyer',  'ramesh.iyer@festhub.edu',  '9900112201', 'Algorithms and Competitive Programming'),
(2, 'Prof. Sunita Rao', 'sunita.rao@festhub.edu',   '9900112202', 'Software Engineering and Product Design'),
(3, 'Dr. Anil Mehta',   'anil.mehta@festhub.edu',   '9900112203', 'Data Science and Machine Learning'),
(4, 'Ms. Kavya Nair',   'kavya.nair@festhub.edu',   '9900112204', 'Music, Theatre and Public Speaking'),
(5, 'Mr. Deepak Sharma','deepak.sharma@festhub.edu','9900112205', 'Dance and Choreography'),
(6, 'Dr. Farah Ali',    'farah.ali@festhub.edu',    '9900112206', 'Cybersecurity');


-- ---------------------------------------------------------------------
-- TEAM (12) and TEAM_MEMBER  - max 5 members per team
-- Participants 17 and 20 are deliberately not in any team.
-- ---------------------------------------------------------------------
INSERT INTO TEAM (Team_ID, Team_Name, Event_ID) VALUES
(1,  'Code Warriors', 2),
(2,  'Debuggers',     2),
(3,  'Tech Titans',   2),
(4,  'Sonic Pulse',   4),
(5,  'Echo Chamber',  4),
(6,  'Null Pointers', 7),
(7,  'Root Access',   7),
(8,  'Pixel Perfect', 8),
(9,  'Rhythm Riders', 10),
(10, 'Data Wizards',  11),
(11, 'Insight Squad', 11),
(12, 'Gear Grinders', 12);

INSERT INTO TEAM_MEMBER (Team_ID, Participant_ID) VALUES
(1, 1), (1, 2), (1, 5),
(2, 4), (2, 8),
(3, 6), (3, 10),
(4, 11), (4, 12), (4, 13), (4, 14),
(5, 15), (5, 16),
(6, 3), (6, 18),
(7, 19), (7, 16),
(8, 9), (8, 12),
(9, 21), (9, 22), (9, 23), (9, 24), (9, 25),
(10, 3), (10, 7),
(11, 9), (11, 2),
(12, 13), (12, 14);


-- ---------------------------------------------------------------------
-- EVENT_ORGANIZER  - Robo Race (12) has no organizer yet
-- ---------------------------------------------------------------------
INSERT INTO EVENT_ORGANIZER (Event_ID, Organizer_ID) VALUES
(1, 1), (2, 1), (2, 6), (3, 1), (4, 2), (5, 2),
(6, 3), (7, 4), (8, 5), (9, 6), (10, 2), (10, 6), (11, 3);


-- ---------------------------------------------------------------------
-- EVENT_JUDGE  - Open Mic and AI/ML Workshop are not competitive;
--                Robo Race has no judge yet
-- ---------------------------------------------------------------------
INSERT INTO EVENT_JUDGE (Event_ID, Judge_ID) VALUES
(1, 1), (1, 2),
(2, 1), (2, 2), (2, 3),
(3, 1),
(4, 4), (4, 5),
(7, 6),
(8, 2),
(9, 4),
(10, 4), (10, 5),
(11, 3);


-- ---------------------------------------------------------------------
-- REGISTRATION (35)
-- Individual events: 1, 3, 5, 6, 9.  Team events: 2, 4, 7, 8, 10, 11, 12.
-- ---------------------------------------------------------------------
INSERT INTO REGISTRATION (Registration_ID, Event_ID, Participant_ID, Team_ID, Registration_Time, Status) VALUES
(1,  1,  1,    NULL, '2026-10-01 10:15:00', 'Confirmed'),
(2,  1,  4,    NULL, '2026-10-01 11:02:00', 'Confirmed'),
(3,  3,  2,    NULL, '2026-10-02 09:30:00', 'Pending'),
(4,  2,  NULL, 1,    '2026-10-02 14:10:00', 'Confirmed'),
(5,  2,  NULL, 2,    '2026-10-03 16:45:00', 'Confirmed'),
(6,  2,  NULL, 3,    '2026-10-04 12:00:00', 'Pending'),
(7,  3,  5,    NULL, '2026-10-04 18:20:00', 'Confirmed'),
(8,  1,  3,    NULL, '2026-10-03 09:05:00', 'Confirmed'),
(9,  1,  6,    NULL, '2026-10-03 13:40:00', 'Confirmed'),
(10, 1,  10,   NULL, '2026-10-05 08:55:00', 'Confirmed'),
(11, 1,  18,   NULL, '2026-10-05 10:10:00', 'Cancelled'),
(12, 3,  1,    NULL, '2026-10-05 11:30:00', 'Confirmed'),
(13, 3,  3,    NULL, '2026-10-05 12:00:00', 'Confirmed'),
(14, 3,  8,    NULL, '2026-10-06 09:45:00', 'Confirmed'),
(15, 3,  11,   NULL, '2026-10-06 10:20:00', 'Confirmed'),
(16, 3,  19,   NULL, '2026-10-06 15:00:00', 'Confirmed'),
(17, 3,  20,   NULL, '2026-10-07 09:10:00', 'Confirmed'),
(18, 4,  NULL, 4,    '2026-10-03 17:00:00', 'Confirmed'),
(19, 4,  NULL, 5,    '2026-10-04 19:30:00', 'Confirmed'),
(20, 5,  12,   NULL, '2026-10-06 20:00:00', 'Confirmed'),
(21, 5,  15,   NULL, '2026-10-07 08:30:00', 'Confirmed'),
(22, 5,  21,   NULL, '2026-10-08 10:00:00', 'Pending'),
(23, 6,  3,    NULL, '2026-10-02 10:00:00', 'Confirmed'),
(24, 6,  7,    NULL, '2026-10-02 10:30:00', 'Confirmed'),
(25, 6,  9,    NULL, '2026-10-03 11:00:00', 'Confirmed'),
(26, 6,  22,   NULL, '2026-10-04 09:00:00', 'Confirmed'),
(27, 6,  23,   NULL, '2026-10-05 09:30:00', 'Cancelled'),
(28, 7,  NULL, 6,    '2026-10-05 14:00:00', 'Confirmed'),
(29, 7,  NULL, 7,    '2026-10-06 14:30:00', 'Confirmed'),
(30, 8,  NULL, 8,    '2026-10-07 16:00:00', 'Confirmed'),
(31, 9,  16,   NULL, '2026-10-06 17:00:00', 'Confirmed'),
(32, 9,  24,   NULL, '2026-10-07 18:00:00', 'Confirmed'),
(33, 10, NULL, 9,    '2026-10-06 12:00:00', 'Confirmed'),
(34, 11, NULL, 10,   '2026-10-07 13:00:00', 'Confirmed'),
(35, 11, NULL, 11,   '2026-10-08 11:15:00', 'Pending');


-- ---------------------------------------------------------------------
-- SCORE (34) - one row per judge per confirmed registration
-- (registration 10 has no score from judge 2 yet)
-- ---------------------------------------------------------------------
INSERT INTO SCORE (Event_ID, Judge_ID, Registration_ID, Score, Remarks, Scored_At) VALUES
-- Coding Contest
(1, 1, 1,  88, 'Clean, efficient solutions',          '2026-10-10 13:30:00'),
(1, 2, 1,  84, NULL,                                  '2026-10-10 13:45:00'),
(1, 1, 2,  76, NULL,                                  '2026-10-10 13:30:00'),
(1, 2, 2,  80, NULL,                                  '2026-10-10 13:45:00'),
(1, 1, 8,  92, 'Solved the hardest problem',          '2026-10-10 13:30:00'),
(1, 2, 8,  90, NULL,                                  '2026-10-10 13:45:00'),
(1, 1, 9,  69, NULL,                                  '2026-10-10 13:30:00'),
(1, 2, 9,  73, NULL,                                  '2026-10-10 13:45:00'),
(1, 1, 10, 81, NULL,                                  '2026-10-10 13:30:00'),
-- Hackathon
(2, 1, 4,  85, NULL,                                  '2026-10-12 10:00:00'),
(2, 2, 4,  88, 'Polished demo',                       '2026-10-12 10:05:00'),
(2, 3, 4,  90, NULL,                                  '2026-10-12 10:10:00'),
(2, 1, 5,  91, 'Most innovative idea',                '2026-10-12 10:00:00'),
(2, 2, 5,  86, NULL,                                  '2026-10-12 10:05:00'),
(2, 3, 5,  89, NULL,                                  '2026-10-12 10:10:00'),
-- Tech Quiz (two participants tie on 85)
(3, 1, 7,  70, NULL,                                  '2026-10-10 15:45:00'),
(3, 1, 12, 85, NULL,                                  '2026-10-10 15:45:00'),
(3, 1, 13, 95, NULL,                                  '2026-10-10 15:45:00'),
(3, 1, 14, 85, NULL,                                  '2026-10-10 15:45:00'),
(3, 1, 15, 60, NULL,                                  '2026-10-10 15:45:00'),
(3, 1, 16, 78, NULL,                                  '2026-10-10 15:45:00'),
(3, 1, 17, 88, NULL,                                  '2026-10-10 15:45:00'),
-- Battle of Bands
(4, 4, 18, 89, NULL,                                  '2026-10-10 21:45:00'),
(4, 5, 18, 84, NULL,                                  '2026-10-10 21:50:00'),
(4, 4, 19, 91, 'Outstanding vocals',                  '2026-10-10 21:45:00'),
(4, 5, 19, 87, NULL,                                  '2026-10-10 21:50:00'),
-- Capture The Flag
(7, 6, 28, 94, 'Captured all flags',                  '2026-10-11 18:15:00'),
(7, 6, 29, 82, NULL,                                  '2026-10-11 18:15:00'),
-- UI/UX Designathon
(8, 2, 30, 90, NULL,                                  '2026-10-12 17:15:00'),
-- Debate Championship
(9, 4, 31, 83, NULL,                                  '2026-10-10 18:15:00'),
(9, 4, 32, 79, NULL,                                  '2026-10-10 18:15:00'),
-- Dance Battle
(10, 5, 33, 93, 'Tight synchronisation',              '2026-10-12 20:15:00'),
(10, 4, 33, 90, NULL,                                 '2026-10-12 20:15:00'),
-- Datathon
(11, 3, 34, 87, NULL,                                 '2026-10-12 15:20:00');


-- ---------------------------------------------------------------------
-- EXPENSE (25) - Hackathon (2) has spent more than its budget
-- ---------------------------------------------------------------------
INSERT INTO EXPENSE (Event_ID, Description, Category, Amount, Expense_Date) VALUES
(1,  'Cash prizes for top 3',            'Prizes',     9000.00, '2026-10-10'),
(1,  'Online judge server rental',       'Equipment',  3000.00, '2026-10-08'),
(2,  'Meals and snacks for 24 hours',    'Food',      22000.00, '2026-10-11'),
(2,  'Prize pool',                       'Prizes',    30000.00, '2026-10-12'),
(2,  'Extension boards and Wi-Fi boost', 'Equipment',  6500.00, '2026-10-10'),
(2,  'Posters and social media ads',     'Marketing',  4000.00, '2026-10-03'),
(3,  'Gift vouchers for winners',        'Prizes',     3000.00, '2026-10-10'),
(3,  'Quiz buzzer system',               'Equipment',  1200.00, '2026-10-09'),
(4,  'Sound system and stage lights',    'Equipment', 18000.00, '2026-10-10'),
(4,  'Prize money',                      'Prizes',    15000.00, '2026-10-10'),
(4,  'Stage setup crew',                 'Logistics',  4500.00, '2026-10-10'),
(5,  'Microphones and speakers',         'Equipment',  2200.00, '2026-10-10'),
(6,  'Cloud GPU credits',                'Equipment',  5000.00, '2026-10-09'),
(6,  'Refreshments',                     'Food',       3500.00, '2026-10-11'),
(7,  'Prize money',                      'Prizes',    10000.00, '2026-10-11'),
(7,  'CTF platform hosting',             'Equipment',  2500.00, '2026-10-07'),
(8,  'Prizes and design tool licences',  'Prizes',     7500.00, '2026-10-12'),
(9,  'Trophies',                         'Prizes',     6000.00, '2026-10-10'),
(10, 'Prize money',                      'Prizes',    20000.00, '2026-10-12'),
(10, 'Stage and lighting',               'Logistics',  6000.00, '2026-10-12'),
(10, 'Promotional videos',               'Marketing',  3500.00, '2026-10-05'),
(11, 'Prize money',                      'Prizes',     9000.00, '2026-10-12'),
(11, 'Lunch for participants',           'Food',       4000.00, '2026-10-12'),
(12, 'Obstacle course materials',        'Logistics',  5000.00, '2026-10-09'),
(12, 'Spare motors and batteries',       'Equipment',  3200.00, '2026-10-09');


-- ---------------------------------------------------------------------
-- INTERESTS (11)
-- Entries 2 and 5 are spelled exactly as they currently appear in
-- FestHub_1 ('Artificial Inteligence', 'Datascience'); 04_dml.sql
-- corrects them with UPDATE.
-- ---------------------------------------------------------------------
INSERT INTO INTERESTS (Interest_ID, Interest_Name) VALUES
(1,  'Coding'),
(2,  'Artificial Inteligence'),
(3,  'Web Development'),
(4,  'Cybersecurity'),
(5,  'Datascience'),
(6,  'Music'),
(7,  'Dance'),
(8,  'Public Speaking'),
(9,  'UI/UX Design'),
(10, 'Robotics'),
(11, 'Quizzing');


-- ---------------------------------------------------------------------
-- EVENT_INTEREST - which interests each event serves
-- ---------------------------------------------------------------------
INSERT INTO EVENT_INTEREST (Event_ID, Interest_ID) VALUES
(1, 1), (2, 1), (2, 3), (3, 11), (3, 1), (4, 6), (5, 6), (5, 8),
(6, 2), (6, 5), (7, 4), (7, 1), (8, 9), (8, 3), (9, 8), (10, 7),
(11, 5), (11, 2), (12, 10);


-- ---------------------------------------------------------------------
-- PARTICIPANT_INTEREST - interests selected by each participant
-- ---------------------------------------------------------------------
INSERT INTO PARTICIPANT_INTEREST (Participant_ID, Interest_ID) VALUES
(1, 1), (1, 4),   (2, 3), (2, 1),   (3, 2), (3, 5),   (4, 4), (4, 2),
(5, 1), (5, 5),   (6, 3), (6, 5),   (7, 2), (7, 5),   (8, 1), (8, 11),
(9, 9), (9, 3), (9, 5),             (10, 2), (10, 1), (11, 6), (11, 11),
(12, 6), (12, 9), (13, 10), (13, 6), (14, 10),        (15, 6), (15, 8),
(16, 8), (16, 6), (17, 6),          (18, 4), (18, 1), (19, 4), (19, 11),
(20, 1), (20, 11), (21, 7), (21, 8), (22, 7), (22, 2), (23, 7),
(24, 8), (24, 7), (25, 7), (25, 9);


-- ---------------------------------------------------------------------
-- USER_ACCOUNT (7)
-- Demo password for every account: FestHub@123
-- Stored only as a bcrypt hash (cost 10), the format bcryptjs in the
-- Next.js app produces and checks.
-- ---------------------------------------------------------------------
INSERT INTO USER_ACCOUNT (Email, Username, Password_Hash, Role, Participant_ID, Organizer_ID) VALUES
('admin@festhub.edu',           'admin',         '$2a$10$Pb54kFNf2Cxr2WCss4QSRegMJ.wfTVHDqFpJcGBllv4qC6Ngyg7N2', 'ADMIN',     NULL, NULL),
('ananya.krishnan@festhub.edu', 'ananya.k',      '$2a$10$sumXeP0q7mFTaJWNw0T2puxdqMjcY11kiVg/rQItQSgkfS81x2pk2', 'ORGANIZER', NULL, 1),
('rithvik.shetty@festhub.edu',  'rithvik.s',     '$2a$10$uyET5uoI5IuUBKQXLrYj6.UqmhnEfh5tZrc5sRCV61EqGa4JoZ79m', 'ORGANIZER', NULL, 2),
('rahul@gmail.com',             'rahul.sharma',  '$2a$10$MGMQ4iO4nm4cJ2CDf4efsOAKPWDeVlIm757460YL.nmOpUgtVC.k.', 'STUDENT',   1,    NULL),
('karthik@gmail.com',           'karthik.kumar', '$2a$10$Z1m.TWqIP.W6.dlDAeOfQerMO5RdW0d2mtwiTWq2DBvMVqz27eqQS', 'STUDENT',   3,    NULL),
('sneha@gmail.com',             'sneha.reddy',   '$2a$10$4NQFlJFB2xAuElYIZGQOx.3Boa4HH75z66DUyZGdC6/nJqkWY.hGG', 'STUDENT',   4,    NULL),
('aditi.kulkarni@gmail.com',    'aditi.k',       '$2a$10$930WFN4df5LnkESeN6HLJuEMgOKUHqXxw2KNzswVAEMWZrqYNf/q2', 'STUDENT',   9,    NULL);


-- ---------------------------------------------------------------------
-- Evidence: row count of every table
-- ---------------------------------------------------------------------
SELECT 'VENUE' AS Table_Name, COUNT(*) AS Row_Count FROM VENUE
UNION ALL SELECT 'EVENT',                COUNT(*) FROM EVENT
UNION ALL SELECT 'PARTICIPANT',          COUNT(*) FROM PARTICIPANT
UNION ALL SELECT 'ORGANIZER',            COUNT(*) FROM ORGANIZER
UNION ALL SELECT 'JUDGE',                COUNT(*) FROM JUDGE
UNION ALL SELECT 'TEAM',                 COUNT(*) FROM TEAM
UNION ALL SELECT 'TEAM_MEMBER',          COUNT(*) FROM TEAM_MEMBER
UNION ALL SELECT 'EVENT_ORGANIZER',      COUNT(*) FROM EVENT_ORGANIZER
UNION ALL SELECT 'EVENT_JUDGE',          COUNT(*) FROM EVENT_JUDGE
UNION ALL SELECT 'REGISTRATION',         COUNT(*) FROM REGISTRATION
UNION ALL SELECT 'SCORE',                COUNT(*) FROM SCORE
UNION ALL SELECT 'EXPENSE',              COUNT(*) FROM EXPENSE
UNION ALL SELECT 'INTERESTS',            COUNT(*) FROM INTERESTS
UNION ALL SELECT 'EVENT_INTEREST',       COUNT(*) FROM EVENT_INTEREST
UNION ALL SELECT 'PARTICIPANT_INTEREST', COUNT(*) FROM PARTICIPANT_INTEREST
UNION ALL SELECT 'USER_ACCOUNT',         COUNT(*) FROM USER_ACCOUNT;


-- #####################################################################
-- PART 4 – fixes
-- #####################################################################

-- Spelling mistakes carried over from the first FestHub_1 (Stage 2 U1).
UPDATE INTERESTS SET Interest_Name = 'Artificial Intelligence' WHERE Interest_Name = 'Artificial Inteligence';
UPDATE INTERESTS SET Interest_Name = 'Data Science'            WHERE Interest_Name = 'Datascience';

-- The app inserts new rows WITHOUT an id and reads the new id back
-- (insertId), so these ids must be AUTO_INCREMENT. MySQL refuses to
-- MODIFY a column that other tables' foreign keys point at while FK
-- checks are on (error 1833); the type stays INT, so turning the checks
-- off for these statements is safe. After the seed rows, the counter
-- continues from MAX(id) + 1 automatically.
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE VENUE        MODIFY Venue_ID        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE EVENT        MODIFY Event_ID        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE PARTICIPANT  MODIFY Participant_ID  INT NOT NULL AUTO_INCREMENT;
ALTER TABLE ORGANIZER    MODIFY Organizer_ID    INT NOT NULL AUTO_INCREMENT;
ALTER TABLE JUDGE        MODIFY Judge_ID        INT NOT NULL AUTO_INCREMENT;
ALTER TABLE TEAM         MODIFY Team_ID         INT NOT NULL AUTO_INCREMENT;
ALTER TABLE REGISTRATION MODIFY Registration_ID INT NOT NULL AUTO_INCREMENT;
SET FOREIGN_KEY_CHECKS = 1;

-- Check: 7 rows, all auto_increment
SELECT TABLE_NAME, COLUMN_NAME, EXTRA
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_KEY = 'PRI' AND EXTRA LIKE '%auto_increment%'
  AND TABLE_NAME IN ('VENUE','EVENT','PARTICIPANT','ORGANIZER','JUDGE','TEAM','REGISTRATION')
ORDER BY TABLE_NAME;

SELECT 'FestHub_1 is ready. Next: run sql/09, 10, 11, 12, 20, 21.' AS Done;
