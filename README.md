# NoFlake

NoFlake is a Solana-native anti-no-show RSVP layer for free events.
Attendees lock a refundable USDC deposit to reserve a seat, check in on-site, and get refunded automatically when they show up.

This repository currently ships a demo-ready MVP with:

- organizer event creation
- attendee reservation with browser-wallet-first connect plus demo fallback
- organizer host wallet selection from the same shared wallet provider
- organizer check-in, undo, cancellation, and staged settlement flow
- shared domain schemas across frontend and backend
- an Anchor contract package for event lifecycle, waitlist, cancellation, settlement state, strict-mode deposit vault transfers, party-mode bonus distribution, and sponsor-mode bonus funding

## Product Scope

MVP focus:

- event creation
- deposit-based seat reservation
- waitlist handling
- reservation cancellation with earliest-waitlist promotion
- organizer check-in and undo
- organizer event cancellation
- sponsor-mode single-sponsor post-creation funding and attendee bonus flow
- end-of-event staged settlement, prepare, and claim orchestration
- a minimal commercialization story with `9 USDC / event` positioning

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

1. `frontend` collects user actions for the demo app.
2. `backend` currently orchestrates the demo reservation, check-in, and staged settlement lifecycle.
3. `contracts` implements the real onchain deposit, refund, forfeiture, and bonus semantics verified in local Anchor tests.
4. `shared` keeps request/response and domain models consistent across the frontend and backend.

## Current Demo Flow

1. Open `/organizer` and create an event with the connected host wallet or the demo-host fallback.
2. Open `/events/evt_1` and connect a browser wallet when available, or explicitly switch into the demo fallback from the same page.
3. Reserve a seat with the refundable USDC deposit flow and inspect the current payment path state.
4. Fill the last seat and explain that later attendees are waitlisted.
5. Open `/check-in/evt_1` and check in attendees.
6. Run settlement, then prepare party or sponsor distribution when the selected mode requires it.
7. Show refund, forfeiture, and bonus outcomes from the staged flow.

The demo boundary is intentional:

- the web app now prefers browser wallet addresses, but organizer and attendee flows can explicitly move between browser-wallet and demo fallback modes before submission
- organizer and attendee browser-wallet flows now prepare transactions, request signatures, echo transaction signatures, and then sync the result back into the backend projection layer
- reservation/payment execution still uses backend orchestration plus demo fallback semantics for final source-of-truth writes unless the browser-wallet flow has already produced transaction provenance
- the Anchor package already verifies the real onchain funding, refund, forfeiture, and bonus-claim lifecycle on localnet
- the remaining wallet/payment gap is direct frontend signature flow and devnet USDC execution, not basic wallet awareness

Current environment boundary:

- `Demo fallback`: local walkthrough mode for organizer and attendee flows without requiring a funded Solana wallet
- `Browser-wallet transaction preparation`: current frontend/browser-wallet path that signs intent messages, prepares transactions, captures signature provenance, and syncs to the backend
- `Real devnet execution`: next-step environment that requires a real RPC endpoint, the deployed program ID, IDL alignment, funded wallets, and a devnet deposit mint / token flow

For the exact devnet prerequisites, see [docs/devnet-wallet-payment-setup.md](./docs/devnet-wallet-payment-setup.md).

## Commercialization

Current MVP positioning keeps monetization simple:

- `9 USDC / event` as the baseline organizer fee
- sponsor campaigns as a later expansion path rather than a required core workflow
- no platform incentive tied to attendee no-show forfeitures

## Contract Status

The onchain package currently covers:

- event initialization with per-host multi-event support
- event-scoped deposit mint and vault ATA initialization
- reserved and waitlisted seat allocation
- real local SPL token deposit lock on reservation
- reservation cancellation
- earliest-waitlist promotion after a reserved seat is cancelled
- organizer check-in before settlement
- organizer undo-check-in before settlement
- host-side event cancellation state
- cutoff-gated settlement
- cutoff-gated reservation cancellation
- strict-mode onchain settlement:
  - checked-in attendees receive deposit refunds
  - reserved no-shows forfeit deposits to the host
- party-mode onchain settlement:
  - checked-in attendees receive deposit refunds first
  - reserved no-shows remain in the event vault as the party bonus pool
  - the host prepares a fixed per-attendee bonus after all reservations settle
  - checked-in attendees claim equal party bonuses from the vault
  - any division remainder is sent to the host
- sponsor-mode onchain settlement:
  - a single sponsor funds a separate sponsor vault after event creation
  - checked-in attendees still receive normal deposit refunds
  - no-show deposits still forfeit to the host rather than entering the sponsor pool
  - the host prepares sponsor distribution after all reservations settle
  - checked-in attendees claim equal sponsor bonuses from the sponsor vault
  - sponsor-vault remainder returns to the sponsor
  - cancelled sponsor events refund the sponsor vault back to the sponsor
- cancelled-event onchain refund flow for reserved, checked-in, and waitlisted reservations
- finalization only after all active reservations are settled

Current local testing uses a project mint rather than devnet USDC, but the event account model is already structured around an explicit `deposit_mint` for later USDC migration.

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

Playwright runs against isolated test servers on `3101/4101`, resets backend state between tests, and uses a single worker so demo event fixtures do not cross-contaminate.

Contracts scaffold:

```powershell
cd contracts
cargo check
```

Current machine status:

- backend tests pass locally
- frontend E2E tests pass locally
- contract `cargo check` passes locally
- WSL Ubuntu local contract tests pass with installed `anchor` and `solana` CLIs

Frontend wallet state today:

- browser wallet address is used when injected by the browser
- attendee and organizer flows both fall back to local demo identities when no browser wallet is available
- attendee and organizer flows can explicitly switch from browser-wallet mode into demo fallback and back again without reloading the page
- attendee UI shows whether the current path is browser-wallet-connected or demo-backend reservation
- organizer success, event detail, and check-in surfaces echo wallet provenance and host/payment path labels
- organizer and attendee browser-wallet flows now surface transaction preparation state and signature provenance before backend sync
- real devnet settlement still needs environment setup rather than more wallet UI work

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

`anchor test` works in this repo under WSL, but it may print a trailing `websocket error` after the test has already passed.

If the output includes:

```text
43 passing
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
