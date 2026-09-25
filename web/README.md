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

Environment variables come from the single `.env` at the repo root (see `../.env.example`).

## Build

```bash
pnpm build
```

Design and implementation decisions for the frontend are recorded in `../docs/frontend.md`.
