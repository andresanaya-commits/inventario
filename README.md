# Packaging Inventory Control

A functional internal packaging inventory application for fresh produce operations. English UI, administrator and supplier roles, dynamic catalog, supplier assignments, audited stock movements, separate incoming transit/production, low-stock monitoring, searchable inventory, history, and operational dashboards.

## Stack and architecture

Next.js 16 App Router, React 19, strict TypeScript, custom responsive accessible component styles, Lucide icons. The API is Node.js server code; credentials and session tokens never enter client JavaScript. Supabase mode uses PostgreSQL, Supabase Auth, RLS, and atomic inventory RPCs. Local demonstration mode uses Node's SQLite driver, salted scrypt password hashes, and opaque server sessions. It is a real persistent backend, not a browser mock or localStorage demo.

- `app/page.tsx`: authenticated workspace, catalog forms, inventory, history, dashboards and settings.
- `app/api/[...path]/route.ts`: authenticated API, session cookies, mutation dispatch.
- `lib/service.ts`: validation, role enforcement, backend adapters and transactions.
- `lib/local.ts`: persisted local database and fictional seed data.
- `lib/types.ts`: inventory calculations and shared types.
- `supabase/001_schema.sql`: normalized PostgreSQL schema, constraints, indexes, RLS, Auth profile trigger and RPCs.
- `supabase/002_demo_seed.sql`: fictional suppliers and packaging catalog.
- `supabase/003_demo_balances.sql`: audited sample opening balances, deliveries and incoming orders.

## Local installation

Use Node.js **24** and npm. Each cloud task is already isolated; use the existing `/workspace/inventario` checkout without creating worktrees.

```sh
cd /workspace/inventario
npm ci --cache /workspace/.npm-cache
npm run dev
```

No environment file is required for local mode. `.env.example` documents both modes. If desired, copy it to `.env.local`. For a production build:

```sh
npm run build
npm run typecheck
npm start
```

The server listens on port 3000. Local data is automatically initialized at `.data/inventory.sqlite` on the first API request and survives process restarts. Back up this file before clearing local data. `.data`, `.env` files, and screenshots are ignored by Git.

### Fictional demo accounts

| Account | Password | Access |
| --- | --- | --- |
| admin@example.test | DemoAdmin123! | Administrator |
| supplier1@example.test | DemoSupplier123! | Harvest Pack Solutions |
| supplier2@example.test | DemoSupplier123! | Valley Film & Bag |
| supplier3@example.test | DemoSupplier123! | Orchard Label Co. |

Local initialization creates three suppliers, three categories, six configurable units, fifteen items, twenty-three inventory movements, and five open incoming orders. These public demonstration credentials are **only for private local evaluation**. Do not deploy local mode publicly or use real business data in it.

## Supabase installation

1. Create a Supabase project. Run `supabase/001_schema.sql` in SQL Editor once, then optionally run `002_demo_seed.sql`. These are ordered initial migrations, not repeatable update migrations.
2. Create an administrator in Supabase Authentication. The Auth trigger creates an inactive supplier profile automatically. In SQL Editor, activate and promote the intended administrator using the exact user UUID:

   ```sql
   update public.profiles
   set role = 'ADMINISTRATOR', active = true, supplier_id = null,
       name = 'Your Administrator'
   where id = 'REPLACE_WITH_AUTH_USER_UUID';
   ```

3. Create supplier users in Supabase Authentication. In the application's Users module, assign each profile its supplier and activate it. Users cannot assign their own role or supplier. Public sign-up alone never grants inventory access.
4. For full fictional seed balances, run `003_demo_balances.sql` after activating the administrator. It uses audited RPCs to create 23 movements and 5 incoming orders. Existing assignments with movements are skipped. Do not run catalog seed twice.
5. Set the following runtime variables securely in environment settings or `.env.local`:

   ```dotenv
   DATA_BACKEND=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```

6. Allow the exact project hostname in cloud network settings if egress is restricted. Restart the server, sign in with the Supabase account, and check the workspace's **Supabase** indicator.

The publishable/anon key is public by design. Authorization depends on the authenticated user's JWT and RLS, not on that key. No service-role key is needed or used. Never add a service-role key to public environment variables. Do not commit credentials. The local demo accounts are not created in Supabase Auth.

## Authentication and permissions

Sessions are HTTP-only, SameSite Strict cookies, with Secure enabled in managed production mode. Sessions expire after one hour; sign in again after expiry. Logout revokes the local session or signs out the managed session and clears the cookie. The API checks the current active profile for each operation.

