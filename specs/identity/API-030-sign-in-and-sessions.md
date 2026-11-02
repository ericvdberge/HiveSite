---
id: API-030
title: Owner sign-in and sessions
domain: identity
status: in review
owner: api-architect
stories: [56, 57, 58]
depends_on: [API-001]
version: 1
---

## Purpose
An owner signs in to the studio with an email and a password, holds a cookie session, and signs out.

Ids, errors, validation and timestamps follow the shared conventions in API-001. This spec fills in what API-001 left out ("Authentication is out of scope"): how a request gets the owner id that `UserContext.Id` returns and that every `Auth: owner` and `Auth: site owner` endpoint relies on.

## Endpoints

### POST /session
Auth: none

Operation: `SignIn`

Checks the email and password and starts a session. The response sets the session cookie (see Session cookie). Signing in while already signed in replaces the old session.

Request
```
POST /session
Content-Type: application/json
```
```json
{
  "email": "noor@atelier-noor.nl",
  "password": "spring-collection-2026"
}
```

Response 200

Headers: `Set-Cookie: hivesite_session=…; Path=/; Expires=…; Secure; HttpOnly; SameSite=Lax`
```json
{
  "owner": {
    "id": "0198f1a0-0000-7000-8000-000000000001",
    "email": "noor@atelier-noor.nl"
  }
}
```

Errors
- 400 `invalid_request`: the body is not JSON, `email` or `password` is missing, not a string or over its limit (see Rules), or an unknown field is present. `field` is `/email` or `/password` when one of them is to blame.
- 400 `invalid_credentials`: no owner has this email, or the password is wrong. The same error for both, without `field`, so the response does not tell which emails have an account.
- 415 `unsupported_media_type`: `Content-Type` is not `application/json`.

### GET /session
Auth: owner

Operation: `GetSession`

Returns the signed-in owner. The studio calls it on start: the cookie is `HttpOnly`, so this is how the studio learns whether it has a session.

Request
```
GET /session
Cookie: hivesite_session=…
```

Response 200
```json
{
  "owner": {
    "id": "0198f1a0-0000-7000-8000-000000000001",
    "email": "noor@atelier-noor.nl"
  }
}
```

Errors
- 401 `unauthenticated`: no session cookie, or it is expired, signed out or not valid.

### DELETE /session
Auth: none

Operation: `SignOut`

Ends the session: the response deletes the cookie. Without a session it does the same and still answers 204, so the studio can always sign out.

Request
```
DELETE /session
Cookie: hivesite_session=…
```

Response 204

Headers: `Set-Cookie: hivesite_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax`

No body.

Errors
- none

## Rules

### Who owns accounts
- Accounts live in a new module, **Identity** (`src/Modules/Identity`, schema `identity`, ADR 2), with `Hivesite.Identity.Contracts` for anything another module needs later. Nothing does yet: Content keeps reading the owner id from `UserContext.Id`, as today.
- An account has `id` (UUIDv7, the owner id that `sites.owner_id` holds), `email`, `password_hash` and `created_at`.
- The three endpoints above are mapped by `IdentityModule.MapIdentityEndpoints()`. The cookie scheme and `UserContext` stay in `Hivesite.Shared` and `Hivesite.Host`.

### Accounts
- There is no sign-up endpoint. An operator creates an owner on the server with a Host command:
  `dotnet run --project src/Hivesite.Host -- add-owner --email noor@atelier-noor.nl`
  It reads the password from standard input, creates the account, prints its id and exits with 0. It applies the Identity migrations first.
- `add-owner` refuses, prints the error code and exits with 1 when the email is taken (`email_taken`), not a valid address (`invalid_email`: one `@` with text on both sides, at most 254 characters), or the password is under 12 or over 128 characters (`invalid_password`).
- Emails are trimmed and stored lowercase; sign-in matches them in any letter case. A unique index on `email` keeps them unique.
- Passwords are hashed with ASP.NET Core's `PasswordHasher<T>` (PBKDF2, its defaults) and never stored or logged in plain text. Passwords are not trimmed: this is the one exception to the API-001 trimming rule.

### Sign-in limits
- `email`: a string of 1 to 254 characters after trimming.
- `password`: a string of 1 to 128 characters, not trimmed.
- Checks run in this order and the first failure is returned: `Content-Type` (415), body shape and limits (`invalid_request`), then email and password (`invalid_credentials`).

