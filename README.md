# SDICMS — Server

Smart Digital Investigation and Case Management System.
Node.js + Express + MySQL, MVC, with the frontend served from the same origin.

---

## What you need first

| | |
|---|---|
| **Node.js 18 or newer** | `node -v` to check. [nodejs.org](https://nodejs.org) |
| **MySQL 8** | Or MariaDB 10.6+. XAMPP, WAMP and MAMP all work. |

---

## Setup — five commands

```bash
cd sdicms-server

# 1. install dependencies
npm install

# 2. create your environment file
cp .env.example .env          # Windows: copy .env.example .env
```

Now open `.env` and set two things:

**Your MySQL password**

```
DB_PASSWORD=whatever_your_mysql_root_password_is
```

**Two JWT secrets.** Run this twice and paste a different result into each:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```
JWT_ACCESS_SECRET=paste_the_first_one_here
JWT_REFRESH_SECRET=paste_the_second_one_here
```

Then:

```bash
# 3. create the database and all tables
npm run db:setup

# 4. load the sample data
npm run db:seed

# 5. start it
npm run dev
```

Open **http://localhost:3000**.

---

## Sign in

Every seeded account uses the password **`Demo1234!`**

| Role | Email |
|---|---|
| Administrator | `m.khumalo@sdicms.gov.za` |
| Station Commander | `b.zulu@sdicms.gov.za` |
| Detective | `s.adeyemi@sdicms.gov.za` |
| Police Officer | `l.mahlangu@sdicms.gov.za` |

These are real bcrypt hashes in the `users` table, checked on the server. The
role buttons on the login screen fill in the matching email — the role itself
comes from the database, not from the button.

---

## The three things you asked for

### Loading new users

Sign in as the Administrator → **Users & permissions** → **Add user**.

The account is written to the `users` table with a bcrypt-hashed temporary
password and `must_change_password = 1`. The temporary password is shown to
you **once**, to be handed over in person — it is never emailed and never
stored in plain text. At their first sign-in the user is taken straight to
the password-change dialog.

You can also reset any account: `POST /api/v1/users/:id/reset-password`
issues a new temporary password and revokes every session that account holds.

### Loading documents

Open any docket → **Documents** tab → **Upload document**.

The file is hashed with SHA-256 before anything else touches it, written to
`storage/documents/YYYY/MM/` under a generated filename, and recorded in the
`documents` table. It is **not** served statically: retrieval goes through an
authenticated controller that recomputes the digest first and refuses the
download if the bytes on disk no longer match what was recorded. Every access
writes an audit entry.

Evidence works the same way through **Log exhibit**, with the addition of a
custody chain.

### Changing passwords

Profile menu → **Change password**, or Settings → **Change password**.

Requires the current password — holding a session is not the same as knowing
the credential. On success every *other* refresh token for that account is
revoked, so a password change signs out every other device immediately.

Policy: at least 10 characters, with upper case, lower case and a digit.
Reusing the current password is rejected.

---

## What the server does that the frontend cannot

The interface hides buttons a role may not use. The server *enforces* it.
These are the checks that matter:

**The case state machine is server-side.** `Under investigation` can only
become `Awaiting forensics` or `Pending approval`, and only a commander can
approve a closure. Posting a status change directly to the API is rejected
with an explanation of which moves are actually legal.

**Station scoping is in the SQL, not the UI.** Every docket query carries an
ownership predicate built from the signed-in user. A commander at Hillbrow
cannot read Sandton's dockets by editing a URL.

**The audit chain is real SHA-256.** Each entry hashes the previous entry's
digest plus its own canonical payload. `GET /api/v1/audit/verify` recomputes
the whole chain and reports the first entry that fails. Database triggers
make `UPDATE` and `DELETE` on `audit_log` and `custody_chain` fail outright —
even from a MySQL client with root credentials.

**Chain breaks lock an exhibit.** An exhibit whose custody chain fails
recomputation cannot be verified, sealed or transferred. The system will not
let an officer certify a chain it cannot itself confirm. Seeded exhibit
`EX-2026-0448` carries a deliberate break so you can see this.

**Login is rate-limited and accounts lock.** Five failures locks the account
for fifteen minutes. A wrong email and a wrong password produce the same
message and take about the same time, so the endpoint cannot be used to find
out which accounts exist.

**Refresh tokens rotate.** Each use revokes the presented token and issues a
new one. Presenting a revoked token kills every session on that account —
reuse is the signature of a stolen token.

---

## API reference

All routes are under `/api/v1`. Everything except `/health` and `/auth/*`
needs `Authorization: Bearer <accessToken>`.

### Auth
```
POST   /auth/login              { email, password }
POST   /auth/refresh            (uses the httpOnly cookie)
POST   /auth/logout
GET    /auth/me
POST   /auth/change-password    { currentPassword, newPassword, confirmPassword }
```

### Bootstrap
```
GET    /bootstrap               everything the client needs, in one call
```

### Cases
```
GET    /cases                   ?status= &priority= &overdue=true &q=
GET    /cases/:number
POST   /cases                   { title, category, priority, description, location, complainant* }
PATCH  /cases/:number/status    { status, reason }
PATCH  /cases/:number/assign    { detectiveId }
POST   /cases/:number/notes     { body }
```

### Evidence
```
GET    /evidence
GET    /evidence/:number
GET    /evidence/:number/file           digest re-verified before streaming
POST   /evidence                        multipart: file + caseNumber, label, evidenceType, storageLocation
POST   /evidence/:number/custody        { toParty, action }
PATCH  /evidence/:number/verify
```

### Documents
```
GET    /documents
GET    /documents/:id/file
POST   /documents                       multipart: file + caseNumber, title, docType
```

### People, users, stations
```
GET    /suspects            POST /suspects
GET    /statements          POST /statements        PATCH /statements/:id/sign
GET    /users               POST /users             PATCH /users/:id
POST   /users/:id/reset-password
GET    /stations            POST /stations
```

### Audit and AI
```
GET    /audit                   ?limit= &action= &target=
GET    /audit/verify            recomputes the whole chain
GET    /ai/insights
PATCH  /ai/insights/:id         { disposition: "accepted" | "dismissed" }
POST   /ai/ask                  { question }
```

Every response has the same shape:

```json
{ "success": true, "data": ... }
{ "success": false, "error": { "message": "...", "details": { "field": "..." } } }
```

---

## Structure

```
server.js                 binds the port
src/app.js                the Express instance (no listener, so tests can import it)

src/config/               env, database pool, logger, permission matrix, constants
src/middleware/           authenticate, authorize, validate, upload, rate limits, errors
src/routes/               URL → controller, with validation rules
src/controllers/          parse, delegate, format — no business logic
src/services/             all business rules live here
src/repositories/         the only place SQL exists
src/utils/                errors, JWT, hash chaining, presenters

database/schema.sql       18 tables with indexes and constraints
database/triggers.sql     append-only guarantees on audit_log and custody_chain
database/setup.js         creates the database and applies both
database/seed.js          sample data with real hash chains

public/                   the frontend, served from this origin
storage/                  evidence and documents — outside the web root
```

---

## The frontend runs either way

`public/assets/js/store.js` detects its situation:

- **Served by this server with a session** → every read comes from one
  `/bootstrap` call, every write goes to the API.
- **Opened straight from disk** → the same seed data runs in memory, so the
  interface still demonstrates fully with no Node and no MySQL.

Reads are synchronous from a cache; writes always return a Promise. Calling
code never has to know which mode it is in. That is why the same `views-*.js`
files serve both.

---

## When something goes wrong

**`ER_ACCESS_DENIED_ERROR` on `npm run db:setup`**
`DB_USER` / `DB_PASSWORD` in `.env` do not match your MySQL. On XAMPP the
default is user `root` with an empty password.

**`ECONNREFUSED 127.0.0.1:3306`**
MySQL is not running. Start it from XAMPP, Services, or `sudo service mysql start`.

**Login says "credentials do not match" for a seeded account**
Run `npm run db:seed` again — the hashes are generated at seed time from
`BCRYPT_ROUNDS`, so changing that value in `.env` invalidates them.

**"Too many sign-in attempts"**
The rate limiter. Wait fifteen minutes, or restart the server to clear it.

**An account is locked**
Five failed attempts. Wait fifteen minutes, or have an administrator reset
the password, which clears the lock.

**Uploads fail with 413**
The file exceeds `MAX_UPLOAD_MB`. Raise it in `.env` and restart.

**Port 3000 in use**
Change `PORT` in `.env`.

---

## Not built yet

Honest list, so nothing here is a surprise:

- **No multi-factor authentication.** The UI says "not enrolled" because it
  genuinely is not. For a system holding investigation data this is the first
  thing to add after the marking.
- **No automated tests.** The structure supports them — `app.js` exports
  without a listener specifically so Supertest can import it — but none are
  written.
- **The copilot is heuristic, not a language model.** Every suggestion is
  derived from a real query against real rows. A model provider slots in
  behind the same interface in `src/services/ai.service.js`, with the
  redaction step already written.
- **No email.** Temporary passwords are displayed once for hand-over.
- **HTTPS is assumed to terminate in front of this.** Cookies only set the
  `secure` flag when `NODE_ENV=production`.
