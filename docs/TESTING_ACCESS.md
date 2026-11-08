# Test account access and the public overview

Run `npm run demo` from the repository and open http://localhost:3200/?signin=1. If another local preview is already using that port, stop that preview first or run `PORT=3250 npm run demo`.

The sign-in page offers **Use reader account** and **Use admin account**. Select a role to fill the form, then select **Sign in**. Readers can browse, vote and save. Admins can also use the project and administration tools. Test both people in separate browser profiles; tabs in the same profile share a session. Sign out before switching roles in one profile.

Every launch creates a fresh temporary SQLite database and synthetic feeds. It ignores hosted database configuration, listens only on 127.0.0.1 and refuses production mode. The shared credentials belong only to this disposable demo. They never appear on the normal server. Existing users in another database are unaffected. The existing `npm run dev:sample` test runner continues to start without seeded accounts so the first-account-admin acceptance checks remain meaningful.

Public entry: `/welcome`. It explains the reader, topics, source grouping and significance scores, with explicitly synthetic examples and account links. The actual feed at `/` and story detail are public. Guests can search, filter and inspect sources; voting, saves, submission and administration require sign-in. Guest detail responses exclude notes and list memberships. Password reset by email is not implemented; the sign-in help says so. There is no authentication bypass.

Checks: `npm run preflight`, then `npm test` against a fresh `npm run dev:sample` server. To check the demo separately, start `PORT=3250 npm run demo` and run `node test/demo-access.js`. This validates both roles, protected routes, logout and production refusal. Browser coverage includes failed login and retry, local return destinations, signup password-manager hints, show/hide password and public/login layouts in both themes at 390px and 1280px.

Validation for this change: `Preflight passed.`; browser `279 passed, 0 failed`, `page errors: none`; `Demo access: metadata, both roles, protected routes, logout and production refusal passed.` No SQL or schema changes were made. Screenshots are `shots/access-{login,public}-{light,dark}-{390,1280}.png`.

Public-reading regression coverage verifies guest browsing, story explanations, sign-in return links, protected saved queries and writes, and absence of notes and list membership in anonymous detail responses. The normal local fixture runner remains the browser acceptance target.

Public-reading follow-up validation: browser `285 passed, 0 failed`, `page errors: none`; demo access checks passed again. `shots/public-feed-{light,dark}-{390,1280}.png` shows the actual guest feed using synthetic local fixtures. Hidden-story admission and anonymous note/list redaction are checked through HTTP.

Public-reading preflight: `Preflight passed.` (12 API smoke checks; spec acceptance `38 passed, 0 failed`).
