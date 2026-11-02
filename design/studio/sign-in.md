# Sign-in

The screen an owner signs in on, the check the studio makes on start, and where the owner lands after signing in or out. Covers #58 and #45 (sign-in and sign-out). The account slot in the top bar (email and Sign out) is in [shell.md](shell.md#account-slot); this note covers the screen. Shared rules are in [shell.md](shell.md); this note lists only what differs.

## Data

| Field | Control | Sent as | Limit (API-030) | Counter |
|---|---|---|---|---|
| Email | `input type="email"`, required, `autocomplete="username"` | `email` | 1 to 254 code points after trimming | no (see Limits) |
| Password | `input type="password"`, required, `autocomplete="current-password"` | `password` | 1 to 128 code points, not trimmed | no (see Limits) |

**Sign in.** POST `/session` with `email` (trimmed) and `password` (exactly as typed: passwords are the one value API-030 does not trim). On 200 the studio keeps `owner.email` for the account slot and opens the return screen (below). `owner.id` is not shown.

**On start.** Before any screen, the studio calls GET `/session` once.

| Result | What happens |
|---|---|
| 200 | The studio keeps `owner.email` and opens the address the owner asked for. The top bar shows the account slot. |
| 401 `unauthenticated` | The sign-in screen, with the asked-for address as the return screen. No message: nothing went wrong. |
| network or server failure | The start error (Layout). The studio cannot tell whether a session exists, so it shows neither the sign-in screen nor a studio screen. |

**Return screen.** When the studio sends an owner to sign-in, it keeps the address they were on (or asked for) in the sign-in address: `/sign-in?next=/sites/{id}/pages`. After sign-in the studio opens that address, only when it passes the return rule below.

