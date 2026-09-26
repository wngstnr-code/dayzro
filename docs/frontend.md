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
- No offchain backend. The app talks to Arc with wagmi v3 + viem (built-in `arc` chain). Reads in the browser go through `/api/rpc` (`src/app/api/rpc/route.ts`), a stateless read-only relay with failover across Arc's four public endpoints, because Brave Shields and some blockers drop requests to `rpc.*.arc.io`. The local fork is read directly. Wallets send transactions through their own nodes. Reown AppKit is used when `NEXT_PUBLIC_REOWN_PROJECT_ID` is set; otherwise it falls back to injected wallets.
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

## 4e. Landing section 4 (Who it's for)

- Keeps the reference's dark "journey" design (winding path of lines drawn on scroll, skewed glass cards that open as the path reaches them), but the content is not a roadmap: it is the three sides of the product.
- Label "WHO IT'S FOR", title "Built for everyone in the trade", and three cards of three points each: Suppliers (sunrise, at the start of the path), Buyers (magenta, on the path, centered exactly halfway between the other two), Financiers (gold, at the end).
- All three cards are the same size: 20em wide with a shared minimum list height (`uniform` on `JourneyItem`), so copy length never changes the box.
- The Suppliers card is flatter than the reference slot (-13deg instead of -18deg) and shifted left so it clears the title.

## 4f. Footer

- Reference layout (small centered line, brand block on the left, link columns, copyright row) with Dayzro content, plus a giant "Dayzro" wordmark in the sunrise to magenta gradient closing the page, cut at its baseline by the card edge.
- Four link columns, all real destinations: Product (Launch App and anchors to How it works, Who it's for, Trust), Developers (repo, contracts, design doc, tests), Network (Arc Explorer, USDC and EURC token pages), Hackathon (Arc Microgrants).
- A dark CTA card above the links was tried and dropped.

## 4f2. Landing: Trust

- Keeps the reference layout with the Dayzro copy ("No custody, no backend, only contracts"). Reviewed and approved as is.

## 4g. App shell (/app)

- Keeps the reference bridge chrome (header, side drawer, glass cards, stepper, pointer glow). Pages are built one at a time, in the user's order.
- Side navigation: New invoice (`/app`), Invoices (`/app/invoices`), Finance (`/app/finance`), Buyer profile (`/app/b`, detail at `/app/b/[address]`), then external Explorer (explorer.arc.io) and Guide (repo README). A section stays active on its detail routes.
- Header tabs (where the bridge had Token / NFT) are the two sides that start a flow: Supplier (`/app`) and Financier (`/app/finance`). They are links, active by route.
- Wallet: "Connect wallet" has the same size as the header tabs and no icon. Without a Reown project id it opens a picker of every EIP-6963 wallet (OKX, Rabby, MetaMask, ...), so the clicked wallet connects, not whichever one owns `window.ethereum`. The connected pill shows Arc's mark (`public/chains/arc.svg`, from arc.io) and opens a small menu: Copy address, Disconnect, and a single "Switch to Arc" row only when needed (wrong chain, or on the local fork a wallet still using Arc mainnet's RPC).
- Pages not built yet show only their title and one line of what they will do, no fake data.
- Development runs against a local arc-anvil fork of Arc mainnet with the contracts deployed to it. Mainnet deploy comes after the app works.

## 4h. App: New invoice (/app)

- Replaces the bridge form, same stepper and card: Details, Review, Confirm.
- Details: buyer address, amount with a USDC / EURC selector (where the bridge had its token picker), due date (tomorrow to 364 days, stored as 23:59:59 local time of that day), invoice or PO number (required, stored as `keccak256` in `ref`), and an optional document. The document is hashed in the browser (`docHash`) and never uploaded.
- Validation mirrors `DayzroRegistry._create` (valid buyer that is not you, at least 1 token, due date in range). Errors show only after the first Continue.
- Confirm: one `createInvoice` transaction. Before sending, the app simulates it and checks that the wallet's own node has the registry deployed, so a wallet on the wrong RPC gets a clear message instead of a dead transaction. Contract reverts are translated into sentences (`readableError` in `src/dapp/lib/contracts.ts`).
- Success: the card title becomes "Invoice #id created" with the share link `/app/r/[id]` for the buyer, Open invoice and Create another.
- Fields have no border and a filled surface (`--neutral-background`). On the light theme that surface is warm sand #F7ECE4, not white: white fields on the light card looked washed out.
- Contract ABIs live in `src/dapp/abi/` (generated from `contracts/out`). Addresses come from `NEXT_PUBLIC_REGISTRY_ADDRESS` / `NEXT_PUBLIC_FACILITY_ADDRESS`.

## 4i. App: Invoice page (/app/r/[id])

