# NoteShare

A note-sharing application with expiring links, optional access keys, and one-time access. Owners can revoke access to their notes.

Built as a MERN/PERN Developer POC using Next.js, TypeScript, Hono, PostgreSQL, Prisma, Tailwind CSS, and shadcn/ui.

Live application: https://noteshare-5tt4.vercel.app
Repository: https://github.com/hrishabhhh/noteshare

## Features

- Registration, login, and logout
- Create notes - title, content, expiry, share type, and access type
- Public (no password) and protected (randomly generated access key) share links

- One-time access and time-based access

- Note owner sees note details, view count, and revokes share links

- Atomic successful-view count

- PostgreSQL rate limiting

## Tech Stack

| Layer    | Technology                            |
| -------- | ------------------------------------- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling  | Tailwind CSS, shadcn/ui               |
| API      | Hono inside a Next.js Route Handler   |

| Database | PostgreSQL hosted on Neon |
| ORM | Prisma 7 |
| Validation | Zod |
| Password hashing | bcryptjs |
| Authentication | Database sessions with HttpOnly cookies |
| Hosting | Vercel |
Versions of dependencies are listed in `package.json` and `package-lock.json`.

## Local Setup

### Prerequisites

- Node.js 22.12+ in the Node 22 release line, or Node.js 24

- npm
- PostgreSQL database
- For Neon - its pooled and direct connection strings
  Use a separate development database if possible.

### 1. Clone and install

```bash
git clone https://github.com/hrishabhhh/noteshare.git
cd noteshare
npm ci
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the project root.
Git Bash, macOS, or Linux:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Set these values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@POOLED_HOST/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST/DATABASE?sslmode=require"
APP_URL="http://localhost:3000"
```

`DATABASE_URL` - application database connection, use Neon's pooled URL
`DIRECT_URL` - direct connection for Prisma CLI configuration
`APP_URL` - trusted application origin and base URL for generated links
For a locally installed PostgreSQL without pooler, both database variables can use the same valid connection string. Do not remove SSL parameters required by the database provider.

The `APP_URL` value must match the scheme and hostname in the browser. For example, `localhost` and `127.0.0.1` are different origins.
Never commit real database credentials.

### 3. Apply migrations and generate the client

```bash
npx prisma migrate deploy --config ./prisma7.config.ts
npx prisma generate --config ./prisma7.config.ts
```

This applies the committed migrations to your database and generates the Prisma client.

### 4. Start development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Register a new account on `/register`.

### 5. Verify connectivity

```text
GET /api/health
GET /api/health/db
```

The first checks API availability. The second performs a database query.

### Production build

```bash
npm run build
npm start
```

The build script generates Prisma Client before building Next.js.
To test local production-mode authentication, use HTTPS: session cookies have the `Secure` flag when `NODE_ENV` is `production`. `npm run dev` builds for local development.

## Application Pages

| Page             | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `/login`         | Log in                                          |
| `/register`      | Create an account                               |
| `/notes/new`     | Create a note and receive sharing details       |
| `/notes/[id]`    | Owner-only note details, view count, revocation |
| `/share/[token]` | Public or protected recipient access            |

There is no notes-list dashboard in this POC. Keep the owner-page URL if you want to get back to any particular note.

## Database Schema

The full schema is in `prisma/schema.prisma`. Versioned SQL migrations are in `prisma/migrations/`.
| Model | Main fields | Purpose |
|---|---|---|
| `User` | `id`, `email`, `passwordHash`, `createdAt` | User accounts |
| `Session` | `id`, `tokenHash`, `userId`, `expiresAt`, `createdAt` | Authenticated sessions |
| `Note` | `id`, `ownerId`, `title`, `content`, `createdAt` | Note content and ownership |
| `ShareLink` | `noteId`, `tokenHash`, `accessKeyHash`, `shareType`, `accessType`, `expiresAt`, `consumedAt`, `revokedAt`, `viewCount` | Sharing rules and access state |
| `RateLimit` | `key`, `hits`, `resetAt` | Shared request-rate counters |

### Relationships and constraints

- A user can have multiple notes and sessions.
- Each note belongs to one user.
- Each note has at most one share link, enforced by a unique `noteId`.
- Emails, session-token hashes, and share-token hashes - unique.
- Foreign keys preserve relationships between records.
- Note and share-link creation happen together in a transaction.
- Date fields use PostgreSQL `timestamptz`.

### Sharing options

