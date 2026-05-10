# Devnet Wallet Payment Setup

This guide defines the minimum environment needed to move NoFlake from local demo fallback into real devnet wallet payment testing.

## Current Boundary

- `Demo fallback`: local organizer and attendee walkthrough with mocked identities and backend-driven state.
- `Browser-wallet transaction preparation`: current frontend path that can connect a browser wallet, sign intent messages, prepare transactions, and sync signature provenance to the backend.
- `Real devnet payment execution`: requires a real Solana environment and funded wallets before organizer create-event or attendee reserve-seat can become true onchain writes.

## Required Config

### RPC URL

- Frontend fallback RPC: `https://api.devnet.solana.com`
- Recommended env var: `NEXT_PUBLIC_SOLANA_RPC_URL`
- Use a dedicated provider URL when testing with multiple wallets or repeated transactions to avoid public devnet rate limits.

### Program ID

- Current known program ID from local artifacts: `F5umdtne4aMhcmPpeV8G8ap1EhMe79mqUJET8EVJUmcA`
- Source of truth for the current local build:
  - `contracts/Anchor.toml`
  - `contracts/target/idl/noflake.json`
- Recommended frontend env var for future wiring: `NEXT_PUBLIC_NOFLAKE_PROGRAM_ID`

### IDL Source

- Canonical local IDL path: `contracts/target/idl/noflake.json`
- Canonical behavior reference: `contracts/tests/noflake.ts`
- Before devnet testing, regenerate the IDL from the exact deployed program build and verify the frontend/client uses the matching version.

### Deposit Mint

- Local tests currently use a project mint created inside the Anchor test flow.
- Devnet testing needs a real devnet SPL token mint strategy before deposits can be treated as live payments.
- Recommended short-term path:
  - use a dedicated devnet test mint that mirrors the deposit token interface
  - do not assume a production-grade devnet USDC path is already configured in this repo
- If the team later standardizes on a devnet USDC substitute or supported stable mint, document its mint address here and in frontend env config.

## Wallet Prerequisites

### Browser Wallet

- Wallet must support:
  - `signMessage`
  - `signTransaction` or `signAllTransactions`
- Wallet must hold enough devnet SOL for transaction fees.

### Operator / CLI Wallet

- Solana CLI wallet path used by local Anchor tooling:
  - `~/.config/solana/id.json`
- Required tools for contract-side validation:
  - `solana`
  - `anchor`
- For WSL/localnet work, keep CLI wallet funding and browser-wallet funding separate so it is obvious which actor signs each transaction.

## Recommended Devnet Bring-Up Order

1. Confirm the target program build and deploy the matching program to devnet.
2. Regenerate `contracts/target/idl/noflake.json` from that exact deployed build.
3. Set frontend env values for RPC URL and program ID.
4. Choose and fund the devnet deposit mint flow.
5. Fund organizer and attendee wallets with devnet SOL.
6. Run organizer create-event through the browser-wallet path.
7. Run attendee reserve-seat through the browser-wallet path.
8. Verify backend projection records the same transaction signatures returned by the browser-wallet flow.

## What Is Still Not Automatic

- This repo does not yet include a full frontend devnet transaction client that submits the actual Anchor instructions for create-event and reserve-seat end-to-end against devnet.
- The backend still acts as a projection/indexing surface for demo and partial browser-wallet flows.
- Token mint selection, ATA setup, and full devnet settlement orchestration still need follow-up implementation after environment setup.
