#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEDGER_DIR="${LEDGER_DIR:-/tmp/noflake-ledger}"
RPC_URL="${ANCHOR_PROVIDER_URL:-http://127.0.0.1:8899}"
WALLET_PATH="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
PROGRAM_ID="F5umdtne4aMhcmPpeV8G8ap1EhMe79mqUJET8EVJUmcA"
PROGRAM_SO="$ROOT_DIR/target/deploy/noflake.so"

cleanup() {
  if [[ -n "${VALIDATOR_PID:-}" ]]; then
    kill "$VALIDATOR_PID" >/dev/null 2>&1 || true
    wait "$VALIDATOR_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

cd "$ROOT_DIR"

cargo-build-sbf --tools-version v1.53 --manifest-path programs/noflake/Cargo.toml
anchor idl build -p noflake -o target/idl/noflake.json -t target/types/noflake.ts

rm -rf "$LEDGER_DIR"
solana-test-validator \
  --reset \
  --ledger "$LEDGER_DIR" \
  --mint "$(solana address -k "$WALLET_PATH")" \
  --bpf-program "$PROGRAM_ID" "$PROGRAM_SO" \
  >/tmp/noflake-validator.log 2>&1 &
VALIDATOR_PID=$!

for _ in $(seq 1 60); do
  if solana block-height -u "$RPC_URL" >/dev/null 2>&1; then
    VALIDATOR_READY=1
    break
  fi
  sleep 1
done

if [[ "${VALIDATOR_READY:-0}" != "1" ]]; then
  echo "solana-test-validator did not become ready at $RPC_URL" >&2
  if [[ -f /tmp/noflake-validator.log ]]; then
    cat /tmp/noflake-validator.log >&2
  fi
  exit 1
fi

ANCHOR_PROVIDER_URL="$RPC_URL" \
ANCHOR_WALLET="$WALLET_PATH" \
  npx ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
