# Term syntax

- Case-insensitive, matched against title + summary (first 6,000 characters).
- Whole word by default: `agent` doesn't match `agentic`. Hyphens and apostrophes count as part of a word.
- A trailing `*` matches any ending: `interpretab*` matches interpretable, interpretability.
- Multi-word terms match the exact phrase: `chain of thought`.
- People and benchmark names are also matched against the author list (people only).

## Known false positives (avoid or work around)
| Term | Problem | What we do |
| --- | --- | --- |
| `imo` | "IMO" = "in my opinion" | Use `imo gold`, `imo problem*`, `international mathematical olympiad` |
| `o1`, `o3` | Also appear in unrelated text | Kept for OpenAI, but don't add more two-character terms |
| `fair` | Meta's lab vs the word "fair" | Existing; don't copy the pattern |
| `asi`, `hle`, `aime` | Short acronyms | Only kept where the topic needs them; check on real titles |
| `safety` | Very broad | Keep under Safety; don't add more one-word generic terms |

Rule of thumb: a term should rarely appear in a story that isn't about the topic. Test it on 5–10 real titles before committing.