- The link a supplier shares. Same stepper and card: Issued, Accepted, Paid on top; status badge, the amount, and the terms (supplier, buyer, holder once sold, due date with days left or late, guarantee, invoice number, document).
- Invoice number and document are only stored as hashes. The share link carries `?ref=<invoice number>` and the page shows it with a check only when its keccak256 matches `ref`; "Check a file" hashes a file in the browser and compares it to `docHash`.
- The card text and the actions follow the viewer's role, read live from the chain (refreshes every 15s and after every transaction):
  - Buyer, pending: Accept (with "Back it with my guarantee" when their free guarantee covers it) or Reject.
  - Supplier, pending: Cancel.
  - Holder, accepted and not overdue: the best offer across all facilities (`quote`), shown as what they receive now, the discount at the facility's APR and the protocol fee; Sell approves the NFT for the Facility if needed, then `sell` with the quoted price as `minPrice`.
  - Buyer, accepted or defaulted: Pay now, prefilled with what is left, approve then `pay`.
  - Anyone: Settle from the buyer's guarantee (guaranteed, past due) or Mark as defaulted (unsecured, 30 days past due). Claim appears when the viewer has a claimable balance.
- Multi-step actions run through `useSendTx` (`src/dapp/lib/tx.ts`): each call is simulated first, the button area shows "Approve USDC (1 of 2): confirm in wallet", and all reads refresh when it lands.

## 4j. App: Invoices (/app/invoices)

- One wide card (760px, the bridge's transactions list width) listing every receivable the connected account touches, newest first: ids it issued (`idsBySupplier`), ids it owes (`idsByBuyer`) and NFTs it holds (`tokenOfOwnerByIndex`, which covers bought ones). No indexer.
- Filter chips with counts: All, Issued, To pay, Bought. Each row: id, counterparty ("To" or "From"), due date with days left or late, amount, status badge; the row opens `/app/r/[id]`.
- Empty state offers New invoice. Status labels and colors are shared with the invoice page (`src/dapp/lib/receivable.ts`).

## 4k. App: Finance (/app/finance)

- For financiers. One wide card: three stats (ready to buy invoices = liquidity across their facilities, owed to them = remaining on receivables they hold, open invoices bought), then their facilities.
- No facility yet: the "Open a facility" form is the page. Yearly rate (0.01% to 50%), longest time to due date (1 to 365 days), deposit with the USDC / EURC picker, and "buy guaranteed invoices from any buyer". A live line shows what the rate means: "a 1,000 USDC invoice due in 60 days is bought for 983.83 USDC", using the same formula as `DayzroFacility.quote`. Approve (if needed) then `open`.
- Each facility is a row (rate, tenor, available, Buying or Paused) that expands into tabs: Add funds, Withdraw, Terms (rate, tenor, guaranteed toggle, pause) and Buyer limits. Buyer caps are a mapping with no list, so the tab looks up one buyer address, shows its current limit and what that buyer owes the financier now, and sets a new limit.

## 4l. App: Buyer profile (/app/b, /app/b/[address])

- A buyer's payment record, readable by anyone before they finance or sell to them. `/app/b` shows the connected wallet's own profile (or only the lookup when disconnected); `/app/b/[address]` any address. Buyer and supplier addresses on the invoice page link here.
- Lookup field on top, then the address with badges: You, and the domain check. Domain verification needs no server: the buyer publishes TXT `_dayzro.<domain>` = `dayzro=<address>` and the browser reads it over DNS-over-HTTPS (Cloudflare).
- Payment record per token (USDC / EURC chips) from `buyerStats`: accepted, paid on time (rate and count), paid late (with average days late), defaults, accepted and paid volume, owed now; plus the guarantee set aside and how much of it is locked. Then the latest 8 invoices owed, linking to each.
- On your own profile: edit the public profile (company name, website domain, with the exact TXT record to add) and deposit or withdraw your guarantee (only the unlocked part can leave).
- Shared form pieces (field, stat tile, toggle, transaction status) live in `src/dapp/components/Form.tsx`.

## 5. Rules

- No em dashes anywhere (code, comments, docs, commits).
- No mock data and no mock features. Every number in the app comes from the chain.
- Redesign the landing one section at a time, and only in the order the user picks.
- Typography stays consistent across sections. Every landing description (paragraph under a section title) uses the `dzDescription` mixin in `web/src/app/scss/mixins.scss`: Public Sans 400, 18px / 1.45, muted grey #6E5A52, 16px below 768px. New or redesigned sections use it too.

## 6. Still to do

- Contracts are live on Arc mainnet (addresses in the root README) and set in `.env`. A full cycle was run on mainnet through the app UI on 2026-09-26: facility #1 opened, invoice #1 (E2E-MAINNET-001, 1 USDC) created, accepted, sold to the facility and paid in full to the holder.
- Optional: Reown project id.
