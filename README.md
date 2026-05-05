# NoFlake

NoFlake is a Solana-native anti-no-show RSVP layer for free events.
Attendees lock a refundable USDC deposit to reserve a seat, check in on-site, and get refunded automatically when they show up.

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

## Local Development Plan

1. Bootstrap frontend app in `frontend/`.
2. Bootstrap backend service in `backend/`.
3. Scaffold Solana program in `contracts/`.
4. Define shared domain schema in `shared/`.
5. Connect end-to-end happy path:
   create event -> reserve -> check in -> settle.

## Milestone Targets

- M1: project scaffolding complete
- M2: event + reservation flow works locally
- M3: check-in + settlement flow works locally
- M4: demo script and submission artifacts finalized
