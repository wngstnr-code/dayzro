# Dayzro Frontend Decisions

Living record of frontend decisions. Update this file whenever a decision changes.

## 1. Direction

- Generic shadcn dashboards were rejected. References the user liked: CoW (cow.fi), Ondo, Kolo, and an L2 marketing site with a matching bridge app.
- Final reference: that L2 site. We start from its open source landing and bridge app, keep only what Dayzro needs, then rebrand section by section.
  - Landing base: an open source Next.js 15 marketing site (SCSS modules, GSAP, Lottie).
  - App base: the matching open source bridge UI (Svelte), ported to React so it matches the original pixel for pixel.
- License is not a concern for the user, but **none of the reference brand's name, marks or copy may ship**. Everything from it is replaced before the Vercel deploy, and the name never appears in the repo.

## 2. Structure

- Only two surfaces: the landing at `/` and the app at `/app`.
- Next.js 15 App Router with two root layouts via route groups, so styles never leak between them:
  - `src/app/(landing)`: SCSS modules, GSAP, Lottie, AOS.
  - `src/app/(app)`: Tailwind 3.4.3 + daisyUI 4.10.5 (pinned to match the reference), styles in `src/dapp/styles`, components in `src/dapp/components`.
- Link from landing to app is a plain `<a href="/app">` (full page load, because the root layouts differ).
- No offchain backend. The app talks to Arc directly with wagmi v3 + viem (built-in `arc` chain). Reown AppKit is used when `NEXT_PUBLIC_REOWN_PROJECT_ID` is set; otherwise it falls back to injected wallets.
- One `.env` at the repo root for everything.
- Hosting: Vercel.

## 3. Brand

### Logo

- Concept "Horizon Zero" with the "Sunrise D" sun: a rounded "0" ring, a horizon line, and a half sun with three rays and a soft glow.
- Single source: `web/src/brand/dayzro-mark.tsx` (`DayzroMark`). Used by the landing navbar, the app header and the favicon (`src/app/icon.svg`).
- Wordmark: "Dayzro" in Clash Display / Clash Grotesk, weight 600, tight tracking.

### Palette: Ink Sunrise

Sunrise and magenta, with pink kept as an accent only so we do not look like the reference site. Every pair used passes WCAG AA.

| Token | Hex | Use |
| --- | --- | --- |
| ink | #1A1014 | text, landing buttons, light app primary |
| ember | #C2410C | accents, dark app primary |
| sunrise | #FF8A3D | highlights, focus, glow |
| sunriseDark | #FF7A3D | dark app brand accent |
| magenta | #D1127A | gradient end, sparing accent |
| magentaDeep | #B0126A | gradient end on buttons |
| ivory | #FFFAF6 | landing and light app background |
| peach | #FFEBDD | soft surfaces |
| muted | #6E5A52 | secondary text |
| night | #140C0A | dark app background |
| nightCard | #221713 | dark app cards |

Where the tokens live:

- `web/src/brand/tokens.ts` (TypeScript source of truth)
- `web/src/app/scss/vars.scss` (landing)
- `web/tailwind.config.ts` (app, daisyUI dark and light themes)

Dark app primary buttons use `linear-gradient(90deg, #C2410C, #B0126A)` with an orange glow.

### Reference color replacement

All reference colors were swapped for Dayzro colors (code, SVG, raster images, video):

- Reference pink #E81899 -> ember #C2410C, darker pink #C8047D -> magentaDeep #B0126A, bright pinks -> sunrise #FF8A3D family, pink tints -> peach tints (#FFD3B5).
- Reference purple #6438D6 -> magenta #D1127A, so old pink to purple gradients read as ember to magenta.
- Reference navy #0B101B and cool greys -> ink #1A1014 and warm greys.
- Tailwind `pink-*` scale remapped to a sunrise scale.
- Raster art (`public/img/home-new/*.webp|png`) and `governance.mp4` were hue-remapped with a continuous curve: purple 256deg -> 328deg, pink 323deg -> 22deg, blues, greens and yellows untouched.
- Shapes that were reference branding (its 3D logo and logo grid) were removed or replaced by the Dayzro mark.

## 4. Landing navbar