```text
ShareType: ONE_TIME | TIME_BASED
AccessType: PUBLIC  | PASSWORD
```

## Authentication and Ownership

bcrypt hashes account passwords at cost factor 12 when creating an account. Passwords must have at least 12 characters, and not exceed bcrypt's 72-byte limit.
Upon a successful login:

1. Generate a random 32-byte session token
2. Store its SHA-256 hash in the `Session` table
3. Write the plaintext token to an HttpOnly cookie
4. Subsequent authenticated requests will hash the cookie token and find the session
5. Sessions expire after seven days
   Cookies use:

- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production
- Path `/`
  Logout deletes the database session and the cookie.
  The server infers note ownership from an authenticated session. It does not trust the client-provided owner ID. Reading or revoking another user's note is denied.

## Share Link Flow

1. An authenticated user submits the note and sharing options
2. Server validates request and requires a future expiry
3. Server generates a random share token and, if requested, an access key
4. Server saves the note and share link
5. The response includes a URL in this format:

```text
https://APP_ORIGIN/share/TOKEN
```

6. Recipient page requests link details without content
7. Public recipient clicks Open note
8. Protected recipient provides access key and clicks Unlock note
9. Server atomically validates access, updates state, and returns content when successful
   Recipients do not need an account.
   Note that a GET request never consumes a share. Making the unlocking action explicit reduces unintentional consumption by link previewers and bots; it does not prevent an automated client from forging a POST request.

## Token and Access-Key Generation

Secrets are generated on the server with Node.js `crypto.randomBytes`.
| Secret | Randomness | Encoding |
|---|---|---|
| Share token | 32 bytes / 256 bits | Base64url |
| Protected-link access key | 16 bytes / 128 bits | Base64url |
| Session token | 32 bytes / 256 bits | Hexadecimal |
Share tokens and access keys are stored as their SHA-256 hashes.
This is acceptable because:

- These secrets are high-entropy, random values
- SHA-256 is used as a cryptographic hash, not a cipher
- SHA-256 is applied to the full random output
  User-chosen account passwords are managed separately with bcrypt.
  The original token and access key are only returned during creation, and not persisted after the creation page refreshes or leaves.
  Protected-link access keys are sent in the request body, rather than appearing in the URL.

## Expiry Logic

Share links of either type honor the chosen expiry time.

- One-time: access denied after first successful open/unlock or expiry time, whichever comes first
- Time-based: successful access until expiry time, or revocation
  The frontend parses the selected date/time in its local timezone and converts to UTC before submission.
  The actual decision compares `expiresAt` to PostgreSQL's `clock_timestamp()`.
  No cron job is necessary to invalidate expired links.
  The owner page shows a snapshot of the link state and view count. Refreshing shows updated values.

## Revocation Logic

The owner can revoke a link with:

```text
POST /api/notes/:id/revoke
```

The server verifies ownership and sets `revokedAt`. Access queries require `revokedAt IS NULL`.
Revocation:

- Does not alter the owner's note
- Denies further successful access attempts
- Does not count toward the view count
- Is idempotent - repeated revocation requests succeed
- Does not remove content that has been delivered to a recipient
  Revocation and opening share the same PostgreSQL row. If a revocation request and access attempt race, the later request will see the changed row and deny access.

## View Count Logic

| Event                       | Count change |
| --------------------------- | -----------: |
| Successful public open      |           +1 |
| Successful protected unlock |           +1 |
| Wrong or missing access key |            0 |
| Expired link                |            0 |
| Revoked link                |            0 |
| Already-used one-time link  |            0 |
| Link-status lookup          |            0 |
| Owner viewing their note    |            0 |
| Rate-limited request        |            0 |

Counts represent successful access requests, not unique visitors.
A successful access means the server granted access, through the database operation. The server cannot prove that the recipient read the note or received the response after a network error.

## Race-Condition Handling

The share-opening service uses one parameterized PostgreSQL statement.
The conditional `UPDATE`:

1. Matches the token hash
2. Requires the link not to be revoked
3. Validates the expiry with the database clock
4. Requires the link to be unused for one-time shares
5. Verifies the access-key hash for protected links
6. Increments `viewCount` (`viewCount + 1`)
7. Sets `consumedAt` for one-time links
8. Returns the note reference when the update succeeds
   A common table expression joins the granted result to the note and returns its content.
   When other requests update the same row, PostgreSQL serializes the conflicting updates and re-checks the condition against the changed row. After one request consumes a one-time link, subsequent requests cannot satisfy the unused condition.
   This implementation does not explicitly use a JavaScript lock or a "check, then update" sequence.

