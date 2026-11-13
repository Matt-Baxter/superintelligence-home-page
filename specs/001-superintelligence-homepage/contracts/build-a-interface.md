# Interface Contract: Build A (Matt)

Phase 1 output of `/speckit-plan`. These are Build A's own pages and endpoints. In the bake-off,
API design may differ between builds (contract, Section 3); what both builds share is the spec
and the acceptance tests.

All mutations are plain HTML form posts, so they work with the keyboard and without client
JavaScript (REQ-023). After a form post the server redirects back (303) to the page it came
from. The user is always taken from the session cookie, never from the request (REQ-016).

## Pages

| Path | Who | Shows | Requirements |
|------|-----|-------|--------------|
| `/` | Anyone | Superintelligence feed, newest first, 40 stories per page. Each story: title (link to original), summary, every source, topics with matched words, vote count; vote and save buttons. Topic filter links. | REQ-002 to REQ-007, REQ-013, REQ-014, REQ-017, REQ-018 |
| `/?topic=<topic-id>` | Anyone | Feed filtered to one topic; "No stories yet" message if empty. | REQ-017 |
| `/saved` | Signed in | The user's saved stories. Signed-out visitors are sent to `/signin`. | REQ-014 |
| `/signup` | Anyone | Username and password form. | REQ-009 |
| `/signin` | Anyone | Username and password form. | REQ-010 |
| Every page | — | Header with sign-in state; footer notice: "For information only. Not investment advice." | REQ-022 |

## Form endpoints

| Method and path | Body (form fields) | Success | Errors |
|-----------------|--------------------|---------|--------|
| `POST /api/auth/signup` | `username`, `password` | Sets session cookie; 303 to `/` | Taken username: back to `/signup` with "That username is taken." Invalid input: back with a message naming the field. No account is created on any error. |
| `POST /api/auth/signin` | `username`, `password` | Sets session cookie; 303 to `/` | Back to `/signin` with "Username or password is incorrect." (same message whether or not the username exists) |
| `POST /api/auth/signout` | none | Deletes the session; clears the cookie; 303 to `/` | — |
| `POST /api/stories/<id>/vote` | `returnTo` (optional, must be a path on this site) | Toggles the signed-in user's vote; 303 back | Not signed in: 303 to `/signin`, nothing recorded. Unknown story: 404 page. |
| `POST /api/stories/<id>/save` | `returnTo` (optional) | Toggles the signed-in user's save; 303 back | Same as vote |

Any extra fields (for example a `userId` someone adds by hand) are ignored, which is how AT-12
is met: a request can only ever change the sender's own vote or save.

## Scheduled endpoint

| Method and path | Caller | Behavior |
|-----------------|--------|----------|
| `GET /api/cron/fetch` | Vercel Cron, daily | Requires header `Authorization: Bearer <CRON_SECRET>`; otherwise 401. Runs one fetch of all sources (skips if one is already running) and returns `{ "fetched": n, "failed": n, "stories": n }`. |

## Error messages

Every error a user sees is a sentence they can act on and never includes internal details
(contract, Section 3). Server errors show "Something went wrong. Please try again." and are
logged on the server.
