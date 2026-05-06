# NoFlake

NoFlake is a Solana-native anti-no-show RSVP layer for free events.
Attendees lock a refundable USDC deposit to reserve a seat, check in on-site, and get refunded automatically when they show up.

This repository currently ships a demo-ready MVP with:

- organizer event creation
- attendee reservation with a mock wallet connect step
- organizer check-in and settlement flow
- shared domain schemas across frontend and backend
- a scaffolded Anchor contract package for the onchain layer

## Product Scope

MVP focus:

- event creation
- deposit-based seat reservation
- waitlist handling
- organizer check-in
- end-of-event automated settlement

Out of scope for MVP:

- full ticketing platform
- transfer marketplace
- biometric/GPS attendance verification

## Repository Layout

- `frontend/` - organizer and attendee web app
- `backend/` - API and background jobs
- `contracts/` - Solana onchain program(s)
- `shared/` - shared types and schema contracts
- `infra/` - local/prod environment configuration
- `docs/` - product, design, and delivery documentation

## Architecture (High-Level)

1. `frontend` collects user actions (create event, reserve seat, check in).
2. `contracts` stores event/reservation state and controls fund movement.
3. `backend` orchestrates waitlist updates and settlement triggers.
4. `shared` keeps request/response and domain models consistent.

## Current Demo Flow

1. Open `/organizer` and create an event.
2. Open `/events/evt_1` and connect the mock wallet.
3. Reserve a seat with the refundable USDC deposit flow.
4. Open `/check-in/evt_1` and check in attendees.
5. Settle the event and show refund / forfeiture summary.

## Local Development

Install dependencies:

```powershell
cd shared
npm install
cd ..\backend
npm install
cd ..\frontend
npm install
cd ..\contracts
npm install
```

Run the apps:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Key local URLs:

- frontend: `http://127.0.0.1:3000`
- backend: `http://127.0.0.1:4000`
- organizer flow: `http://127.0.0.1:3000/organizer`
- attendee flow: `http://127.0.0.1:3000/events/evt_1`
- check-in flow: `http://127.0.0.1:3000/check-in/evt_1`

## Verification

Shared package:

```powershell
cd shared
npm run test
```

Backend:

```powershell
cd backend
npm run test
```

Frontend E2E:

```powershell
cd frontend
npm run test:e2e
```

Contracts scaffold:

```powershell
cd contracts
cargo check
```

`anchor test` is planned, but it requires local `anchor` and `solana` CLIs to be installed and available on `PATH`.

## Milestone Targets

- M1: project scaffolding complete
- M2: event + reservation flow works locally
- M3: check-in + settlement flow works locally
- M4: demo script and submission artifacts finalized
