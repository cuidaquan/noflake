# Contracts

This package contains the Anchor-based Solana program for NoFlake.

## Current Scope

Included today:

- event account model
- reservation account model
- `initialize_event`
- `reserve_seat`
- `cancel_reservation`
- `check_in`
- `undo_check_in`
- `cancel_event`
- `settle_reservation`
- `finalize_event`
- waitlist handling when an event is full
- earliest-waitlist promotion after a cancellation
- active reservation tracking for safe settlement and finalization
- cutoff-gated reservation cancellation
- host-side event cancellation state
- strict / party / sponsor settlement mode state
- event and reservation status guardrails

Planned follow-up:

- deposit vault handling
- settlement distribution
- token transfer integration

## Toolchain

This contract package is aligned to the following local toolchain:

- `anchor-cli 0.32.1`
- `solana-cli 3.0.15`
- `@coral-xyz/anchor 0.32.1`

The local SBF build must use `platform-tools v1.53`.
This repo includes a local `cargo-build-sbf` wrapper setup and an npm script so the package can be built and tested reliably on this machine.

## Prerequisites

Required on the local machine:

- Rust
- Node.js 20+
- npm
- Solana CLI
- Anchor CLI

Recommended sanity check:

```bash
rustc --version
cargo --version
node --version
npm --version
solana --version
anchor --version
```

## Install

From the repository root:

```bash
cd contracts
npm install
```

## Local Wallet

Anchor uses the wallet configured in `Anchor.toml`:

- wallet path: `~/.config/solana/id.json`

If the wallet does not exist yet:

```bash
mkdir -p ~/.config/solana
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
```

Optional verification:

```bash
solana address -k ~/.config/solana/id.json
```

## Program ID

The local program id is already wired into the project:

- program id: `F5umdtne4aMhcmPpeV8G8ap1EhMe79mqUJET8EVJUmcA`

The matching local program keypair lives at:

- `contracts/target/deploy/noflake-keypair.json`

## Common Commands

Build the SBF artifact:

```bash
cd contracts
npm run build:sbf
```

Run the full local contract test flow with a local validator:

```bash
cd contracts
npm run test:localnet
```

Run Anchor's built-in test command:

```bash
cd contracts
anchor test
```

## Recommended Test Flow

Use this as the default local contract verification command:

```bash
cd contracts
npm run test:localnet
```

What it does:

- builds the SBF program with `platform-tools v1.53`
- builds the Anchor IDL and TypeScript types
- starts a fresh local validator
- loads the program into the validator
- runs the real TypeScript integration test against localnet

## About `anchor test`

`anchor test` is the intended full integration check for this repo, but it only works on machines where both `anchor` and `solana` CLIs are installed and exposed on `PATH`.

On machines with that toolchain, the run may still print a trailing `websocket error` after the test has already passed.

If you see:

```text
14 passing
```

the test run is successful.

That trailing message appears to come from Anchor's local validator/WebSocket teardown path, not from the contract logic.

If you want the cleanest output, prefer:

```bash
npm run test:localnet
```

## Files That Matter

- `Anchor.toml` - Anchor provider, program id, and test script
- `package.json` - local contract build and test commands
- `programs/noflake/src/lib.rs` - onchain program entrypoints and accounts
- `tests/noflake.ts` - local integration test
- `scripts/test-local.sh` - clean localnet test runner

## Troubleshooting

### `edition2024 is required`

If you see an error mentioning crates like `indexmap`, `toml_datetime`, or `toml_parser` together with:

```text
feature `edition2024` is required
```

then the build is using an older Solana SBF platform-tools toolchain.

First try opening a fresh shell and reloading your profile:

```bash
source ~/.bashrc
hash -r
```

Then rerun:

```bash
cd contracts
anchor test
```

If you want the most reliable path, use:

```bash
cd contracts
npm run test:localnet
```

### `wallet not found`

Create the configured wallet:

```bash
mkdir -p ~/.config/solana
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
```

### `faucet port 9900 is already in use`

A previous validator process is still running. Stop it and retry:

```bash
pkill -f solana-test-validator || true
```

### `program ... does not exist`

This usually means a local validator was started without loading the program, or the test was run against the wrong RPC URL.

The simplest reset path is:

```bash
cd contracts
npm run test:localnet
```

## Expected Successful Output

The happy-path test result looks like:

```text
noflake
  ✔ creates an event account
  ✔ allows the same host to create multiple events
  ✔ waitlists attendees after capacity is reached
  ✔ promotes the earliest waitlisted attendee after a cancellation
  ✔ does not count cancelled reservations toward finalization readiness
  ✔ rejects cancelling a reservation after settlement has started
  ✔ does not allow cancelling a reservation after the cutoff time
  ✔ allows a host to undo a check-in before settlement starts
  ✔ allows a host to cancel an event before settlement and marks the event cancelled
  ✔ settles checked-in and no-show reservations in strict mode
  ✔ marks no-shows without forfeiture in party mode
  ✔ rejects settling a waitlisted reservation
  ✔ requires settling before finalizing an event
  ✔ does not finalize before all reserved attendees are settled
  ✔ does not allow settlement before cutoff time
  ✔ does not allow check-in after settlement has started
  ✔ prevents check-in after an event has been finalized

17 passing
```