- Left: logo mark + "Dayzro". Right: a single "Launch App" button. Nothing else.
- The button has no arrow icon. It keeps the arrow's hover animation instead: the label rolls out to the right and a copy rolls in from the left (`hoverRoll` prop on `Button`).
- Pill shape, white background, centered, `max-width: 460px`, height 72px.
- On scroll (scrollY > 8) the pill turns translucent white with a 16px backdrop blur, a faint ink border and a soft shadow.
- Always visible (hide on scroll was tried and dropped).

## 4b. Landing hero

- Same layout and motion as the reference (pedestal, grid, scan sweep, scroll hand-off to the scaling section). Only the logo changes, and the scan sweeps top to bottom instead of left to right.
- One logo size across hero and section 2: the 3D ring renders at 78.65% of the hero frame height, and the outline icon box in section 2 is `frame width * 0.3694` so its ring matches; the USDC coin diameter equals the mark height. The scroll hand-off aligns centers, not tops.
- The reference 3D logo render is replaced by a live WebGL Dayzro mark: `web/src/widgets/home-screens/components/DayzroLogo3D`.
  - Three.js (loaded with a dynamic import, so it stays out of the initial bundle).
  - Built from the same 48x48 geometry as `DayzroMark`: extruded ring + horizon, and a separately lit sun + rays, sunrise to magenta gradient in vertex colors, clearcoat material, soft additive sun glow.
  - Near front view (slight tilt so the depth reads, like the reference render), centered in the bracket frame, about 75% of its height. Floats: slow vertical bob with a tiny sway, no pointer tracking. Pauses off screen, stays still with `prefers-reduced-motion`, falls back to the flat SVG mark without WebGL.

## 4c. Landing section 2 (horizontal scroll)

- Same structure and motion as the reference: pinned horizontal scroll over four screens, the rays and lines art, the dot canvas, and the hand-off of the hero logo into screen 1.
- Screen 1: the outline icon swap is now the Dayzro mark (`DayzroOutline`) spinning into a USDC coin (`UsdcOutline`) and back: an invoice becomes cash. Label "INVOICE FINANCING ON ARC", title "Invoices become cash".
- Screens 2 to 4 are the product flow, each with a one-line explanation (added on top of the reference layout). The reference's per-screen buttons were removed:
  1. Accept: the buyer accepts the invoice onchain and it becomes a receivable.
  2. Sell: sell the receivable to a financing facility for USDC the same day.
  3. Settle: the buyer pays the contract at the due date and the holder is paid.
- The copy never touches the rays. On desktop (>= 991px) each block is absolutely placed in a measured gap of the ray paths, in vw from the screen's vertical center (the rays scale in vw and are centered, so the gaps move with them): Accept lower left, Sell centered inside the ray loop (narrow, centered text), Settle right of where the rays end. Clearance was measured from the real path geometry at 1280x720 to 1920x1080: at least 13px for Sell and 78px for the others. Below 991px the original flow layout is used.

## 4d. Landing section 3 (About)

- The reference's "explore" section (between the scaling screens and About) was removed: with Dayzro content it only repeated the hero (3D mark and the name again). The flow is now hero, the three steps, About.
- About keeps the reference layout and motion (line grid drawn on enter, title revealed letter by letter on scroll). Copy: label "ABOUT DAYZRO", title "We envision a world where no business waits 90 days to get paid", and a short paragraph on the problem (suppliers wait 30 to 120 days on delivered invoices) and the answer (a buyer's approval becomes a receivable anyone can finance onchain).

## 5. Rules

- No em dashes anywhere (code, comments, docs, commits).
- No mock data and no mock features. Every number in the app comes from the chain.
- Redesign the landing one section at a time, and only in the order the user picks.
- Typography stays consistent across sections. Every landing description (paragraph under a section title) uses the `dzDescription` mixin in `web/src/app/scss/mixins.scss`: Public Sans 400, 18px / 1.45, muted grey #6E5A52, 16px below 768px. New or redesigned sections use it too.

## 6. Still to do

- Landing: Roadmap (journey), Trust (governance) and the footer have first Dayzro copy but still use the reference layout. Redesign them section by section.
- App: replace the bridge replica with the Dayzro flows (create invoice, receivable detail, finance, buyer profile, invoices list).
- Add an Arc chain icon (the connect button still uses the Ethereum icon).
- Optional: Reown project id.
