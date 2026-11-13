# Bake-off acceptance checklist

Run the [contract acceptance tests](https://github.com/Matt-Baxter/superintelligence-home-page/blob/041451b/CONTRACT.md#4-acceptance-tests) with the same fixtures on both deployed builds. Record **Pass**, **Fail**, or **Blocked** and link to the evidence in each cell. A dash means the deployed result is unrecorded. Keep local results in [tracker issue SI-1](http://localhost:3200/m/project#/all/1).

| Run details | Matthew’s build | John’s build |
|---|---|---|
| Deployment URL and commit | — | — |
| Tester and date | — | — |
| Fixture version | — | — |

| Test | What to verify | Shared spec | Matthew’s result / evidence | John’s result / evidence |
|---|---|---|---|---|
| AT-01 | Newest first, with stories from at least 8 sources across 5 kinds | REQ-001, REQ-002 | — | — |
| AT-02 | Exclude the off-topic photo-editing app | REQ-003 | — | — |
| AT-03 | Group three reports of the same paper and show all three sources | REQ-004 | — | — |
| AT-04 | Show the Forecasting & timelines tag and the words “AGI timelines” | REQ-005 | — | — |
| AT-05 | Exclude the fixture that links to Twitter/X | REQ-006 | — | — |
| AT-06 | Feed still loads when one source fails | REQ-008 | — | — |
| AT-07 | Sign up with an unused username and land signed in | REQ-009 | — | — |
| AT-08 | Reject duplicate signup with a clear message and no second account | REQ-009 | — | — |
| AT-09 | Close the browser and return signed in the next day | REQ-010 | — | — |
| AT-10 | Vote, sign out, sign back in, and see the vote retained | REQ-013, REQ-015 | — | — |
| AT-11 | Two users save different stories and see only their own saves | REQ-014, REQ-016 | — | — |
| AT-12 | Reject a direct attempt to remove another user's vote and verify the vote survives | REQ-016 | — | — |
| AT-13 | Filter to Alignment at phone width and check for sideways scrolling | REQ-017, REQ-018 | — | — |
| AT-14 | Time a classmate's unaided public signup and feed visit under two minutes | REQ-009, REQ-019, SC-001 | — | — |

For failures and blockers, record the observed result and the next action. Track redeploy persistence, the 20-story relevance review, and the class sharing date in their separate [grading issues](http://localhost:3200/m/project#/all).

On a new checkout, start `npm run demo` on port 3200 from `builds/john`. In another terminal run `node test/import-demo-grading.js` from the same folder, then open the [local tracker](http://localhost:3200/m/project#/all) as the demo admin and select the **grading** label. The import adds missing issues and preserves existing edits. Issue numbers may differ if the tracker already has other issues.

For the relevance comparison, John proposes a small feed of stories with a clear connection to a shared superintelligence topic. Before scoring, agree on the same boundary examples for both builds: a concrete single-topic contribution, a weak keyword mention, and a generic application with two topic tags. Record any shortfall in the required 20-story live sample. See the grading issue **Agree on a shared relevance rule and score 20 live stories**.

## Proposed changes in PR #3

[PR #3](https://github.com/Matt-Baxter/superintelligence-home-page/pull/3) proposes spec 1.1 and contract 1.2. Keep the existing record above and record the exact spec, contract and build revisions for any trial of the proposal. The table records deployed evidence. John’s local Chromium run passed all three tests.

| Test | What to verify on both builds | Proposed spec | Matthew’s result / evidence | John’s result / evidence |
|---|---|---|---|---|
| AT-15 | A feed summary containing script and image tags displays literal text; nothing executes or loads | REQ-021 | — | — |
| AT-16 | Every page shows the information-only and not-investment-advice notice | REQ-022 | — | — |
| AT-17 | Keyboard alone can filter, sign in, vote and save, with visible focus throughout | REQ-023 | — | — |

For AT-02 and AT-04, use the same proposed phrase table for both builds. Match listed phrases in the title or summary regardless of case. Check a strong single-topic match, a summary-only match, and a generic or weak mention without any listed phrase. Separately, three classmates should judge 20 live stories from each feed without knowing which build produced them. Record a shortfall if a feed has fewer than 20 stories.

Record separate databases for each build and keep the ownership check under AT-12 (RLS is recommended). Repeated failed sign-in throttling is deferred until after M2. Record the screen-reader check separately before M2. For maintainability, each partner makes one small agreed change in the other build: five points each for finishing under an hour, keeping acceptance tests passing, and needing no help from the owner.

Confirm the contract’s fairness table includes F9: it still lists F1–F8 even though F9 and AT-15–17 appear elsewhere in the proposed contract.


Run John’s local proposal checks from `builds/john`.

```sh
node --no-warnings test/pr3-acceptance.js
node test/pr3-relevance.js
```

AT-15 passed on the feed and story page with literal tags, zero script execution and zero image requests. AT-16 passed on 29 page entries. AT-17 passed at 1280 px in light and 390 px in dark. Deployed verification and the separate screen-reader check are pending.

The relevance comparison passed nine synthetic cases. The proposed rule excludes two items the current policy accepts (broad terms across two topics and an author-only match). Literal matching also admits “magic” through “AGI”, and both policies admit “wheel alignment”. John’s feed still uses the current policy while the partners review phrase boundaries and run the blind live sample.
