# JM Car Wash Billing Manager

A single-owner customer, subscription, invoice and payment system built with Next.js, TypeScript and PostgreSQL. The interface is designed for a non-technical operator and keeps all business actions inside one dashboard.

## Main workflow

1. Add areas/buildings and plans.
2. Add a customer with vehicles, agreed price, billing frequency and start date.
3. The daily billing job creates due recurring invoices and marks late balances overdue.
4. Review the invoice, share its PDF through WhatsApp, and mark it sent.
5. Record full or partial payments with a note and payment method.
6. Open a customer's 360° profile to review invoices, payments, balance and activity.
7. Filter by location and export business reports when required.

Authentication is intentionally deferred while one owner operates the application. Add authentication before access is shared with employees or third parties.

## Professional structure

```text
src/
├── app/                 Next.js pages, layout and API Route Handlers
│   └── api/             Serverless customer, invoice, payment and billing APIs
├── components/          Reusable common and layout components
├── features/            Dashboard orchestration and business UI state
├── views/               Owner-facing business screens
├── services/            Browser API client
├── server/
│   ├── config/          Environment and PostgreSQL connection
│   ├── models/          Data access and transactional business rules
│   ├── services/        Recurring billing service
│   ├── validators/      Zod request validation
│   └── scripts/         Database migration runner
├── types/               Shared domain types
└── utils/               Billing, formatting and tested helpers
database/                Ordered, idempotent PostgreSQL migrations
```

The browser never accesses PostgreSQL directly. Route Handlers validate requests, models own SQL, and transaction-sensitive invoice/payment logic remains server-side.

## Local setup

Copy `.env.example` to `.env`, then set `DATABASE_URL` and a long random `CRON_SECRET`.

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The API and UI run from the same Next.js application, so only one command and one deployment are required.

## Vercel deployment

1. Create a PostgreSQL database that supports serverless connections (for example Neon).
2. Add `DATABASE_URL` and `CRON_SECRET` in Vercel project environment variables.
3. Run `npm run db:migrate` once against the production database.
4. Import the Git repository in Vercel; framework detection should select Next.js automatically.
5. Deploy and verify `/api/health` reports `ok: true`.

`vercel.json` runs billing maintenance daily at 00:05 UAE time (20:05 UTC). `CRON_SECRET` protects this endpoint.

Vercel Hobby is suitable for a temporary demo but its plan terms and limits should be checked before commercial production use. The database is a separate service and must remain active.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
npm run format:check
```

Secrets belong only in `.env` or the hosting provider's environment settings and must never be committed.

# Authentication setup

Authentication is fail-closed: do not deploy the login gate before creating the first
administrator account in the same database used by production.

1. Run `npm run db:migrate` against the intended database to create `app_users` and
   `app_sessions`.
2. Run `npm run auth:create-admin` in a private interactive terminal and enter the
   administrator's name, email, and a unique password of at least 14 characters.
3. Deploy the application. Open `/login` and verify sign-in and sign-out.

Sessions are HTTP-only, same-site cookies valid for 12 hours. Five failed passwords
lock an account for 15 minutes. The initial authorization role is `admin`; staff
accounts and limited permissions are not enabled yet. Protect the database URL and
do not store account passwords in `.env` or Git.
