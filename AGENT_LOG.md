# Agent Log

> **Written by humans, not AI.** Every entry in this log is written by Matt or John in their own
> words. Don't ask an AI agent to write, rewrite or polish an entry, and don't write entries for
> your partner.

## What did the agent get wrong & how did you catch it?

Add a new entry at the top of the Entries section within a day of the session. Copy the template.

### Template

```markdown
### YYYY-MM-DD · Name · Build (Matt / Claude Code or John / v0)

**What the agent got wrong:**

**How I caught it:**

**What I did about it:**

**Related:** (requirement ID, commit, or pull request, if any)
```

## Entries

### 2026-11-06 · Matt · Build: Matt / Claude Code

**What the agent got wrong:** The initial spec was about general AI news, but this website is
intended to focus on superintelligence specifically, so I had to clarify that to the AI and redo
the spec to focus on superintelligence development specifically.

**How I caught it:** By reading through the initial spec and realizing that the scope was off.

**What I did about it:** Reprompted the AI to recreate the spec and constitution with a focus on
superintelligence and related topics specifically, not just AI development in general.

**Related:** REQ-003; commit `d4c0386` (Focus constitution and spec on superintelligence)

### 2026-11-06 · Matt · Build: Matt / Claude Code

**What the agent got wrong:** I wanted to spread out the constitution and the spec creation into
multiple prompts, but the agent did them all in one prompt because I didn't specify that clearly.

**How I caught it:** By paying attention to the output as it was being created.

**What I did about it:** I just left it because both the constitution and the specs seemed fine
for an initial result, but I kept it in mind going forward to give the AI clear instructions for
what to do and what not to do in each prompt so that it doesn't try to one-shot too much at once.

**Related:** commit `43dfd45` (Add constitution and shared bake-off spec via Spec Kit)
