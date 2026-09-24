# Arc Microgrants: Catatan Hackathon

> Diriset 2026-09-24. Sumber: halaman DoraHacks (dibuka langsung), docs.arc.io, blog/pressroom arc.io, dan pengecekan langsung ke RPC mainnet Arc.

## 1. Ringkasan program

| Item | Detail |
|---|---|
| Nama | Arc Microgrants (by Circle) |
| Link | https://dorahacks.io/hackathon/arc-microgrants/detail |
| Bentuk | Microgrant bergulir (rolling), **bukan lomba ranking**. 20 grant × 500 USDC (pool 10.000 USDC) |
| Pembukaan | 2026-09-16 (bersamaan dengan peluncuran Arc mainnet) |
| Deadline | 14 Okt 2026 23:59 ET (= 15 Okt 2026 10:59 WIB) |
| Keputusan | Rolling, semua keputusan paling lambat 21 Okt 2026. **Submit lebih awal = dijawab lebih awal** (kuota bisa habis duluan) |
| Pendaftar | ±471 hacker terdaftar; **0 BUIDL** tersubmit per 2026-09-24 |
| Tag | Arc, USDC, Microgrants |
| Wajib | Link GitHub/GitLab/Bitbucket |

### Syarat submission
1. Deployment **live dan berfungsi di Arc mainnet**, dengan link yang bisa dibuka.
2. Repo publik.
3. Deskripsi singkat: apa yang dilakukan proyek dan **untuk apa memakai Arc**.
4. Profil builder publik (GitHub, X, atau Farcaster).

**Tidak eligible:** mockup desain, slide deck, build testnet-only, proyek tanpa komponen Arc, karya yang sudah didanai program Circle/Arc.

### Kriteria penilaian (resmi)
- **Relevansi ke Arc**
- **Kredibilitas teknis**
- **Kualitas yang dibangun**
- **Layak dikembangkan lebih jauh**: "Promise counts for more than traction here."

### Yang didapat
- 500 USDC di Arc (non-dilutif), bimbingan teknis, office hours ekosistem Arc, visibilitas di komunitas builder, intro, dan **jalur ke Circle Grant Program** (hadiah sesungguhnya: pendanaan menuju produksi).

### Alur
Build → deploy ke mainnet → submit (±10 menit) → screening kelengkapan & kecocokan → shortlist dinilai per batch → verifikasi (hanya penerima, privat) → dibayar USDC di Arc.

### Aturan lain
- Terbuka global (kecuali yurisdiksi tersanksi). Boleh pseudonim.
- 1 submission per proyek; tim boleh submit beberapa proyek berbeda.
- Proyek hackathon lain boleh (asal live di mainnet dan belum didanai Circle/Arc).
- Butuh wallet yang bisa menerima USDC di Arc.
- Kepemilikan penuh tetap di builder (tanpa equity/IP/eksklusivitas).

## 2. Arc: fakta teknis

Arc = L1 buatan Circle untuk "programmable money": pembayaran, FX, pasar modal, dan ekonomi agen AI. Mainnet live **16 Sep 2026**.

| Properti | Nilai |
|---|---|
| Chain ID mainnet | **5042** (testnet: 5042002) |
| RPC publik | `https://rpc.mainnet.arc.io` (juga Alchemy, QuickNode, Blockdaemon, dRPC) |
| Explorer | https://explorer.arc.io |
| Konsensus | Malachite BFT (Tendermint), validator permissioned (PoA); rencana PoS + token ARC 2027 |
| Eksekusi | Reth, EVM baseline **Osaka** (+ EIP-7702, sebagian Amsterdam: EIP-7708) |
| Gas | **USDC** (native), tidak ada token volatil. Target ±$0,001 per transfer ERC-20, fee dihaluskan EWMA, plafon 20.000 gwei |
| Finality | Deterministik, <1 detik, tanpa reorg. Block time ±0,5 s. 3.000+ TPS |
| Validator pendiri | BlackRock, DTCC, Galaxy, ICE, Mastercard, MoneyGram, SBI, Standard Chartered, Sumitomo, Visa, Worldpay |

### Alamat kontrak mainnet penting (dicek `eth_getCode` 2026-09-24)
| Kontrak | Alamat | Catatan |
|---|---|---|
| USDC (ERC-20 interface) | `0x3600000000000000000000000000000000000000` | 6 desimal; native = 18 desimal, **saldo sama** |
| EURC | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | 6 desimal |
| USYC | `0x8a5D989Bbb96929F689B0200f435f53dA42bF490` | Tokenized MMF, **perlu allowlist** (Teller/Entitlements) |
| cirBTC | `0x171A4217b86A807A64eB94757Db6849fb4bDbAA0` | 8 desimal |
| WETH (bridged) | `0x128cC466B61f542da60c70e3aA11c10e19B84EDB` | |
| CCTP TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | domain 26 |
| Gateway Wallet / Minter | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` / `0x2222222d7164433c4C09B0b0D809a9b52C04C205` | Unified balance, nanopayments |
| StableFX FxEscrow | `0xe2E5F173576B513d994073CCbDaCBE027d43DFe6` | RFQ FX; butuh Permit2 |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | Tempel metadata/memo ke call (mis. nomor invoice) |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` | Batch call dengan `msg.sender` asli (precompile CallFrom) |
| Multicall3 / Permit2 / CREATE2 | standar | |
| ERC-8004 Identity / Reputation (kanonik) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` / `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Ada kode di mainnet. **Alamat di tutorial docs (`0x8004A818…`) hanya testnet** |
| ERC-8183 AgenticCommerce (docs) | `0x0747EEf0…` | **Tidak ada di mainnet** (testnet only) |
| Pyth (price feeds) | `0x2880aB155794e7179c9eE2e38200202908C17B43` | Ada kode di mainnet; 39 feed FX termasuk USD/IDR, USD/PHP, USD/INR, USD/VND |
| Stork | `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62` | Ada kode di mainnet |