## Rate Limiting

Rate-limit counters are stored in the database and modified atomically. They are available to all instances of the application.
| Operation | Limit |
|---|---|
| Login | 10 requests per 60 seconds |
| Registration | 5 requests per 600 seconds |
| Share open/unlock | 30 requests per 60 seconds |
This limit applies to successful and unsuccessful attempts.
Blocked requests reply with `429` and a `Retry-After` header. If the limiter's database operation fails, the request is rejected with `503`.
On Vercel, the implementation uses the client IP header provided by the platform. Outside of that trusted deployment environment, requests use a shared fallback bucket rather than trusting arbitrary client-supplied headers.
Limitations:

- Users behind the same public IP share a limit
- Per-IP limits do not stop a distributed attack
- Fixed time windows allow bursts at window boundaries
- All requests go through PostgreSQL before being rejected
- Deploying behind another hosting provider requires reviewing client-IP extraction
  Inactive counters can be cleaned up periodically:

```sql
DELETE FROM "RateLimit"
WHERE "resetAt" < now() - interval '1 day';
```

This is not automatically scheduled in the POC.

## Other Security Decisions

- Server-side Zod validation
- Request-body size limits
- Parameterized raw SQL
- Field selection on response
- Generic login error for unknown emails and wrong passwords
- Exact trusted-origin checking for state-changing API requests
- No authentication tokens in localStorage
- No-store headers on sensitive responses
- Rendering note content as text, not HTML
- Shared pages use `no-referrer` and request that a crawler does not index them
  The registration endpoint explicitly advertises duplicate emails. This is a usability trade-off that reveals if an email is registered.
  Note content is plaintext in the database. This application does not implement end-to-end encryption.

## API Endpoints

| Method | Endpoint                 | Authentication                         |
| ------ | ------------------------ | -------------------------------------- |
| POST   | `/api/auth/register`     | Public                                 |
| POST   | `/api/auth/login`        | Public                                 |
| GET    | `/api/auth/me`           | Session required                       |
| POST   | `/api/auth/logout`       | Clears the current session, if present |
| POST   | `/api/notes`             | Session required                       |
| GET    | `/api/notes/:id`         | Note owner                             |
| POST   | `/api/notes/:id/revoke`  | Note owner                             |
| GET    | `/api/share/:token`      | Share token                            |
| POST   | `/api/share/:token/open` | Share token and key when protected     |
| GET    | `/api/health`            | Public                                 |
| GET    | `/api/health/db`         | Public                                 |

### Testing with Postman

State-changing requests require a matching Origin header:

```http
Origin: http://localhost:3000
Content-Type: application/json
```

Set Origin under Headers, not URL parameters.
Public share-open body:

```json
{}
```

Protected share-open body:

```json
{
  "accessKey": "GENERATED_ACCESS_KEY"
}
```

Postman and the browser have separate cookie jars.

## Verification

The local production build and browser-driven concurrent-access test were completed during development.
Concurrent-access test sends ten concurrent requests to each fresh public share:
| Share type | Successful responses | Already-used responses | Final count |
|---|---:|---:|---:|
| One-time | 1 | 9 | 1 |
| Time-based | 10 | 0 | 10 |
This is a functional concurrency check, not a load benchmark.

### Reproduce the concurrency check

Log in locally, open application origin console, and run:

