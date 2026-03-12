# Project Notes

## 2026-03-12 - Pre-medication feature checkpoint

Context: considering medication tracking/reminders, but validating what to improve first.

### Options and current decisions

1. Auth/session hardening (remove admin-client-first data access pattern)
- Status: `Discussed, not implementing yet`
- Current thought: principle is sound, but complexity is medium-high. Hold until codebase grows or team expands.

2. Automated tests
- Status: `Deferred`
- Current thought: personal-use app for now, likely acceptable to skip short term.

3. Symptom insights (weekly summary, ongoing view, trends)
- Status: `Pinned for later`
- Current thought: useful, but not needed right now.

4. Export/share for appointments (CSV/PDF)
- Status: `Pinned for later`
- Current thought: valuable; revisit later.

5. Notification infrastructure
- Status: `Deferred`
- Current thought: no current use-case; avoid premature complexity.

6. Operational guardrails (monitoring/logging/backups)
- Status: `Deferred with risk accepted`
- Current thought: personal-use scope lowers urgency; will add if/when needed.

### Why item 1 exists — detailed analysis (2026-03-12)

**ChatGPT's suggestion is architecturally correct in principle** — RLS enforces family boundaries at the DB layer regardless of app bugs, and service-role has unlimited blast radius.

**But the admin-client pattern exists for a real technical reason, not laziness.** The `@supabase/ssr` client's `setAll` cookie callback silently fails in Next.js 16 server components (cookies are read-only there), so `auth.uid()` returns null in PostgREST queries even though `getUser()` still works. RLS can't enforce anything if it can't see who the user is.

**The real fix is a two-step job:**
1. Solve JWT propagation — manually extract the access token from cookies and inject it as `Authorization: Bearer <token>` instead of relying on the broken `setAll` path. This makes `auth.uid()` work in PostgREST.
2. Then switch data access to the SSR client and let RLS do the enforcement, removing manual `getFamilyRole()` checks.

**Migration complexity: medium-high.**
- Every data access path in `data-actions.ts` needs rewriting
- RLS policies in `schema.sql` must cover every query pattern (gaps are silent — return empty rows, not errors)
- First-login setup still needs the admin client (bootstrapping — no `family_members` row yet)
- Needs careful testing with two users in the same family

**Current recommendation:** Don't migrate yet. The existing pattern is consistently applied and well-documented. Reconsider if the codebase grows (more actions = more chances to miss the auth-check pattern) or more developers join.

### Risks if item 6 stays deferred (personal-use mode)

- Harder debugging: failures may be silent without error tracking/logging.
- Recovery risk: without tested backups/export workflow, accidental data loss is harder to recover from.
- Slower incident response: no audit trail for "what changed and when."

For a personal app with low usage, these are usually acceptable short-term tradeoffs, but they become painful once data volume or dependence on the app increases.
