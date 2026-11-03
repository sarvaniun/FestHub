# Security checks (#26) – evidence for report §14

Run these with the app running (`npm run dev`) on a freshly rebuilt database
(`SOURCE sql/run_all.sql;`). Take a screenshot of each result.
On Windows, use **Git Bash**. `curl` is built in.

## 1. Every query is parameterized

All SQL goes through `rows()`, `one()` or `exec()` in `lib/sql.ts` with `?` placeholders. The
values travel separately from the SQL text, so user input can never become SQL.

Find any place where SQL text is built with `${...}`:

```bash
grep -rn --include=*.ts '\${' app/api lib | grep -iE "select|insert|update|delete|where" 
```

Every hit only inserts **fixed text written in our code**, never user input. For example:

- `WHERE` clauses chosen from a fixed list (`e.Event_Type = ?`)
- `SET Name = ?, Phone = ?` built from a fixed column map
- shared SQL fragments such as `SEATS_TAKEN_SQL`

The user's values still go in as `?` parameters. Say exactly this in the report.

## 2. SQL injection on login fails

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"admin' OR '1'='1\",\"password\":\"' OR '1'='1\"}"
```

Expected: `HTTP/1.1 401` with `{"error":"Invalid email/username or password"}`.
The whole string is compared as a *value* (no user is called `admin' OR '1'='1`), and the
password is checked with bcrypt, not in SQL.

## 3. A student calling an Admin route gets 403

```bash
# log in as a student and keep the cookie
curl -s -c student.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"rahul.sharma","password":"FestHub@123"}'

# try admin-only routes with that cookie
curl -i -b student.txt http://localhost:3000/api/reports/readiness
curl -i -b student.txt -X DELETE http://localhost:3000/api/events/1
```

Expected: `HTTP/1.1 403` with `{"error":"Forbidden"}` for both.

No cookie at all gives `401 Not authenticated`:

```bash
curl -i http://localhost:3000/api/reports/readiness
```

In the browser, logged in as the student, open `http://localhost:3000/admin/overview`. The
proxy (`proxy.ts`) sends you back to `/student/dashboard`.

## 4. No secrets in the code or Git history

```bash
git ls-files | grep -i "\.env"          # only .env.example may appear
git log --all -p | grep -iE "AUTH_SECRET=|DB_PASSWORD=|PG_PASSWORD=" | grep -v "replace_with\|change_me"
```

Expected: the first command shows only `.env.example`; the second prints nothing.
Passwords are stored only as bcrypt hashes (`USER_ACCOUNT.Password_Hash`); show this:

```sql
SELECT Username, LEFT(Password_Hash, 20) AS Hash_Start FROM USER_ACCOUNT;
```

## 5. Database-level checks (one screenshot each)

| Check | How |
|---|---|
| Duplicate registration | Register twice for Coding Contest as the same student. The second time gives 409 (`uq_reg_event_participant`). |
| Wrong registration type | `CALL RegisterParticipant(2, 7);` → trigger message (Hackathon is a Team event). |
| Venue clash | Create an event in Seminar Hall 1 on 10 Oct 15:30–16:30 → trigger `trg_event_no_venue_clash_insert`. |
| Wrong judge | `/organizer/scores` → "Show all judges" → pick a judge not on the event → `fk_score_event_judge`. |
| Role link CHECK | `UPDATE USER_ACCOUNT SET Role = 'ADMIN' WHERE Username = 'rahul.sharma';` → `chk_user_role_link` (an admin cannot have a Participant_ID). |