**Return rule.** `next` is an untrusted value: anyone can send an owner a sign-in link with their own `next`. So:
- Writing it: the studio sets `next` with `encodeURIComponent` of the current path, query and hash.
- Reading it: decoded once (by the router's query parsing), never again.
- It is used only when all of these hold:
  - it starts with `/`;
  - its second character is neither `/` nor `\` (this refuses `//evil.example` and `/\evil.example`);
  - it holds no control characters and no whitespace (this refuses tabs and newlines, which browsers strip, and their encoded forms after the one decode);
  - `new URL(next, location.origin).origin === location.origin`;
  - the resolved URL's `pathname`, with one trailing `/` removed, is not `/sign-in` (this also refuses `/sign-in?…` and `/sign-in/`).
- The studio opens it only with `router.replace(next)`, never with `location.href`, `location.assign` or `window.open`.
- Anything else, or no `next`, opens the site list (`/sites`).

The studio uses `replace` for both moves, so Back never returns to the sign-in screen after a sign-in, and never to a studio screen after a sign-out.

**A session that ends while working.** Any call that answers 401 `unauthenticated` (the shell Data table) clears the kept email and opens the sign-in screen with the current address as `next` and the "session ended" Note. Values not yet saved on that screen are lost; when that screen had unsaved changes (for example the block editor's leave guard was on), the Note says so plainly.

**Already signed in.** Opening `/sign-in` with a session (GET `/session` answers 200) opens `next`, or the site list, as above.

**After sign-out.** The sign-in screen with the "signed out" Note and no `next`: the next sign-in opens the site list. Sign-out itself is in [shell.md](shell.md#account-slot).

The owner's email is never shown back on this screen: no "Welcome back" and no echo of a failed email in a message. The Email field keeps what the owner typed; that is all.

### Errors

Client checks run first, with the same limits as the server. The Email field has no format check, because the server has none at sign-in: any 1 to 254 code points are sent. The form has `novalidate`, so the browser's own email bubble never shows.

| Field | Rule broken | Copy |
|---|---|---|
| Email | empty after trimming | Enter your email. |
| Email | over 254 | Use 254 characters or fewer. |
| Password | empty | Enter your password. |
| Password | over 128 | Use 128 characters or fewer. |

Server errors. `error.message` is never shown; the screen branches on `error.code` and `error.field`.

| Code | Status | Where | Copy |
|---|---|---|---|
| `invalid_request` with `field` `/email` | 400 | Email field error | Enter your email, 254 characters or fewer. |
| `invalid_request` with `field` `/password` | 400 | Password field error | Enter your password, 128 characters or fewer. |
| `invalid_request` without a `field`, or another `field` | 400 | sign-in message, above the button | Something in the form wasn't accepted. Please try again. |
| `invalid_credentials` | 400 | sign-in message, above the button | That email and password don't match an account. Check both and try again. |
| `unsupported_media_type` | 415 | Cannot happen: the studio always sends `application/json`. If it does, the error toast, server copy. | |
| `unauthenticated` | 401 | Cannot happen on POST `/session` (Auth: none). If it does, the error toast, server copy. | |
| no network | | Error toast | We can't reach Hivesite. Check your connection and try again. |
| server error or an unknown code | 5xx | Error toast | Something went wrong on our side. Please try again. |

`invalid_credentials` has one text for an unknown email and for a wrong password, as API-030 requires. Neither field is marked invalid for it, because the screen does not know which one is wrong.

## Structure

```html
<body>
  <a class="hs-skip" href="#main">Skip to content</a>
  <header class="hs-topbar">
    <p class="hs-topbar__mark">Hivesite <span>Studio</span></p>   <!-- not a link here -->
    <!-- no account slot, no nav -->
  </header>
  <main id="main" class="hs-content hs-content--signin" tabindex="-1">
    <header class="hs-screen-head">
      <h1 tabindex="-1">Sign in</h1>
      <p class="hs-lead">Crafted by many. Made for you.</p>
    </header>
    <div class="hs-note" role="status">…</div>          <!-- signed out, or session ended -->
    <form class="hs-form" method="post" action="/session" novalidate>
      <div class="hs-field">
        <label for="signin-email">Email</label>
        <input id="signin-email" name="email" type="email" autocomplete="username"
               autocapitalize="none" spellcheck="false" inputmode="email" required
               aria-describedby="signin-email-error">
        <div class="hs-field__foot">
          <p class="hs-field__error" id="signin-email-error">…</p>   <!-- only when invalid -->
        </div>
      </div>
      <div class="hs-field">
        <label for="signin-password">Password</label>
        <input id="signin-password" name="password" type="password" autocomplete="current-password"
               required aria-describedby="signin-password-error">
        <div class="hs-field__foot">
          <p class="hs-field__error" id="signin-password-error">…</p>
        </div>
      </div>
      <div class="hs-message" id="signin-message" role="alert" tabindex="-1">…</div>   <!-- only for a message without a field -->
      <div class="hs-form__actions">
        <button type="submit" class="hs-button">Sign in</button>
      </div>
    </form>
  </main>
  <div class="hs-toast" popover="manual" role="alert">…</div>
</body>
```

- One `<h1>`: "Sign in". No eyebrow; the top bar already says "Studio".
- The screen has no account slot and no navigation: there is no owner yet, and every nav link would send the owner straight back here.
- The wordmark is plain text here, not a link, for the same reason.
- The form is a real `<form>` with `method="post"`, `action="/session"`, `name` and `id` on both inputs, visible labels and a `type="submit"` button. The studio sends it with `fetch` and stops the browser's own submit, but the markup stays the shape password managers look for. The fields are never built after load, renamed or moved, so a saved login fills them.
- "(required)" is left off the labels: both fields are required and the form has only two, so the word is noise. The `required` attribute still tells assistive tech.
- No "show password" button. The task puts it out of scope, and the sign-in form is short enough that a failed attempt costs one retype; password managers fill the field anyway.

## Layout

**Frame.** The shell frame with the top bar reduced to the wordmark. No side or row nav at any width.

**Content.** One column, centered in the content area with `margin-inline: auto`. Column width `layout.content_width` (stand-in for a narrower form column; see [Token gaps](shell.md#token-gaps)), `padding-block: space.8` above the screen head.

**Screen head.** Shell screen head. The lead line is the brand tagline in `font.display`, `font_size.body_l`, `color.text_muted`, `space.3` above it. It is decoration in words, not an instruction.

**Panel.** The form sits on a panel: background `color.surface`, `border_width.hairline` solid `color.border`, `radius.card`, padding `space.6`. `space.6` above it (below the head, or below the Note when one shows). Inputs inside are the shell field on `color.surface_sunk`.

**Fields.** Shell field and field error, `space.5` apart. No hints and no counters.

**Sign-in message.** The shell form message look (background `color.background` inside the panel so it stands off the `color.surface` panel; inline-start edge `border_width.focus` solid `color.error`; padding `space.4`; text `color.text`; "Error:" in `color.error`, `font_weight.text_strong`). Unlike other forms it sits between Password and the button, `space.5` above and below, so it is next to the action that failed.

**Button.** One primary button, "Sign in", full width of the panel. Busy: "Signing in…", unavailable (shell Busy).

**Note.** The shell Note, above the panel, `space.5` below it.

| Situation | Note copy |
|---|---|
| After sign-out | Note: You're signed out. |
| A 401 while working | Note: Your session has ended. Sign in again to continue. |
| A 401 while working, on a screen with unsaved changes | Note: Your session has ended. Sign in again to continue. Changes you hadn't saved are lost. |
| Started without a session, or `/sign-in` opened directly | no Note |

The Note stays until the next sign-in attempt, then goes.

**After a failed attempt.** Both values stay. The password is not cleared, so a typo in the email does not cost the password too. The busy button returns to "Sign in".

### Start

While GET `/session` runs, the studio shows the top bar with the wordmark only and an empty content area with `aria-busy="true"` and a visually hidden status line "Checking your sign-in…". No placeholder shapes: the studio does not yet know which screen to draw, and a guess would flash. When the call ends, the screen it leads to appears with the shell screen change.

### Start error

When GET `/session` fails on the network or with a server error, the content area shows a screen like the shell not-found screen:

| `<h1>` | Line | Action |
|---|---|---|
| We can't reach Hivesite | Check your connection, then try again. | Try again (primary): calls GET `/session` again |

While Try again runs, the button is busy ("Trying again…"). The top bar shows the wordmark only, as on sign-in. The error toast is not used: this screen owns the failure, and nothing else is on screen.

## States

| State | What shows | Tokens |
|---|---|---|
| Loading (start) | Top bar wordmark, empty content area, hidden "Checking your sign-in…". | `color.background`, `color.text` |
| Empty | Blank Email and Password, "Sign in" ready. A saved login may fill both at once; that is the same state with values. | `color.surface`, `color.surface_sunk`, `color.border_strong`, `color.accent`, `color.on_accent` |
| Error on a field | Shell field error on Email or Password: border `color.error`, "Error: …" under it. Client checks, or `invalid_request` with that `field`. | `color.error`, `font_size.body_s`, `font_weight.text_strong` |
| Error without a field | Sign-in message above the button (`invalid_credentials`, `invalid_request` without a field). No field turns red. | `color.background`, `color.error`, `border_width.focus`, `color.text` |
| Error toast | Network, 5xx or an unknown code on POST `/session`; the form keeps its values. | `color.surface`, `color.error`, `color.text`, `radius.card` |
| Limit reached | Email over 254 or Password over 128: field error "Use … characters or fewer." There is no counter and no count limit on this screen. | `color.error` |
| Sending | Fields `readonly`; button "Signing in…", unavailable. | `color.text_muted`, `color.border` |
| Signed out | The "You're signed out." Note above an empty form. | `color.rule`, `color.accent_text`, `color.text`, `border_width.focus` |
| Session ended | The "Your session has ended." Note; Email empty (the kept email was cleared). | `color.rule`, `color.accent_text`, `color.text`, `border_width.focus` |
| Start error | `<h1>` "We can't reach Hivesite", line, Try again. | `font_size.display_l`, `font_size.body_l`, `color.text_muted`, `color.accent`, `color.on_accent` |

## Limits

- Email up to 254 code points after trimming, password up to 128 code points as typed. Both far above real values, so there are no counters: a counter on Password would also read out the password's length to anyone listening. A value over the limit gets the field error; inputs carry no `maxlength` (shell Limit counter), so a pasted value is never cut short silently.
- One request at a time; the button is busy until it ends. Enter while busy does nothing.
- A long email typed into the field scrolls inside the input, as any input does; it is never shown elsewhere on this screen.
- `next` is at most one studio path, checked by the return rule (Data). It is never shown as text.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | `padding-block: space.6` above the head. The panel loses its edge and padding (`padding: space.0`, no border), so the fields use the full width; the background stays `color.background` and the sign-in message uses `color.surface` instead. |
| `breakpoint.sm` to `breakpoint.md` | As in Layout. |
| from `breakpoint.md` | As in Layout; the column stays centered. There is no nav column to sit beside. |

## Accessibility

- **`<h1>`:** "Sign in". The document title is "Sign in · Hivesite Studio". Start error: "We can't reach Hivesite".
- **Tab order.** Skip link, Email, Password, sign-in message (only by focus, see below), Sign in, then the toast's Dismiss button when a toast is open. The wordmark is text, not a stop. The Note is not focusable.
- **Keyboard path.** Type the email, Tab, type the password, Enter. Enter in either field submits the form.
- **Focus on open.** The `<h1>`, as on every screen change. A saved login can be filled from there.
- **Focus after a failed attempt.**
  - Client check or `invalid_request` with a `field`: the first invalid field (shell rule).
  - `invalid_credentials`, or `invalid_request` without a field: the sign-in message (`tabindex="-1"`), so its text is read; Shift+Tab goes back to Password, Tab to Sign in. The message id is also added to both inputs' `aria-describedby` while it shows, so it is heard again on either field.
  - Error toast: focus stays where it was, on the field or on the Sign in button. Enter in Password submits, so focus is often still in Password; it does not move.
- **Focus after sign-in.** The `<h1>` of the return screen (shell Screen change).
- **Autocomplete.** `autocomplete="username"` on Email and `autocomplete="current-password"` on Password, so browsers and password managers offer and save the login. Email has `autocapitalize="none"`, `spellcheck="false"`, `inputmode="email"`.
- **Pasting.** Paste is never blocked in either field.
- The Note is `role="status"`, read once when the screen opens. The sign-in message is `role="alert"`.
- Errors say "Error:" in words; no field is marked by color alone.
- Color pairs: `color.text` and `color.text_muted` on `color.background`, `color.surface` and `color.surface_sunk`; `color.accent_text` (the Note's "Note:") on the Note's `color.surface` fill only, never on `color.surface_sunk`; `color.on_accent` on `color.accent`; `color.error` on `color.background` and `color.surface`. All from the README Color roles table.
- Shared focus ring (`border_width.focus`, `color.focus`); inputs and the button at least `control.min_height` tall.

## Motion

- The screen enters with the shell screen change: the content area as one shape, fade and rise over `motion.duration_base` with `motion.easing_enter`.
- The sign-in message, field errors and the Note fade in over `motion.duration_base` with `motion.easing_standard`, one at a time. The button moves down once to make room for the message; it does not slide.
- The busy label swaps at once; nothing spins.
- Start: the hidden status line has no motion. The first screen after it uses the screen change.
- Reduced motion: durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`. The screen and messages are simply there.
