# Project Notes

## 2026-03-12 - Pre-medication feature checkpoint

Context: considering medication tracking/reminders, but validating what to improve first.

### Options and current decisions

1. Auth/session hardening (remove admin-client-first data access pattern)
- Status: `Discussed, not implementing yet`
- Current thought: wants a clear explanation before deciding.

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

### Why item 1 exists

Right now the app reads/writes data using the Supabase service role in server code, then does authorization checks in app logic. That works, but it means a code mistake can expose or modify data across families because service-role bypasses RLS completely.

Moving back to normal user-scoped Supabase access (with working session propagation + RLS enforcement) reduces blast radius and makes the database enforce isolation automatically, not just application code.

### Risks if item 6 stays deferred (personal-use mode)

- Harder debugging: failures may be silent without error tracking/logging.
- Recovery risk: without tested backups/export workflow, accidental data loss is harder to recover from.
- Slower incident response: no audit trail for "what changed and when."

For a personal app with low usage, these are usually acceptable short-term tradeoffs, but they become painful once data volume or dependence on the app increases.
