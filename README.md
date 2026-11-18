# Backend security for a login system

This guide explains how to build the Node.js, TypeScript, and PostgreSQL login API safely. It is written for learning. It pairs with `backend-roadmap.txt`, which shows the folders, commands, and build order.

The two pages in this project are a frontend practice flow. They keep a temporary account in the browser so you can click through registration, the code check, login, and the profile page. That browser storage is not a secure backend. Passwords, email codes, and sessions belong on the server.

## How a secure login system is shaped

The browser collects the form. The server makes every decision.

1. The user registers with a name, an email, and a password.
2. The server stores a password hash and leaves the email unverified.
3. The server emails a short-lived code.
4. Login stays closed until that code is accepted.
5. A successful login creates a server-side session and sets a cookie the page script cannot read.
6. The profile route reads the session and returns only that user's data.

Each request is checked again. Hiding a button in the frontend does not protect anything, because anyone can call the API directly.

## How to protect passwords

Store a hash, never the password.

A hash is a one-way result. You can check a later password against it, and you cannot turn the hash back into the original password. Use **Argon2id** through the `argon2` package. It is slow on purpose, which makes guessing attacks expensive. `bcrypt` is a reasonable backup if you cannot install Argon2.

Practical rules:

- Hash the password on the server, immediately before the database insert.
- Give the database column a name like `password_hash` so nobody treats it as a recoverable password.
- Use Argon2's default settings unless you have measured a reason to change them. Do not invent a fast custom hash.
- Require a reasonably long password. Ten characters with a mix of letters and numbers is a simple starting rule. Length matters more than a pile of symbol rules.
- Set a maximum length too, such as 128 characters, so a huge input cannot waste server time inside the hashing function.
- Never write the password to logs, error messages, analytics, or support tickets.
- Never return the hash from an API.
- On login, if the email is unknown, still run a password hash comparison against a dummy hash. The response time then looks similar for "no such user" and "wrong password". Use one message for both: "Email or password is incorrect."
- When a user changes a password, hash the new one and delete their existing sessions so old cookies stop working.

SHA-256 alone is not a password hash. It is fast, so an attacker who copies the database can guess billions of passwords. The practice frontend uses SHA-256 only because it has no server. Replace it with Argon2 when you build the API.

## How to implement secure OTP verification

OTP here means a one-time code sent to the email address the user claims to own. It proves they can read that inbox. It is not a password.

Create the code with Node's cryptographic random source, `crypto.randomInt`, not `Math.random()`. Six digits is a common size. The code should expire in about 10 minutes.

Store a hash of the code, not the code. Keep these columns:

- `code_hash`
- `expires_at`
- `attempts`
- `used_at`

Rules that keep the check honest:

- Only one active code per user. When you send a new code, the old one must stop working.
- Allow a small number of guesses, such as five. After that, the code is dead and the user must request another.
- Mark `used_at` when the code succeeds so it cannot be submitted twice.
- Update the user and the code in one database transaction. Either both changes are saved, or neither is.
- Do not put the code in the JSON response. Email is the delivery channel. A development console print is acceptable on your own machine and must be off in production.
- Do not log the code.
- Rate limit both "verify" and "resend". Resend can be abused to spam someone's inbox.
- Compare hashes. If you ever compare raw strings, use `crypto.timingSafeEqual` so the comparison does not leak information through timing.
- For the resend endpoint, return the same sentence whether or not the email exists. That avoids turning the endpoint into an account-lookup tool.

Verification and login are separate. A correct code sets `email_verified_at`. It does not have to sign the user in. The login route then refuses any user whose `email_verified_at` is still empty.

## How to protect the API

Assume every request is hostile, including requests from your own frontend.

- **Authentication.** Routes such as `GET /profile` require a valid session. A missing or expired session returns 401. The middleware does this in one place so a new route cannot forget the check.
- **Authorization.** The user id comes from the session, not from a query parameter or request body. A user can read their own profile and cannot request someone else's by editing an id.
- **Validation.** Zod checks the body before a service runs. Reject unexpected types, empty strings, and oversized fields with 400.
- **Rate limits.** Registration, login, verify, and resend need strict limits. `express-rate-limit` is a simple start. A distributed app later uses a shared store such as Redis so the limit still works across more than one server.
- **Headers.** `helmet` sets safer defaults.
- **CORS.** Allow only your frontend origin, and only if you need cross-origin cookies. Reflecting any origin with credentials is unsafe.
- **HTTPS.** In production the site is served over HTTPS. The session cookie uses `secure: true`, so the browser sends it only on HTTPS.
- **Errors.** Production responses are short. Stack traces, SQL text, and internal ids stay in server logs.
- **Methods and content type.** Accept JSON for these routes and ignore unexpected fields.
- **Least privilege on routes.** Logout and profile are the only routes that need a session. Register, verify, and login are public, so they need the rate limit instead.

A health check can stay public. It should not print the database URL or the contents of the environment.

## How to manage tokens and sessions

Prefer a server-side session for this first login system.

1. After a successful login, create 32 random bytes with `crypto.randomBytes`.
2. Put the raw value in a cookie.
3. Store only a SHA-256 hash of that value in the `sessions` table, with the user id and an expiry time.

Cookie settings:

- `httpOnly: true` so page JavaScript cannot read it. That blocks a large class of token theft if a script injection bug appears later.
- `secure: true` in production so it travels only over HTTPS.
- `sameSite: "lax"` so other sites do not casually send the cookie on cross-site posts. Use `"strict"` if you do not need the cookie on normal external links into your site.
- `path: "/"` and a clear `maxAge` or `expires`.