```js
(async () => {
async function request(path, body) {
const response = await fetch(path, {
method: body === undefined ? "GET" : "POST",
credentials: "same-origin",
cache: "no-store",
headers:
body === undefined
? {}
: { "Content-Type": "application/json" },
body: body === undefined ? undefined : JSON.stringify(body),
});
return {
status: response.status,
data: await response.json(),
};
}
function assert(condition, message) {
if (!condition) throw new Error(message);
}
const results = [];
for (const shareType of ["ONE_TIME", "TIME_BASED"]) {
const content = `Concurrency test: ${shareType}`;
const created = await request("/api/notes", {
title: `Concurrency test — ${shareType}`,
content,
expiresAt: new Date(Date.now() + 15 60 1000).toISOString(),
shareType,
accessType: "PUBLIC",
});
assert(created.status === 201, "Could not create test note");
const noteId = created.data.note.id;
const token = new URL(created.data.shareUrl).pathname.split("/").pop();
const responses = await Promise.all(
Array.from({ length: 10 }, () =>
request(`/api/share/${token}/open`, {}),
),
);
const successes = responses.filter(
(result) =>
result.status === 200 &&
result.data.success === true &&
result.data.note?.content === content,
).length;
const alreadyUsed = responses.filter(
(result) =>
result.status === 410 &&
result.data.code === "ALREADY_USED",
).length;
assert(
responses
.filter((result) => result.status !== 200)
.every((result) => result.data.note === undefined),
"A rejected response contained note content",
);
const owner = await request(`/api/notes/${noteId}`);
assert(owner.status === 200, "Could not read owner details");
const expected = shareType === "ONE_TIME" ? 1 : 10;
const count = owner.data.note.shareLink.viewCount;
assert(successes === expected, "Unexpected successful-access count");
assert(
alreadyUsed === (shareType === "ONE_TIME" ? 9 : 0),
"Unexpected rejection responses",
);
assert(count === expected, "Stored view count is incorrect");
results.push({
shareType,
successes,
alreadyUsed,
viewCount: count,
result: "PASS",
});
}
console.table(results);
})().catch((error) => console.error(error.message));
```

This creates two test notes. Give the share-open rate-limit window enough time to reset before running if you've made many share-open requests recently. A `429` response makes this run unable to verify the share-open concurrency.

### Manual checks

- Register, log in, and log out
- Verify `/api/auth/me` returns `401` after logout
- Open a public link without a key
- Try an incorrect key, then the correct key
- Open a one-time link again after successful access
- Wait for a short time-based expiry and retry
- Revoke a link and retry recipient access
- Confirm owner access does not increment views
- Confirm another account cannot inspect or revoke the note
- Confirm invalid links do not return content
- Confirm rate limiting returns `429`

## Required Technical Answers

### How do you prevent two users from using a one-time link at the same time?

A conditional PostgreSQL update checks validity and unused status while atomically setting `consumedAt` and incrementing the count. Updates contend on the same row. Only one can successfully consume it and receive content.

### How do you update view count safely?

The successful access statement performs `viewCount = viewCount + 1` in the database. There is no application-side read-modify-write cycle. Rejected accesses do not update the row.

### How would this work if one million people opened the link?

The current POC has not been tested at that scale. Stateless application instances can scale horizontally, but a popular share's single counter row becomes a database contention point. PostgreSQL-backed rate limiting adds database traffic.
At that scale, I would add edge traffic controls, a dedicated distributed rate limiter, bounded database concurrency, and load testing.
One-time consumption would still require a strongly consistent atomic decision. For time-based analytics, durable access events and partitioned counters could reduce contention, with an explicit trade-off around delayed count visibility and event deduplication. Protected content must not be served from a cache that bypasses expiry or revocation checks.

### How would you prevent brute-force attempts on protected links?

Protected links use independently generated 128-bit random access keys. The implementation also limits share-open requests per client IP and denies excess attempts before evaluating access.
For stronger protection against distributed attacks, I would add layered per-link and network limits, monitoring, and adaptive challenges. Permanent link lockouts should be avoided because attackers could use them to deny legitimate recipients access.

## Deployment

The application runs on Vercel with PostgreSQL on Neon.

1. Import the GitHub repository into Vercel
2. Configure `DATABASE_URL`, `DIRECT_URL`, and `APP_URL`
3. Apply committed database migrations using the deployment database's direct connection
4. Run `npm run build`
5. Set `APP_URL` to the exactly production HTTPS origin
6. Redeploy after changing environment variables
7. Test the production URL in an incognito window
   The build command generates Prisma Client but not database migrations.
   Production and preview deployment URLs are different origins. Only the configured `APP_URL` is allowed for state-changing requests.
   The Next.js API adapter constructs a native `Request` before passing it to Hono. This was added to resolve a production-only request-wrapper compatibility error during logout.

## Scope and Limitations

- One share link per note
- Share URLs and access keys are displayed only after creation
- No note-list dashboard, link regeneration, or password recovery
- No email verification
- Expiry and revocation block future access; they cannot erase content delivered
- A one-time link remains consumed if the database grants access but the network response is lost
- Retrying note creation after an uncertain network failure may create another note; note creation is not idempotent
- Expired sessions and inactive rate-limit rows require periodic maintenance
- The application depends on database availability
- No claim is made that this POC supports one million concurrent users without further engineering and testing.

## Demo Access

Reviewers can register a new account at `/register`.

Dedicated test credentials and the demo-video link are provided separately with the submission.
