# Dayzro Web

Frontend for Dayzro: the landing page at `/` and the app at `/app`. No backend; the app reads and writes Arc directly from the browser.

## Stack

- Next.js 15 (App Router), React 19, TypeScript, pnpm
- Landing (`src/app/(landing)`): SCSS modules, GSAP, Three.js for the 3D mark
- App (`src/app/(app)`): Tailwind 3 + daisyUI 4, wagmi + viem, Reown AppKit with an injected wallet fallback

The two surfaces use separate root layouts, so their styles never mix.

## Develop

```bash
pnpm install
pnpm dev
```

Environment variables come from the single `.env` at the repo root (see `../.env.example`); `web/.env` is a symlink to it.

### Local Arc fork

Until the contracts are on mainnet, develop against a local fork of Arc mainnet (real USDC and EURC, nothing leaves your machine):

```bash
../scripts/fork.sh start                 # arc-anvil on 127.0.0.1:8545, chain id 5042
../scripts/fork.sh deploy                # deploys Registry + Facility, writes web/.env.local
../scripts/fork.sh fund 0xYourWallet 5000
pnpm dev                                 # restart after deploy so .env.local is read
```

In your wallet, add a network with RPC `http://127.0.0.1:8545` and chain id 5042, and use it while testing.

## Build

```bash
pnpm build
```

Design and implementation decisions for the frontend are recorded in `../docs/frontend.md`.
