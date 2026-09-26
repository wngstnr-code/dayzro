#!/usr/bin/env bash
# Local Arc mainnet fork for app development. Nothing here touches mainnet.
#
#   scripts/fork.sh start            run arc-anvil (fork of Arc mainnet) on :8545, state kept in .fork/
#   scripts/fork.sh deploy           deploy Registry + Facility to the fork, write web/.env.local
#   scripts/fork.sh fund <address> [usdc]   give an address native USDC on the fork (default 10000)
#   scripts/fork.sh reset            delete the saved fork state
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="http://127.0.0.1:8545"
STATE="$ROOT/.fork/state.json"
# Anvil's first dev key: public, only ever used on the local fork.
DEV_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

case "${1:-}" in
start)
    mkdir -p "$ROOT/.fork"
    exec arc-anvil --fork-url "${ARC_RPC_URL:-https://rpc.mainnet.arc.io}" --port 8545 --state "$STATE"
    ;;
deploy)
    cd "$ROOT/contracts"
    dev=$(arc-cast wallet address "$DEV_KEY")
    # Broadcast logs go to .fork/ so a fork deploy never looks like a mainnet one in contracts/broadcast.
    out=$(DEPLOYER_PRIVATE_KEY="$DEV_KEY" PROTOCOL_OWNER="$dev" PROTOCOL_TREASURY="$dev" \
        FOUNDRY_BROADCAST="$ROOT/.fork/broadcast" FOUNDRY_CACHE_PATH="$ROOT/.fork/cache" \
        arc-forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast 2>&1) || { echo "$out"; exit 1; }
    registry=$(echo "$out" | awk '/DayzroRegistry:/ {print $2; exit}')
    facility=$(echo "$out" | awk '/DayzroFacility:/ {print $2; exit}')
    [ -n "$registry" ] && [ -n "$facility" ] || { echo "$out"; exit 1; }
    cat > "$ROOT/web/.env.local" <<ENV
# Written by scripts/fork.sh deploy. Points the app at the local Arc fork.
NEXT_PUBLIC_RPC_URL=$RPC
NEXT_PUBLIC_REGISTRY_ADDRESS=$registry
NEXT_PUBLIC_FACILITY_ADDRESS=$facility
ENV
    echo "Registry: $registry"
    echo "Facility: $facility"
    echo "Wrote web/.env.local (restart pnpm dev to pick it up)"
    ;;
fund)
    addr="${2:?usage: fork.sh fund <address> [usdc]}"
    usdc="${3:-10000}"
    wei=$(arc-cast to-wei "$usdc" ether)
    arc-cast rpc anvil_setBalance "$addr" "$(arc-cast to-hex "$wei")" --rpc-url "$RPC" >/dev/null
    echo "$addr now has $usdc USDC on the fork"
    ;;
reset)
    rm -f "$STATE"
    echo "Fork state cleared"
    ;;
*)
    sed -n '2,8p' "$0"
    exit 1
    ;;
esac
