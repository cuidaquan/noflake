# NoFlake

NoFlake is a Solana-native anti-no-show RSVP layer for free events.
Attendees lock a refundable USDC deposit to reserve a seat, check in on-site, and get refunded automatically when they show up.

This repository currently ships a demo-ready MVP with:

- organizer event creation
- attendee reservation with a mock wallet connect step
- organizer check-in, undo, cancellation, and settlement flow
- shared domain schemas across frontend and backend
- an Anchor contract package for event lifecycle, waitlist, cancellation, and settlement state

## Product Scope

MVP focus:

- event creation
- deposit-based seat reservation
- waitlist handling
- reservation cancellation with earliest-waitlist promotion
- organizer check-in and undo
- organizer event cancellation
- sponsor-mode configuration
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
4. Fill the last seat and explain that later attendees are waitlisted.
5. Open `/check-in/evt_1` and check in attendees.
6. Settle the event and show refund / forfeiture summary.

## Contract Status

The onchain package currently covers:

- event initialization with per-host multi-event support
- reserved and waitlisted seat allocation
- reservation cancellation
- earliest-waitlist promotion after a reserved seat is cancelled
- organizer check-in before settlement
- organizer undo-check-in before settlement
- host-side event cancellation state
- cutoff-gated settlement
- cutoff-gated reservation cancellation
- finalization only after all active reservations are settled

Deposit vault transfers and real USDC movement are still a follow-up layer on top of the current account and state machine logic.

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

Full Anchor integration tests require local `anchor` and `solana` CLIs to be installed and available on `PATH`.

Current machine status:

- backend tests pass locally
- frontend E2E tests pass locally
- contract `cargo check` passes locally
- Anchor integration tests are authored but cannot be executed on this machine because `anchor` and `solana` CLIs are not installed on `PATH`

## Solana / Anchor Local Development

The `contracts/` package is now wired for real local Anchor testing.

Current local contract toolchain:

- `anchor-cli 0.32.1`
- `solana-cli 3.0.15`
- `@coral-xyz/anchor 0.32.1`

### Contract Setup

Install contract dependencies:

```bash
cd contracts
npm install
```

Make sure the Anchor wallet exists:

```bash
mkdir -p ~/.config/solana
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
```

Useful version checks:

```bash
rustc --version
cargo --version
node --version
npm --version
solana --version
anchor --version
```

### Contract Commands

Build the local SBF artifact:

```bash
cd contracts
npm run build:sbf
```

Run the clean local validator + real integration test flow:

```bash
cd contracts
npm run test:localnet
```

Run Anchor's built-in test command:

```bash
cd contracts
anchor test
```

### Recommended Contract Workflow

For day-to-day local contract work, prefer:

```bash
cd contracts
npm run test:localnet
```

That flow:

- builds the program with the correct SBF platform tools
- regenerates the IDL and TS types
- starts a fresh local validator
- loads the local program binary
- runs the TypeScript integration test against localnet

### Notes About `anchor test`

`anchor test` works in this repo, but on this machine it may print a trailing `websocket error` after the test has already passed.

If the output includes:

```text
1 passing
```

the contract test succeeded.

If you want the cleanest output, use:

```bash
cd contracts
npm run test:localnet
```

### Contract Troubleshooting

If you see `feature edition2024 is required`, reload your shell first:

```bash
source ~/.bashrc
hash -r
```

Then rerun:

```bash
cd contracts
anchor test
```

If that still looks noisy, use:

```bash
cd contracts
npm run test:localnet
```

If you see `faucet port 9900 is already in use`, stop any leftover validator and retry:

```bash
pkill -f solana-test-validator || true
```

For a contracts-only guide, see [contracts/README.md](./contracts/README.md).

## Milestone Targets

- M1: project scaffolding complete
- M2: event + reservation flow works locally
- M3: check-in + settlement flow works locally
- M4: demo script and submission artifacts finalized
