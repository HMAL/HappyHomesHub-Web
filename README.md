# HappyHomesHub

**Application guide and developer reference**

HappyHomesHub brings landlords, tenants, and handymen together to manage rental homes, payments, maintenance, documents, and messages. This guide explains where to go in the application and how to run and work on the codebase.

## Contents

- [Using the application](#using-the-application)
- [Landlord portal](#landlord-portal)
- [Tenant portal](#tenant-portal)
- [Handyman portal](#handyman-portal)
- [Developer setup](#developer-setup)
- [Technology stack](#technology-stack)
- [Project layout](#project-layout)

## Using the application

Start at the public home page (`/`). From there, you can read about the service, choose a role, and create an account. The role overview pages explain the experience for [landlords](/for-landlords), [tenants](/for-tenants), and [handymen](/for-handymen).

| To | Go to |
| --- | --- |
| Create an account | `/signup` |
| Sign in | `/login` |
| Choose an account role | `/role-select` |
| Accept an invitation | `/join/:token` |
| Recover or reset a password | `/forgot-password` or `/reset-password` |
| Read the FAQ or contact the team | `/faq` or `/contact` |
| Browse articles | `/blog` |

After signing in, use the navigation for your account role to open its dashboard and tools. Portal pages require a signed-in account with the matching role.

## Landlord portal

Open `/landlord` for the dashboard. The portal navigation provides these areas:

| Area | What you can do |
| --- | --- |
| Properties | View properties, add one, and open or edit a property. |
| Tenants | Review tenant and tenancy information. |
| Maintenance | Track requests and open request details. |
| Rent | Review rent activity. |
| Messages | Message tenants and handymen. |
| Invite | Invite tenants to join. |
| Inspections | Review inspections and create one. |
| Expenses | Review expenses and add one. |
| Documents | Manage property and tenancy documents. |
| Handymen | Find and manage handyman connections. |
| Account | Manage the account, profile, billing, and notifications. |

## Tenant portal

Open `/tenant` for the dashboard. The portal navigation provides:

- **Application:** check application status or complete an application.
- **Screening:** view screening information when available.
- **Rent and deposit:** review rent and deposit details.
- **Repairs:** follow requests or submit a new repair request.
- **Messages:** communicate with the landlord.
- **Documents:** access shared documents.
- **Account:** manage account details.

## Handyman portal

Open `/handyman` for the dashboard. Use **Jobs** to review available work, **Profile** to manage your service profile, **Messages** to communicate, and **Account** to manage account details.

## Developer setup

### Prerequisites

- Node.js 22.6 or newer
- npm
- A Supabase project with the application's database and authentication configured

### Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a local environment file from the example. In PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Set the Supabase project values in `.env.local`:

   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Start the development server:

   ```sh
   npm run dev
   ```

Vite prints the local URL in the terminal. The Supabase URL and anonymous key are required for the app to start. Keep local credentials in `.env.local`; do not commit them.

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server. |
| `npm run build` | Type-check and create the production build, including prerendering. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the Vitest suite. |
| `npm run test:coverage` | Run tests with coverage reporting. |

## Technology stack

| Technology | Used for |
| --- | --- |
| React 18 and TypeScript | User interface and application code. |
| Vite 6 | Development server and production bundling. |
| React Router | Client-side routes and role-based portal layouts. |
| Tailwind CSS | Styling and responsive layouts. |
| Supabase | Authentication, database access, storage, and backend functions. |
| TanStack Query | Server data fetching and caching. |
| Zustand | Lightweight client state, including authentication and notifications. |
| Lucide React | Interface icons. |
| Vitest and Testing Library | Unit and component tests. |
| ESLint | Static code checks. |

The interface includes English and Spanish translation catalogs. Supabase schema changes are stored in `supabase/migrations/`, and server-side functions are in `supabase/functions/`.

## Project layout

```text
src/
  App.tsx                 Route definitions and app-level providers
  pages/                  Public pages and landlord, tenant, and handyman portals
  components/             Shared UI, brand, and reusable components
  lib/                    Supabase client, query setup, utilities, and app helpers
  stores/                 Zustand state stores
  locales/                English and Spanish translations
  types/                  Shared TypeScript types
supabase/
  migrations/             Database schema and policy migrations
  functions/              Supabase Edge Functions
public/                   Static assets, PWA files, and crawler files
scripts/                  Build and maintenance scripts
```

The main route map lives in `src/App.tsx`. Public pages are defined first, followed by the three protected role portals. Portal screens are grouped under `src/pages/<role>/`, with each role's shared navigation in its `_layout/` folder.
