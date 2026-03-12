# Health Tracker — Project Conventions

## Agent Instructions
After completing any task that changes architecture, conventions, file structure, env vars, deployment, or security:
1. Update the relevant sections of **this file** (CLAUDE.md)
2. Update **MEMORY.md** at `C:\Users\leigh.ellis.LNTCAREDEVS\.claude\projects\C--Projects-health-tracker\memory\MEMORY.md`

Do this before ending the session or moving to the next task. Do not wait to be reminded.

## Overview
Family health symptom and medication tracking PWA built with Next.js 16, Supabase, and Tailwind CSS v4.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4
- **Backend/Auth**: Supabase (PostgreSQL + Auth)
- **Hosting**: Vercel (auto-deploy from GitHub)
- **PWA**: Manual service worker + Next.js native manifest/icons

## Key Architectural Decisions

### Auth & Data Access (Dual-Client Pattern)
The app uses **two Supabase clients** with different roles:

1. **SSR client** (`lib/supabase/server.ts` → `createClient`)
   - Uses `@supabase/ssr` with cookie-based sessions
   - Used **only** for `supabase.auth.getUser()` (auth verification)
   - PostgREST queries via this client fail (see "Why Not RLS?" below)

2. **Admin client** (`lib/supabase/admin.ts` → `createAdminClient`)
   - Uses `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS)
   - Used for **all data reads and mutations** (families, people, symptom_entries, medications, medication_doses)
   - Server actions enforce authorization manually via `getFamilyRole()` helper (shared from `lib/action-helpers.ts`)
   - Protected by `import 'server-only'` — cannot be imported in client components

3. **Browser client** (`lib/supabase/client.ts` → `createClient`)
   - Used in client components (currently unused for data, only auth state if needed)

### Why Not RLS?
The `@supabase/ssr` client's PostgREST queries return `auth.uid() = null` in Next.js 16 server components. Root cause: the `setAll` cookie callback silently fails in server components (read-only cookies), causing the SSR client to drop the JWT session for PostgREST calls even though `getUser()` still works via the Auth API.

**Workaround**: All data access goes through the admin client. Authorization is enforced in application code (server actions check `getFamilyRole()` before every mutation).

RLS policies and `SECURITY DEFINER` helper functions remain in `schema.sql` for defense-in-depth.

### Data Model (Family-Scoped)
- **families**: A group of related users/people. All symptom data is scoped to the family.
- **family_members**: Links `auth.users` to families (role: admin | member)
- **people**: Individuals whose symptoms are tracked. May or may not have an auth account.
  - `user_id` is set when the person has an auth account; null for non-auth people (kids, etc.)
- **symptom_entries**: Symptom log entries, scoped to both `person_id` and `family_id`
  - `onset_date` (date, nullable): when the symptom actually started
  - `is_resolved` (boolean, default false): whether the symptom has ended
  - `resolved_at` (timestamptz, nullable): when it was resolved; stored as `YYYY-MM-DDT12:00:00.000Z` (noon UTC keeps date correct across UTC±12)
  - `logged_at`: server-set system timestamp (now()) — used for list ordering only, never shown to users
- **medications**: Medication records, scoped to `person_id` and `family_id`
  - `medication_name`, `dosage`, `frequency` (enum: once_daily, twice_daily, etc.), `med_type` (prescribed/otc)
  - `prescriber` (nullable): doctor name, only for prescribed medications
  - `start_date`, `end_date` (nullable): course dates
  - `is_active` (boolean, default true) + `discontinued_at` (timestamptz): mirrors symptom resolved pattern
- **medication_doses**: Individual dose records, scoped to `medication_id` and `family_id`
  - `taken_at` (timestamptz): actual moment the dose was taken (full ISO timestamp, NOT noon-normalized)
  - `notes` (nullable): e.g. "took with food"
- All users in a family see all symptoms and medications for all people in that family

### First-Time Setup Flow
When a user logs in for the first time (no `family_members` record exists):
1. A family is created automatically (named "My Family" initially)
2. A person record is created for the user (display_name from email prefix)
3. A family_member record is created (role: admin)
All of this happens in `initializeUserFamily()` in `lib/data-actions.ts`.

### Multi-User Families
Schema supports multiple auth users per family. Future feature: invite by email.
Currently: families are created per-user at signup. Schema is ready for merging families.

### PWA
- `app/manifest.ts` → Next.js native manifest at `/manifest.webmanifest`
- `app/icon.tsx` → Next.js native icon generation at `/icon`
- `app/apple-icon.tsx` → Apple touch icon at `/apple-icon`
- `public/sw.js` → Manual service worker (registered in layout)
- `components/ServiceWorkerRegistration.tsx` → Client component that registers SW

### Data Flow
- Protected pages: Server component → checks auth via SSR client → reads data via admin client → passes as props to client components
- Mutations: Client component → calls server action → action verifies auth (SSR client) → checks role (admin client) → mutates (admin client) → revalidates path
- No client-side data fetching (all via server components + server actions)

## Security

### Auth & Sign-Ups
- **Public sign-ups disabled** in Supabase Dashboard → Authentication → Sign In / Providers → "Allow new users to sign up" = OFF
- Users invited via Supabase Dashboard → Authentication → Users → "Invite user"
- Invited users get a magic link email, click it to confirm, account auto-created on first app visit
- Sign-up UI removed from `components/AuthForm.tsx` (sign-in only)

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://ltqznwemxgwwnpemmsin.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — server-only, no NEXT_PUBLIC_ prefix>
NEXT_PUBLIC_SITE_URL=<production URL or http://localhost:3000 for dev>
```
Set in `.env.local` for local dev, in Vercel dashboard for production.

