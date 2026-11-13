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