Logout deletes the session row and clears the cookie. Deleting the row is what actually signs the user out. Clearing the cookie only helps the current browser.

If you later choose JWT instead of a database session, keep the token small, sign it with a long secret, use a short lifetime, and still plan a way to revoke it. A JWT stored in `localStorage` is readable by any script on the page. For a login cookie, the database session above is the simpler safe default. Do not put passwords or personal data inside a token.

Session fixation is avoided here because login always creates a new token. It does not reuse a token that existed before the password was checked.

## How to prevent SQL injection

SQL injection happens when user text is glued into a SQL string and the database treats that text as commands.

The `pg` driver already supports placeholders. Use them for every value that comes from outside the program, including email, name, ids, and codes.

Safe:

```ts
await query(
  "SELECT id, password_hash, email_verified_at FROM users WHERE email = $1",
  [email],
);
```

Unsafe:

```ts
await query(`SELECT id FROM users WHERE email = '${email}'`);
```

More habits that keep queries safe:

- Keep SQL inside the repository files so it is easy to review.
- Let `$1`, `$2`, `$3` carry values. Do not concatenate those values.
- Identifiers such as table names and column names cannot be placeholders. Do not let the user choose them. Write those names yourself in code.
- Dynamic `ORDER BY` should be a fixed allow-list (`name` or `created_at`), not raw input.
- A database user that can only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on these three tables cannot drop the whole server even if a query bug slips through.

## How to validate and sanitize input

Validation asks "is this the kind of data I accept?" Sanitizing asks "can I store or display this safely?"

Validate with Zod at the edge:

- Name: trimmed, 2 to 80 characters.
- Email: trimmed, lowercased, and a normal email shape. Then rely on the verification code to prove the inbox.
- Password: 10 to 128 characters. Check the length before hashing.
- OTP: a string of exactly six digits. Keep it a string so a leading zero is not lost.
- Reject arrays or nested objects where you expect a string. Zod does this if the schema says `z.string()`.

Sanitize for the places data is used:

- Parameterized SQL is the sanitizing step for the database. You do not need to strip quotes out of a name if `$1` carries the name.
- If you ever render a name in HTML, escape it. React does this for normal text nodes. Do not use `dangerouslySetInnerHTML` for user content.
- Trim whitespace so " Ada@Example.com " and "ada@example.com" do not become two accounts. Store the normalized email.
- Do not "sanitize" a password by removing characters. Hash it as the user typed it, after the length check.

Return field errors that help a real user, without echoing the whole submitted password back.

## PostgreSQL security practices

- Run PostgreSQL on localhost while you learn. Do not open port 5432 to the public internet.
- Create a dedicated user, such as `app_user`, and grant it access only to `login_app`. The app should not connect as a superuser.
- Use a long unique password for that database user. Keep it in `.env`, not in source code.
- In production, connect with TLS if the database is not on the same machine.
- Keep backups, and test that you can restore one. A backup you have never restored is a guess.
- Apply schema changes from reviewed SQL files. The sample files in the roadmap are a starting point.
- Add indexes for the columns you search: `users.email`, `email_otps.user_id`, `sessions.token_hash`, `sessions.user_id`.
- Avoid `SELECT *` in application code. Name the columns you need so a future secret column is not returned by accident.
- Turn off verbose logging of statement parameters if those parameters might include emails plus other sensitive fields you do not want in log files. Never log password values.
- Update PostgreSQL and `pg` when security releases come out.

## Common mistakes and how to avoid them

| Mistake | What to do instead |
| --- | --- |
| Saving the password as plain text | Store an Argon2id hash |
| Returning the OTP in the API response | Send it only by email |
| Letting unverified users log in | Check `email_verified_at` inside the login service |
| Putting the session token in `localStorage` | Use an httpOnly cookie and a server-side session |
| Building SQL with string concatenation | Use `$1` placeholders |
| Using one database superuser for the app | Use a limited `app_user` |
| Telling the client "this email is not registered" on login | Use the same message for unknown email and bad password |
| Logging passwords, codes, cookies, or database URLs | Log the event name and a request id |
| Trusting the frontend to hide the profile page | Require the session on `GET /profile` |
| Leaving rate limits off the login route | Limit register, login, verify, and resend |
| Committing `.env` | Commit `.env.example` only, and ignore `.env` |
| Starting the server when `COOKIE_SECRET` is empty | Validate environment variables and exit on failure |
| Reusing an OTP after a successful check | Set `used_at` and reject used codes |
| Showing stack traces to the browser | Send a generic message in production |
| Hashing passwords with a fast hash such as raw SHA-256 | Use Argon2id on the server |
| Accepting a user id from the client for profile lookup | Take the user id from the session |

## A short checklist before you call it done

- Registration stores `password_hash` and leaves the email unverified.
- The verification code is random, hashed, expiring, attempt-limited, and single-use.
- Login fails with a clear verified-email requirement until the code is accepted.
- Login failure messages do not reveal which field was wrong, except for the separate "verify your email" case you intentionally show after a correct password.
- The session cookie is httpOnly, and production cookies are Secure.
- Logout deletes the server session.
- Profile loads only the session user.
- Every SQL value from the request uses a placeholder.
- Zod validates every body.
- Helmet, CORS allow-list, and rate limits are enabled.
- `.env` is not in git.
- The app connects to PostgreSQL as a limited user.

When those items are true, you have a small login system that follows sound practice and is ready to keep improving.
