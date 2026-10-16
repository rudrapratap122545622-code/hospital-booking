<div align="center">

# 🏥 ClinicFlow

**Appointments, walk-ins and live token queues for small clinics, in one clean web app.**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

ClinicFlow is built for the Indian clinic workflow: per-doctor token queues, morning/evening shifts, walk-ins that skip the booking form, and a public booking + queue page patients can use from their phone.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Creating your first clinic](#creating-your-first-clinic)
- [Routes](#routes)
- [Project structure](#project-structure)
- [Security model](#security-model)
- [Deploying to Vercel](#deploying-to-vercel)
- [Roadmap](#roadmap)
- [License](#license)

## Features

| | |
|---|---|
| 📅 **Public booking** | Patients pick a doctor, day and shift, and get a booking reference. No account needed. |
| 📺 **Live queue board** | Token numbers + first name and last initial only. Safe for a waiting-room screen or a patient's phone. |
| 🧾 **Reception dashboard** | Per-doctor queues for any day. Check in booked patients, add walk-ins, complete consultations. |
| 🗂️ **Appointments list** | Filterable table of all bookings with one-click check-in. |
| 🩺 **Doctor workspace** | Each doctor sees only their own queue: call next, mark complete, pause. |
| ⚙️ **Settings** | Clinic hours, doctors, staff accounts and per-staff page permissions, all from the UI. |
| 🔐 **Role-based access** | Owners see everything, receptionists see reception + appointments, doctors see their own workspace. |
| 🛡️ **Row-level security** | Enforced in Postgres. One clinic can never read another clinic's data. |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Backend | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel |
| Package manager | npm |

## Getting started

**Prerequisites:** Node.js 20+, npm, and a free [Supabase](https://supabase.com) account.

### 1. Clone and install

```bash
git clone https://github.com/rudrapratap122545622-code/hospital-booking.git
cd hospital-booking
npm install
```

### 2. Create a Supabase project

1. Create a new project at [supabase.com](https://supabase.com) (pick the Mumbai region for India).
2. Go to **Project Settings → API** and copy the **Project URL**, **anon key** and **service_role key**.

### 3. Run the database migrations

In the Supabase **SQL Editor**, run these in order:

1. `supabase/migrations/0001_init.sql` creates tables, indexes and RLS policies.
2. The permissions addendum adds the `permissions` column to `clinic_staff`.
3. The security hardening SQL adds strict RLS.
4. The public views SQL creates `public_clinic`, `public_doctors` and `public_queue`, and grants `select` on them to `anon` and `authenticated`.

### 4. Configure environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

| Variable | Used for | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API endpoint | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public reads and staff auth, always behind RLS | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Creating staff accounts via `/api/staff` | **No, server only** |

> ⚠️ Never commit `.env.local`. It is already in `.gitignore`.

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Creating your first clinic

ClinicFlow runs **one Supabase project per clinic**. Onboarding a clinic is a three-step vendor task:

1. **Supabase → Authentication → Users → Add user**, and tick *Auto Confirm User*.
2. **Table Editor → `clinics`**, insert a row with the clinic name and timezone, then copy the row's `id`.
3. **Table Editor → `clinic_staff`**, insert a row linking the user to the clinic:

   | Column | Value |
   |---|---|
   | `user_id` | UID from step 1 |
   | `clinic_id` | UUID from step 2 |
   | `role` | `owner` |
   | `permissions` | `{reception,appointments,doctor,settings}` |

The owner can now sign in at `/login` and add doctors and staff entirely through the UI.

Full vendor checklist: [`docs/clinic-setup.md`](docs/clinic-setup.md)

## Routes

| Path | Who | Auth |
|---|---|---|
| `/` | Everyone, redirects to `/book` | No |
| `/book` | Patients, book an appointment | No |
| `/queue` | Patients, live queue | No |
| `/login` | Clinic staff sign-in | No |
| `/reception` | Receptionists, owners | `reception` permission |
| `/appointments` | Receptionists, owners | `appointments` permission |
| `/doctor` | Doctors, owners | `doctor` permission |
| `/settings` | Owners | `settings` permission |

## Project structure

```
src/
├── app/
│   ├── (staff pages)/     # reception, appointments, doctor, settings
│   ├── book/              # public booking flow
│   ├── queue/             # public live queue
│   ├── login/             # staff login
│   └── api/staff/         # server route that creates staff accounts
├── components/
│   ├── layout/            # AppShell, Sidebar, Topbar
│   └── ui/                # Button, Card, Badge, Dialog, DayPicker
├── lib/
│   ├── supabase/          # client, server and middleware helpers
│   ├── store.ts           # Zustand store (data + actions)
│   ├── types.ts           # domain types
│   └── utils.ts           # cn(), formatters
└── proxy.ts               # route protection + permission enforcement
```

## Security model

- **RLS on every table.** Staff can only see rows that belong to their clinic.
- **Safe public views.** The booking and queue pages read from `public_clinic`, `public_doctors` and `public_queue`, which expose only non-sensitive fields. The queue view builds "first name + last initial" inside Postgres, so full patient names never reach anonymous users.
- **Server-side staff creation.** Accounts are created in `/api/staff` with the service role key, which never appears in browser code.
- **Defence in depth.** Permissions are enforced in three places: the proxy (routes), the sidebar (UI) and RLS (data).

## Deploying to Vercel

1. In Vercel, click **New Project** and import this repo.
2. Add the three environment variables from [step 4](#4-configure-environment-variables).
3. Click **Deploy**.

Each clinic gets its own Supabase project and its own Vercel project (simplest), or you can use per-domain environment variables.

## Roadmap

**Included in this version**

- [x] Appointments, walk-ins and token queues
- [x] Multi-doctor, per-doctor queues
- [x] Shift-based scheduling
- [x] Public booking + public queue
- [x] Role-based staff accounts

**Not yet**

- [ ] SMS / WhatsApp reminders
- [ ] Electronic medical records
- [ ] Billing, insurance, pharmacy
- [ ] AI features

## License

Released under the [MIT License](LICENSE).