## File Structure
```
app/
  layout.tsx          Root layout (metadata, PWA tags, service worker registration)
  page.tsx            Root page (redirects to /dashboard or /auth/login)
  manifest.ts         PWA web manifest
  icon.tsx            App icon (192×192 + 512×512)
  apple-icon.tsx      Apple touch icon
  globals.css         Tailwind v4 import + minimal globals
  auth/
    login/page.tsx    Sign in form (server + client)
    callback/route.ts Auth callback for email confirmation links
  dashboard/
    layout.tsx        Protected layout (auth guard)
    page.tsx          Tabbed dashboard (symptoms | medications, first-time setup)
    family/page.tsx   Family management (people, rename family)
components/
  AuthForm.tsx        Sign in UI (client, sign-up removed)
  DashboardTabs.tsx   Tab switcher for symptoms/medications (client)
  SymptomForm.tsx     Symptom logging form — "Started on" + "Ended on" date pair (client)
  SymptomList.tsx     Symptom list: inline edit, inline resolve date picker, filters (client)
  MedicationForm.tsx  Medication logging form — name, dosage, frequency, type, dates (client)
  MedicationList.tsx  Medication list: dose logging, inline edit, discontinue, dose history (client)
  FamilyManager.tsx   Family settings UI (client)
  Navbar.tsx          Top navigation bar (client)
  ServiceWorkerRegistration.tsx  Registers SW on mount (client)
lib/
  supabase/
    client.ts         Browser Supabase client (createBrowserClient)
    server.ts         Server Supabase client (createServerClient + cookies)
    admin.ts          Admin Supabase client (service_role key, bypasses RLS, server-only)
  types.ts            Shared TypeScript types/interfaces (symptoms + medications)
  utils.ts            Shared utilities (todayDateString — local-time YYYY-MM-DD)
  action-helpers.ts   Shared server action helpers (getAuthUser, getFamilyRole)
  auth-actions.ts     Server actions: signIn, signOut
  data-actions.ts     Server actions: CRUD for symptoms, people, family (uses admin client)
  medication-actions.ts Server actions: CRUD for medications + doses (uses admin client)
proxy.ts              Session refresh middleware (Next.js 16 convention)
public/
  sw.js               Basic service worker
supabase/
  schema.sql          Database schema (run in Supabase SQL editor)
```

