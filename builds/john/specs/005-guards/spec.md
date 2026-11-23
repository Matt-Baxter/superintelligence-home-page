# Feature Specification: Sign-in protection, abuse guards and the test sign-in

**Feature Branch**: `v0/ci-lab-activity-560c685d`

**Created**: 2026-11-22

**Status**: Proposed, **not approved**. Built behind settings that a super admin can turn off, so it can be reviewed in place. Nothing here changes how stories are scored or ranked. Numbered from REQ-057 because REQ-053..056 are reserved for the research-line renumbering (`handoff/SI-HANDOFF-2026-11-07.md`, section 2).

**Input**: "make the free tier valuable, add bot protection and bad-actor prevention, protect the sign-in layer, expose no AI or jobs that can be abused, add a safe admin sign-in override for preview, and make it all configurable from the UI behind the super admin layer."

## Overview

Reading stays free and public: the feed, evidence, glossary, knowledge graph and story pages need no account (REQ-001). An account adds saves, votes, notes, reading lists and the agents' traces, at no cost. Anything that runs a model or a job stays admin-only.

This feature adds the guards around that line:

1. stop scripted sign-ups without a puzzle a person has to solve;
2. stop password guessing per account, not just per address;
3. cap how much work one member can start on the routes that do real work;
4. give previews a one-click test sign-in that cannot exist in production;
5. let a super admin change every setting from `/m/admin#security`, per environment, and see what each change does before saving.

## Requirements

- **REQ-057**: Sign-up MUST refuse a form whose hidden field is filled or that was submitted faster than a configurable minimum (default 1.5 s), and the refusal MUST read as an ordinary error. A super admin MAY pause sign-up; the first account MUST always be creatable.
- **REQ-058**: Sign-in MUST lock an account for a configurable time (default 15 min) after a configurable number of wrong passwords (default 8), counted per account across all addresses, answer a locked account the same way whether or not the password is right, and let a super admin clear a lock.
- **REQ-059**: Every route that runs a model, fetches from outside, parses an upload or writes MUST be signed-in, and each MUST have a per-member budget (limit and window, scaled by one setting); admins are not limited. Guests MUST NOT reach any route that runs a model or starts a job, and every model run and job MUST stay admin-only.
- **REQ-060**: Previews and local runs MUST offer a one-click test sign-in as a test admin or a test reader. It MUST be impossible in production (no setting turns it on there), a Vercel preview MUST also need `EMULATOR=1` because previews can share the production database, the test accounts MUST be created on first use with an unguessable password, and each use MUST be written to the audit log.
- **REQ-061**: Security settings MUST be validated by one schema, stored per environment (local, preview, production never share them), readable and changeable only by a super admin (the names in `SUPER_ADMIN_USERNAMES`, otherwise the oldest admin account; the test admin only while the test sign-in is on), and every save MUST be written to the audit log with what changed.
- **REQ-062**: The settings page MUST show worked cases (a person and a script signing up, password guessing, a member over a budget, the test sign-in) re-run by the same guard code against the draft settings as they are changed, marking each case whose result changes, before anything is saved.

### Key Entities

- **Guard settings**: one row per environment in `guard_settings`, validated by the zod schema in `lib/guards.js`.
- **Guard event**: a refusal (bot check, lock, budget, paused sign-up), counted per server instance.
- **Test account**: `emulator.admin` or `emulator.reader`, created by the emulator, a reserved name no one can sign up with, marked in the audit log.

## Success criteria

- A guest request to any model, job or upload route returns 401; a member request to an admin route returns 403.
- A script-speed sign-up and a filled hidden field are refused; a person-speed sign-up succeeds.
- The ninth wrong password on one account is locked even when the guesses come from different addresses.
- `POST /api/auth/emulate` returns 404 in production whatever the settings say.
- Changing a setting on the Security tab changes the worked-case table before Save, and Save adds one audit row.
