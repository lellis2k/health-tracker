# Health Tracker — Project Conventions

## Overview
Family health symptom tracking PWA built with Next.js 16, Supabase, and Tailwind CSS v4.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4
- **Backend/Auth**: Supabase (PostgreSQL + Auth)
- **Hosting**: Vercel (auto-deploy from GitHub)
- **PWA**: Manual service worker + Next.js native manifest/icons

## Key Architectural Decisions

### Auth & Session Management
- Uses `@supabase/ssr` for server-side session handling with cookies
- `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`, export `proxy` not `middleware`) refreshes the session token on every request (critical for persistence)
- Server components use `createServerClient` from `lib/supabase/server.ts`
- Client components use `createBrowserClient` from `lib/supabase/client.ts`
- Server actions in `lib/auth-actions.ts` and `lib/data-actions.ts`

### Data Model (Family-Scoped)
- **families**: A group of related users/people. All symptom data is scoped to the family.
- **family_members**: Links `auth.users` to families (role: admin | member)
- **people**: Individuals whose symptoms are tracked. May or may not have an auth account.
  - `user_id` is set when the person has an auth account; null for non-auth people (kids, etc.)
- **symptom_entries**: Symptom log entries, scoped to both `person_id` and `family_id`
- All users in a family see all symptoms for all people in that family

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
- Protected pages: Server component → checks auth → passes data as props to client components
- Mutations: Client component → calls server action → server action revalidates path
- No client-side data fetching (all via server components + server actions)

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://ltqznwemxgwwnpemmsin.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
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
    login/page.tsx    Sign in / Sign up form (server + client)
    callback/route.ts Auth callback for email confirmation links
  dashboard/
    layout.tsx        Protected layout (auth guard)
    page.tsx          Main dashboard (symptom form + list)
    family/page.tsx   Family management (people, invite)
components/
  AuthForm.tsx        Sign in / Sign up UI (client)
  SymptomForm.tsx     Symptom logging form (client)
  SymptomList.tsx     Symptom entry list (client, gets data from server)
  PersonSelector.tsx  Person picker component (client)
  Navbar.tsx          Top navigation bar (client)
  ServiceWorkerRegistration.tsx  Registers SW on mount (client)
lib/
  supabase/
    client.ts         Browser Supabase client (createBrowserClient)
    server.ts         Server Supabase client (createServerClient + cookies)
  types.ts            Shared TypeScript types/interfaces
  auth-actions.ts     Server actions: signIn, signUp, signOut
  data-actions.ts     Server actions: CRUD for symptoms, people, family
middleware.ts         Session refresh middleware
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

## Database Schema Location
See `supabase/schema.sql` — run the full file in the Supabase SQL editor to set up tables and RLS policies.