## Colour Palette
- Primary: `teal-600` (#0d9488)
- Background: `gray-50` (#f9fafb)
- Cards: white
- Severity 1 (Mild): `green-100/green-800`
- Severity 2: `lime-100/lime-800`
- Severity 3 (Moderate): `yellow-100/yellow-800`
- Severity 4: `orange-100/orange-800`
- Severity 5 (Severe): `red-100/red-800`

## Dev Workflow
```bash
npm run dev    # Local dev server at localhost:3000
npm run build  # Production build
npm run lint   # ESLint
```
Push to GitHub → Vercel auto-deploys to production.

## Production
- **Vercel URL**: https://health-tracker-nine-ashen.vercel.app
- **Supabase Auth URL config** (set in Supabase Dashboard → Authentication → URL Configuration):
  - Site URL: `https://health-tracker-nine-ashen.vercel.app`
  - Redirect URLs: `https://health-tracker-nine-ashen.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`

## Database Schema Location
See `supabase/schema.sql` — run the full file in the Supabase SQL editor to set up tables, grants, RLS policies, and helper functions.

## Learnings
_Important gotchas, decisions, and insights discovered during development._

- **middleware.ts → proxy.ts**: Next.js 16 requires the middleware file to be named `proxy.ts` and export `proxy` instead of `middleware`. Critical for session refresh to work on every request.
- **Auto-push after commit**: Always push to GitHub after committing — Vercel auto-deploys from master, no confirmation needed (sole developer).
- **Worktree workflow**: Claude Code creates worktrees at `.claude/worktrees/<name>/` for isolated development. Changes should be PR'd or merged back to master.
- **RLS + @supabase/ssr broken in server components**: `auth.uid()` returns null in PostgREST queries made from Next.js server components. Root cause: the `setAll` cookie callback silently fails in read-only server component context, causing the SSR client to drop the JWT session for PostgREST while `getUser()` still works (different code path). Workaround: use admin client (`service_role` key) for all data access, enforce authorization in application code.
- **Supabase RLS infinite recursion**: Policies on `family_members` that reference `family_members` itself cause infinite recursion. Fixed with `SECURITY DEFINER` helper functions (`is_family_member`, `is_family_admin`) that bypass RLS when checking membership.
- **Supabase GRANT required**: Manually-created tables need explicit `GRANT ALL ... TO authenticated, anon, service_role` — Supabase does not always apply default privileges.
- **First-time setup order**: Must insert `family_members` BEFORE `people` — the people INSERT RLS policy checks for an existing family_members row.
- **Admin client authorization pattern**: Every server action: (1) verify auth via SSR client `getUser()`, (2) check family role via `getFamilyRole()` with admin client, (3) perform mutation with admin client. The `admin.ts` module uses `import 'server-only'` to prevent accidental client-side import.
- **Public sign-ups disabled**: Turn off "Allow new users to sign up" in Supabase for security. Invite users via Dashboard instead. Removed sign-up tab from UI.
- **logged_at is server-only**: `logged_at` is set to `now()` server-side and used only for list ordering (DESC). It is never shown to users or accepted from form input. The user-facing date is `onset_date`.
- **Date storage convention**: Resolved/onset dates from user input are stored as `YYYY-MM-DDT12:00:00.000Z` (noon UTC). This keeps the displayed date correct in any UTC±12 timezone. When displaying, always normalize to local midnight via `.setHours(0,0,0,0)`.
- **todayDateString() — use local date parts**: `new Date().toISOString().slice(0,10)` returns the UTC date, which is wrong after 11pm in UTC+1. Use `lib/utils.ts#todayDateString()` which uses local `getFullYear/getMonth/getDate`.
- **Backfill migration**: Ran `UPDATE symptom_entries SET onset_date = (logged_at AT TIME ZONE 'Europe/London')::date WHERE onset_date IS NULL` to migrate old entries to the duration tracking feature.
- **Edit existing entries**: `updateSymptomEntry(entryId, formData)` server action updates symptom_name, severity, notes, onset_date, is_resolved, resolved_at. Inline edit form in SymptomList (pencil icon on hover).
- **resolveSymptomEntry now takes a date**: Signature is `resolveSymptomEntry(entryId: string, resolvedDate: string)`. The "Mark resolved" button shows an inline date picker (defaults today, backdatable to onset_date) before calling the action.
- **Tabbed dashboard**: Dashboard uses `?tab=symptoms` / `?tab=medications` query param for tab state. Server component reads `searchParams` to load only the active tab's data. Default tab is symptoms.
- **Shared auth helpers**: `getAuthUser()` and `getFamilyRole()` extracted to `lib/action-helpers.ts` — imported by both `data-actions.ts` and `medication-actions.ts`.
- **Medication dose timestamps**: Unlike dates in symptom_entries (noon-UTC), medication dose `taken_at` is a real ISO timestamp (actual moment). This is because doses represent specific moments in time for "time since last dose" calculations.
- **Medication frequency**: Stored as CHECK-constrained enum string (once_daily, twice_daily, three_daily, four_daily, every_8_hours, every_12_hours, as_needed, other). `frequency_notes` for free-text when "other".
- **Medication discontinuation**: Mirrors symptom resolution — `is_active` boolean + `discontinued_at` timestamptz (noon-UTC convention). `reactivateMedication()` can undo discontinuation.
