# Local Setup

## Prerequisites

- Node.js and npm
- Rust and Cargo
- Optional for full contract workflow:
  - Solana CLI
  - Anchor CLI

## Install Dependencies

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

## Run the Backend

```powershell
cd backend
npm run dev
```

The backend listens on `http://127.0.0.1:4000`.

## Run the Frontend

```powershell
cd frontend
npm run dev
```

The frontend listens on `http://127.0.0.1:3000`.

## Run Tests

Shared:

```powershell
cd shared
npm run test
```

Backend:

```powershell
cd backend
npm run test
```

Frontend end-to-end:

```powershell
cd frontend
npm run test:e2e
```

Contracts scaffold:

```powershell
cd contracts
cargo check
```

This confirms the Rust program builds, but it does not run the Anchor integration suite.

## Run Contract Tests

If `anchor` and `solana` are installed and available on `PATH`:

```powershell
cd contracts
anchor test
```

If those CLIs are not installed, the Anchor scaffold can still be validated with `cargo check`, but full program tests will be unavailable.

The current contract test suite covers:

- multiple events per host
- waitlist placement after sellout
- cancellation and waitlist promotion
- reservation cancellation blocked after cutoff
- undo check-in before settlement
- host event cancellation
- cutoff-gated settlement
- settlement-before-finalization rules
- no check-in once settlement has started or the event is finalized

## Current Machine Limitations

On this machine as of `2026-05-08`:

- `anchor` is not available on `PATH`
- `solana` is not available on `PATH`

That means the following commands cannot currently be executed here:

```powershell
cd contracts
anchor test
```

```powershell
cd contracts
npm run test:localnet
```

Use `cargo check` for static validation on this machine, and run the full Anchor suite on a machine where both CLIs are installed.