### Session cookie
- The session is ASP.NET Core cookie authentication (`AddCookie`), the framework default: the cookie holds an encrypted ticket with the owner id (`ClaimTypes.NameIdentifier`) and email. There is no session table. `UserContext.Id` reads the owner id from the ticket, as it does today.
- Cookie: name `hivesite_session`, `Path=/`, no `Domain` (host-only on the API origin), `HttpOnly`, `SameSite=Lax`, `Secure`. In Development over plain `http://localhost` the cookie is `Secure` only when the request is (`CookieSecurePolicy.SameAsRequest`); everywhere else it is always `Secure`.
- Lifetime: 14 days, sliding. A request with a valid cookie more than 7 days old gets a fresh 14-day cookie (the framework's `SlidingExpiration`). The cookie is persistent, so closing the browser keeps the session.
- An expired, tampered or unreadable cookie is the same as none: 401 `unauthenticated`.
- The scheme never redirects. A challenge answers 401 `unauthenticated` in the `ApiError` shape (`specs/STYLE.md`), exactly as `UserAuthenticationHandler` does now, so the studio's existing 401 handling does not change.
- `GET /s/…` (API-021) ignores the cookie, as API-021 already says. The browser still sends it there; nothing reads it.

### The studio and CORS
- The studio is on its own origin (ADR 4; `http://localhost:5173` in Development) and calls the API with `credentials: 'include'`. `StudioCors` already allows credentials from `Studio:Origins`.
- The studio and the API must be **same-site** (same scheme and registrable domain, ports may differ), or a `SameSite=Lax` cookie is not sent on the studio's calls. `localhost:5173` and `localhost:5000` are same-site. A production deployment puts both on one domain, for example `studio.example.com` and `api.example.com`.
- The studio's origin must not be the API origin, because published sites are served there under `/s/` (ADR 4).

### CSRF
- `SameSite=Lax` keeps the cookie off requests started by other sites.
- Same-site pages (another subdomain, or a page under `/s/` on the API origin) could still send a plain form POST, for example to `POST /sites/{id}/publish`, which takes no body. So: on any request other than `GET`, `HEAD` and `OPTIONS` that has an `Origin` header not listed in `Studio:Origins`, the session cookie is ignored. The request is then unauthenticated and an endpoint that needs an owner answers 401 `unauthenticated`.
- A request without an `Origin` header (curl, tests) is not affected: browsers always send `Origin` on these methods.
- No antiforgery token and no custom header: the `Origin` check and the CORS allowlist share one list.

### Development
- ADR 4's auto sign-in ends with this spec: `DevelopmentAuthenticationHandler` is removed, and Development signs in like production.
- When `Dev:Seed` is true, Development seeds two accounts with fixed ids that match the Content seed (`DevSeeder.OwnerA` and `OwnerB`), so the seeded sites keep their owners:
  - `admin@hivesite.local`, password `hivesite-admin`, id `0198f1a0-0000-7000-8000-000000000001`
  - `owner-b@hivesite.local`, password `hivesite-owner-b`, id `0198f1a0-0000-7000-8000-000000000002`
- Identity keeps its own copy of the two ids (it cannot reference Content). A Host test checks they equal Content's.
- These accounts exist in Development only. Production has no accounts until `add-owner` creates one.

### Side effects
- None. No events are raised.

## Decisions
- **Email and password, not a magic link.** A magic link needs outgoing email, which Hivesite does not have. A password needs only a hash column.
- **A cookie session, not a bearer token.** The studio is a browser app, and an `HttpOnly` cookie keeps the credential out of JavaScript and `localStorage`. CORS with credentials is already set up (`StudioCors`). The studio adds `credentials: 'include'` and nothing else.
- **The framework's cookie ticket, not a session table.** `AddCookie` gives expiry, sliding renewal, tamper checks and sign-out with no table or custom code.
- **Accounts are a module, Identity, not a Host area.** Accounts are data with their own table, and ADR 2 gives each module's data its own schema. A Host area with a DbContext would be a module without the boundary checks of `Hivesite.ArchitectureTests`. Identity is a backend module for `team:factory` until it has its own dev agent.
- **No sign-up endpoint.** The MVP has one owner, and an open sign-up on a public server would let anyone in. An operator adds owners with `add-owner`. The studio gets a sign-in screen only (#58).
- **`/session` is singular.** It is the caller's one current session, not a collection, so the plural rule in `specs/STYLE.md` does not fit it.
- **A wrong password is 400 `invalid_credentials`, not 401.** 401 `unauthenticated` stays the one signal that means "send the owner to sign-in", which the studio already acts on. A failed sign-in must stay on the form.
- **Development signs in for real.** ADR 4 kept the auto sign-in "until real sign-in lands". Keeping both would give Development a path production never takes. The seeded accounts make the local sign-in one step.
- **API-001 is not edited.** Its Decision "Authentication is out of scope" is answered by this spec; the 401 `unauthenticated` convention is unchanged.
- **Not in this version:**
  - Rate limiting, lockout or delays after failed sign-ins.
  - Hashing a dummy password for unknown emails, so timing does not reveal which emails exist.
  - Revoking a session on the server. Sign-out deletes the cookie in the browser; a copied cookie stays valid until it expires.
  - "Sign out everywhere", a list of sessions, and password changes or reset (#45 Out of scope).
  - Sign-up, email verification, teams and roles.
  - Data Protection keys shared across several Host instances. With one instance the framework's default key folder is enough; if the keys are lost, every owner signs in again.
  - An antiforgery token. The `Origin` check covers the MVP.
  - A login CSRF guard on `POST /session`. The worst case is being signed in to someone else's account.

## Open questions
- none