### Perbedaan EVM yang wajib diingat
- **`PREVRANDAO` selalu 0 → tidak ada randomness onchain.** Pyth Entropy tidak terdaftar untuk Arc. Hindari desain yang butuh undian acak, atau pakai commit-reveal.
- USDC dua interface: native 18 desimal (`msg.value`, `address.balance`) vs ERC-20 6 desimal. Jangan campur di perhitungan (beda 10¹²).
- Transfer nilai ke `address(0)` revert; blocklist USDC ditegakkan runtime (revert tetap bayar gas).
- Kirim native value ke kontrak bisa revert walau saldo cukup.
- Tidak ada blob tx (type-3). EIP-7702 didukung.
- Simulasi lokal pakai `arc-anvil` dari [circlefin/arc-foundry](https://github.com/circlefin/arc-foundry), bukan anvil biasa.
- Setiap pergerakan USDC memancarkan log `Transfer` dari system emitter `0xffff…fFfE` (EIP-7708), mudah diindeks.

### Modul yang BELUM tersedia
- Arc Privacy Sector (APS, transaksi rahasia), Stablecoin Services (paymaster native, gas multi-stablecoin): masih roadmap. Jangan dijadikan fitur inti.

### Tooling
- App Kit (`@circle-fin/app-kit`): Bridge, Swap, Send, Unified Balance, Onramp, Earn (vault yield).
- Account abstraction ERC-4337: Alchemy, Pimlico, ZeroDev, Biconomy, Privy, Dynamic, Thirdweb, Circle Modular Wallets.
- Indexer: The Graph (Arc mainnet didukung), Goldsky, Envio, Alchemy, Pinax.
- Oracle: Chainlink, Chronicle, Pyth, RedStone, Stork. UMA dipakai di sample prediction market.
- Arc MCP server untuk dokumentasi; Circle skills (`circlefin/skills`, skill `use-arc`).

## 3. Ekosistem saat mainnet
- 100+ app & builder institusional hari pertama; 1.200+ proyek dibangun di testnet; 700 jt+ tx testnet.
- DeFi: **Aave V4**, **Morpho**, **Uniswap**, 1inch, LI.FI, Pump.fun, edgeX; proyek awal aka.fun, UnitFlow, Synthra, Tower, Hibachi, Sidoor.
- Pembayaran: Rain, Thunes, Wirex, Circle Payments Network, StableFX (24+ stablecoin lokal).
- Produk Circle baru: Arc Studio (coding agent onchain), App Kits, Arc Portal (danai wallet agen), Agent Wallets (limit belanja), Nanopayments via Gateway, AgentVM.
- Roadmap: Network Sectors (Privacy, Payment 100k TPS, Agent), PoS 2027, post-quantum.

## 4. Pelajaran dari hackathon Arc sebelumnya
**HackMoney 2026 (155 tim):** pemenang arctan(x) (FX DEX multichain), Text-to-Chain (DeFi via SMS), ArcFlow (treasury payroll yang diparkir di yield), Versus (agen kreator + token revenue).
**ETHGlobal Cannes 2026 (69 tim):** Onda (micropayment musisi), PayMate, NanoCrawl, ETHastic (mesh payment via radio), VEIL VPN, Predict It!, PolyPOP.

Pola yang disukai juri Arc:
1. **Masalah mainstream yang familiar** (escrow konstruksi, pembayaran freelancer, BNPL) dengan stablecoin sebagai settlement, bukan primitif finansial baru yang abstrak.
2. **Kompleksitas blockchain disembunyikan** (gas tak terasa, onboarding mudah).
3. Crosschain dianggap default.
4. Nanopayment & transaksi yang sebelumnya tidak ekonomis.
5. 97–98% submission memakai AI agent → **kategori agen sudah sangat ramai**; proyek non-agen yang tajam justru bisa menonjol.

## 5. Implikasi untuk strategi kita
- Ini **seleksi**, bukan ranking: target = masuk 20 penerima + tembus ke Circle Grant Program. Proyek harus "Arc-native" (jelas kenapa harus Arc: USDC-gas, finality instan, EURC/FX, Memo, CCTP/Gateway) dan terlihat **layak jadi bisnis**.
- Submit lebih awal lebih baik (belum ada submission sama sekali).
- **Tanpa backend offchain** realistis di Arc karena: user cukup pegang USDC (gas juga USDC, tak perlu paymaster), data dibaca langsung dari RPC/event log atau subgraph The Graph, harga dari oracle Pyth (update harga diambil frontend dari Hermes), frontend statis (IPFS / hosting statis).
- Konsekuensi tanpa backend: tidak ada notifikasi email/push, tidak ada keeper otomatis → desain kontrak harus "siapa pun boleh memicu" (permissionless trigger dengan insentif kecil), dan tidak boleh bergantung randomness.
- Semua aset harus nyata di mainnet (USDC/EURC asli, integrasi Aave/Morpho/Uniswap asli), tidak ada data dummy.