Administrators manage suppliers, categories, units, items, assignments, minimum stock, users and settings. Suppliers only read their own suppliers, assignments, incoming entries, movements, and assigned catalog items. They may record receipt, usage and production movements and create/receive their own incoming shipments. Supplier adjustments and catalog administration are rejected by the API and PostgreSQL policies/RPCs.

In Supabase, RLS is enabled on every application table. Helpers resolve the caller's active profile using `auth.uid()`, never a client-supplied supplier. Inventory history has SELECT permissions only; changes require correction movements. Direct balance updates are forbidden even to authenticated administrators; RPCs lock assignment rows and update both ledger and balance in a transaction. Supabase Auth administration remains in the Supabase console; the Users module manages existing profiles and access. Local mode additionally creates demo users through its Users module.

## Inventory rules

An item can be assigned to multiple suppliers; balances and minimums belong to each assignment. Existing assignments cannot be moved to another item/supplier, preserving ledger history. Deactivate an assignment and create a new one instead.

- `INITIAL`, `RECEIPT`, `PRODUCTION`: nonnegative inventory additions (zero rejected for manual entries).
- `USAGE`: entered as a positive quantity, recorded as a negative delta.
- `ADJUSTMENT`, `TRANSFER`, `OTHER`: administrator-only signed delta.
- `TRANSFER` records a signed change for one assignment. For an inter-supplier physical transfer, administrators must record both referenced legs; automatic paired transfer orchestration is not part of this version.
- Large movements above 10,000 units and reductions exceeding 50% require explicit confirmation.
- Negative balances require a confirmed administrator `ADJUSTMENT`.
- Every movement records actor, timestamp, type, prior quantity, delta, new quantity, reference and notes.
- Incoming stock is separate from available stock. Adding an incoming order does not change availability. Receiving it atomically creates a receipt and marks it received; a second receipt is rejected.
- `Available + Incoming = current + transit + production`.
- `Pending to Produce = max(minimum - current - transit - production, 0)`.
- Out of stock: current <= 0. Below minimum: current < minimum. Approaching minimum: current <= minimum × warning threshold. Healthy: above threshold.

Dashboard category bars show item counts to avoid aggregating incompatible units. The incoming summary explicitly includes different units; use item-level figures for operational decisions. Statuses use both color and text/icons.

## Validation

Start the local server, then run:

```sh
npm run typecheck
npm test
node scripts/browser.mjs
```

`npm test` checks actual HTTP authentication, seeded data, supplier isolation, forbidden operations, inventory arithmetic, rejected negative/zero quantities, incoming receipt, duplicate receipt rejection, category CRUD, self-access protection and concurrent balance updates. It creates audit entries and an inactive test category; restores tested stock quantities. Run it only against fictional local data.

`browser.mjs` uses Playwright and installed `/usr/bin/chromium` (override `CHROMIUM_PATH` if necessary). It tests rendered login, dashboard, search, item detail, movement entry, supplier navigation/data isolation and mobile layout. Screenshots are ignored under `.data`. It records two opposing test movements.

PostgreSQL policies and functions were also validated against PostgreSQL 17 using Supabase-like Auth roles and JWT context. For isolated reproduction, create a disposable PostgreSQL database, apply `scripts/postgres-bootstrap.sql`, the first two migrations, and `scripts/postgres-test.sql` with `psql -v ON_ERROR_STOP=1`. **The bootstrap is for a disposable PostgreSQL test instance, not Supabase.** The SQL test checks RLS, ledger arithmetic, permissions, immutable history, negative rejection and duplicate receipt prevention. It modifies only its disposable database.

No live managed Supabase project or Vercel deployment has been validated without external configuration. Production onboarding must test the configured project with real Auth sessions before introducing real inventory.

## Vercel deployment

Import the GitHub repository into Vercel, select Next.js and Node 24, add the three managed-mode variables above, apply the migrations to Supabase, and deploy. Do not deploy SQLite mode: serverless filesystems are ephemeral and do not provide shared durable writes. Managed mode uses an in-memory unused SQLite instance internally and stores all application data in Supabase. Set Supabase Auth Site URL/redirect allowlists to your production domain for Auth management flows. This application uses password login, with no public registration; manage password recovery through your organization's Supabase Auth workflow.

## Current scope

The first version includes operational CRUD with deactivation, assignment management, movement/history filtering, inventory sorting/pagination, dynamic categories/units/suppliers, incoming receipt, role-based navigation, account information, settings, dialogs, feedback, empty/error states and responsive design. Pagination/search operate on the authorized dataset loaded by the API; adequate for hundreds of items, but large deployments should migrate to server-side pagination and filtered queries. Production email notifications, automated purchase orders, paired transfers, and password-reset UI are future extensions.
