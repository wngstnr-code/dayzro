# Validasi Ide: Dayzro (Onchain Accepted Payables)

> Nama proyek: **Dayzro** ("day zero": dibayar di hari ke-0, bukan hari ke-60). Diriset 2026-09-24.

## 1. Ide dalam satu kalimat
Pembeli (debitur) **menyetujui invoice supplier secara onchain**. Invoice itu langsung jadi surat utang digital yang bisa dipindahtangankan (ERC-721). Supplier bisa mencairkannya **dalam <1 detik** ke pemberi dana dengan diskon. Saat jatuh tempo, pembeli membayar ke kontrak dan dana otomatis mengalir ke pemegang terakhir. Riwayat bayar pembeli tercatat onchain dan menjadi skor kreditnya.

Di dunia keuangan tradisional, ini disebut **reverse factoring / approved-payables financing / supply-chain finance**. Kuncinya, risiko ditentukan oleh **kredit pembeli**, bukan supplier.

## 2. Masalah (bukti)
- Menurut ADB, kekurangan pembiayaan perdagangan global mencapai **$2,5 triliun** (±10% perdagangan global). **41% pengajuan UMKM ditolak** (ADB Trade Finance Gap Survey 2025).
- Tempo pembayaran B2B 30–90 hari membuat modal kerja supplier kecil tertahan. Factoring konvensional lambat (verifikasi berhari-hari), mahal, dan hanya bisa diakses supplier yang punya hubungan dengan bank.
- Akar masalahnya ada di **verifikasi**. Pemberi dana tidak bisa memastikan (a) invoice itu asli dan diakui pembeli, (b) invoice tidak dijual dua kali (*double financing*), dan (c) pembayaran benar-benar sampai ke pemegang. Karena itu ada biaya due diligence, SPV, dan escrow bank.

## 3. Kenapa onchain, dan kenapa Arc
| Masalah verifikasi | Solusi Dayzro |
|---|---|
| Invoice asli & diakui? | Pembeli menandatangani penerimaan onchain (tx atau EIP-712/ERC-1271). Tidak bisa disangkal |
| Double financing | Satu invoice = satu NFT. Kepemilikannya tunggal dan publik |
| Pembayaran sampai ke pemegang? | Pembeli membayar ke kontrak, lalu kontrak meneruskan ke `ownerOf(id)`. Tanpa rekonsiliasi manual |
| Reputasi pembeli | Statistik bayar tepat waktu, telat, dan gagal bayar dihitung **di dalam kontrak** dari pembayaran nyata |
| Risiko gagal bayar | Opsi **guaranteed**: pembeli mengunci dana jaminan, sehingga siapa pun bisa mencairkannya ke pemegang setelah jatuh tempo |

**Kenapa harus Arc, bukan chain lain:**
- Arc secara eksplisit menyebut *"tokenization of real-world credit assets such as invoices, receivables, trade finance instruments"* sebagai use case yang didukung (blog Arc "How Arc supports lending and borrowing").
- USDC sebagai gas: supplier, pembeli, dan pemberi dana cukup memegang satu aset. Biaya per aksi ±$0,001, jadi invoice kecil ($50–$500) pun tetap ekonomis.
- Finality deterministik <1 detik: pencairan instan dan tidak bisa di-reorg. Ini syarat legal untuk "settlement final".
- Invoice multi-mata uang secara native: **USDC dan EURC** (perdagangan Eropa ↔ Asia).
- **Kontrak Memo** Arc: pembayaran bisa membawa nomor invoice/PO standar Arc yang dibaca indexer, wallet, dan ERP.
- **Multicall3From**: `approve + pay` dalam satu transaksi dari EOA. USDC/EURC juga mendukung `permit` (sudah dicek di mainnet).
- Validator institusional (DTCC, Standard Chartered, Visa, Mastercard) cocok dengan narasi *trade finance*. Privacy Sector (APS) di roadmap Arc adalah jawaban untuk kerahasiaan nominal invoice ke depannya.
- **Supply dana sudah ada, tapi yield-nya kosong.** Vault Morpho di Arc: Galaxy USDC ±$79,8 jt dengan APY ±0,03%, Keyrock Prime USDC ±$75 jt dengan APY ±0,05% (Morpho API, 2026-09-24). Ada ±$150 juta USDC menganggur yang butuh yield riil. Diskon invoice (mis. 8–15% APR) menawarkan itu.

## 4. Lanskap kompetitor
| Pemain | Model | Kelemahan yang kita manfaatkan |
|---|---|---|
| Centrifuge | Originator tradisional mem-*pool* aset lewat SPV offchain | Debitur tidak onchain. Kinerja aset dilaporkan originator, bukan terverifikasi |
| Huma Finance | Pool PayFi, receivable dijaminkan, underwriting offchain | Awalnya factoring invoice web3 (dengan Request Network). Sekarang fokus ke PayFi/pembiayaan pembayaran. Debitur tetap offchain |
| Request Network | Invoicing onchain | Tidak ada pembiayaan/pasar native. Pembeli tidak terikat secara onchain |
| Credix, Polytrade | Private credit / RWA trade finance | Butuh KYC dan originator. Tidak permissionless |
| Taulia (SAP), C2FO, Tradeshift | SCF/dynamic discounting web2 | Tertutup, butuh bank, hanya untuk pembeli besar, settlement T+1 atau lebih |

**Pembeda utama:** di semua pemain di atas, *debitur tidak ada di chain*, sehingga kinerja aset harus dipercaya. Di Dayzro, **debitur menandatangani dan membayar onchain**. Kinerja receivable bisa diverifikasi sendiri dan skor kredit dibentuk dari data nyata. Belum ada pemenang hackathon Arc di kategori ini.

## 5. Pasar awal (beachhead)
Mulai dari pihak yang **pembelinya sudah onchain dan sudah membayar dengan USDC**:
1. **B2B jasa kripto-native**: auditor smart contract, dev agency, market maker, firma riset, dan KOL agency yang menagih protokol/DAO/foundation dengan tempo net-15 sampai net-60. Pembelinya punya treasury USDC onchain, jadi opsi *guaranteed* mudah.
2. **UMKM lintas negara yang sudah memakai stablecoin** (Asia Tenggara, LatAm, Afrika). Partner pembayaran Arc (Thunes, Rain, Wirex) adalah jalur distribusi berikutnya.
3. Nanti: **AI agent sebagai pembeli**. Agent procurement dengan wallet ber-limit bisa menerima invoice vendor secara otomatis (sesuai narasi agentic Arc).

## 6. Model bisnis
| Sumber | Mekanisme | Default |
|---|---|---|
| Fee pembiayaan (utama) | % dari harga jual saat supplier menjual ke facility | 25 bps (0,25%), dikunci maksimal 100 bps di kontrak |
| Settlement | Gratis (supaya pembeli mau onboarding) | 0 |
| Fase 2: pooled facility | Management/performance fee untuk vault ERC-4626 receivable (LP pasif, kurator menetapkan limit pembeli) | 10% dari yield |
| Fase 3 | Integrasi ERP/akuntansi, badge verifikasi premium | SaaS |

Ilustrasi (bukan proyeksi): $1 juta dana tersalurkan per bulan × 0,25% = $2.500/bulan. Pembanding: fee factoring konvensional 1–5% dari nilai invoice, jadi ada ruang harga yang lebar.

Manfaat per pihak:
- **Supplier**: dapat uang di hari ke-0, bukan hari ke-60.
- **Pemberi dana**: yield riil jauh di atas ±0% vault USDC, dengan risiko yang terlihat onchain.
- **Pembeli**: bisa menegosiasikan tempo lebih panjang atau harga lebih baik. Kalau memakai jaminan, dananya tetap miliknya sampai jatuh tempo.

## 7. Risiko & mitigasi (jujur)
| Risiko | Tingkat | Mitigasi |
|---|---|---|
| **Cold start dua sisi** (butuh supplier, pembeli, pemberi dana) | Tinggi | Beachhead kripto-native. Tier *guaranteed* bebas risiko kredit, jadi pemberi dana mau masuk tanpa underwriting. Pembeli bisa mendanai sendiri pembayaran awal (*dynamic discounting*): membeli balik invoicenya dengan diskon |
| **Sybil/kolusi** (supplier membuat alamat pembeli palsu untuk menipu pemberi dana) | Tinggi untuk tier unsecured | Facility unsecured hanya membeli dari **pembeli yang di-allowlist pemberi dana** dengan limit per pembeli. Reputasi hanya sinyal. Verifikasi domain pembeli (DNS TXT, dicek di browser). Tier guaranteed kebal masalah ini |
| **Keberlakuan hukum** | Sedang | Tanda tangan penerimaan merujuk hash dokumen syarat. Arah regulasi mendukung: UNCITRAL MLETR (±12 yurisdiksi termasuk UK ETDA 2023 dan Prancis 2025) mengakui *electronic transferable records* seperti wesel/promissory note. Kontrak adalah software, dan pemberi dana menanggung risikonya sendiri |
| **Privasi nominal invoice** (semua publik) | Sedang | Dokumen hanya disimpan sebagai hash. Nominal tetap publik di MVP. Roadmap: pindah ke Arc Privacy Sector saat live. Bisa juga memakai alamat khusus per relasi |
| **Sengketa barang/jasa** setelah diterima | Sedang | Penerimaan bersifat final (seperti wesel). Pemegang bisa menerbitkan *credit note* (`reduceFace`) |
| **Blocklist USDC** | Rendah | Pembayaran ke pemegang memakai *try-push*, dan kalau gagal dana masuk ke saldo `claimable` |
| **Bug smart contract** | Sedang | Kontrak immutable dan minimal, admin terbatas (fee dikunci ≤1%). Test fuzz + invariant. Batas nominal di awal |

## 8. Skor terhadap kriteria juri
| Kriteria | Penilaian |
|---|---|
| Relevansi ke Arc | ★★★★★ Use case disebut eksplisit oleh Arc. Memakai USDC/EURC, Memo, Multicall3From, permit, dan finality |
| Kredibilitas teknis | ★★★★☆ Mesin status, EIP-712/1271, akuntansi jaminan, pricing onchain, invariant test |
| Kualitas build | Tergantung eksekusi. Scope MVP sengaja dibuat ramping (lihat design.md) |
| Layak dikembangkan | ★★★★★ Jalur jelas: pooled vault, privacy (APS), FX (StableFX), agen sebagai pembeli, lalu Circle Grant Program |

Kriteria pribadi kamu:
- Masalah dunia nyata ✅
- Model bisnis ✅
- Tanpa mock: semua aksi pakai USDC/EURC asli di mainnet ✅
- Tanpa backend: kontrak + frontend statis di Vercel + RPC ✅

## 9. Eksperimen validasi (murah, paralel dengan build)
1. Posting ide dan mockup alur di Arc House / X. DM 10 penyedia jasa kripto (auditor/dev shop).
   Pertanyaan: "Berapa hari rata-rata klien membayar? Pernah menunggu >30 hari? Mau terima 99% hari ini?"
2. DM 3–5 calon pemberi dana (kurator vault / pemegang USDC di Arc): "Mau membeli receivable *guaranteed* dengan 6–10% APR?"
3. **Target sebelum submit:** minimal 1 transaksi nyata dengan pihak luar (misalnya kamu menagih jasa ke teman/klien lewat Dayzro). Kalau belum ada, transaksi self-test di mainnet tetap sah tapi harus diberi label jujur.

**Kriteria lanjut/berhenti setelah grant:** kalau ≥3 supplier bersedia mencoba dan ≥1 pemberi dana menyetor dana ke facility, lanjut ke Circle Grant Program. Kalau tidak ada yang mau, pivot ke *dynamic discounting* (pembeli yang mendanai sendiri) untuk DAO.

## 10. Keputusan
**GO.** Fokus MVP: invoice → penerimaan (termasuk tanda tangan) → tier guaranteed → facility pemberi dana dengan allowlist pembeli → pembayaran/settlement → reputasi onchain. Marketplace terbuka dan pooled vault masuk fase 2.

## Sumber
- ADB Trade Finance Gap 2025: https://www.gtreview.com/news/global/trade-finance-gap-stabilises-at-us2-5tn/
- Arc tentang credit/receivables: https://www.arc.io/blog/how-arc-supports-lending-and-borrowing-arc-blueprints
- Onchain private credit 2026: https://www.spark.money/research/tokenized-private-credit-onchain
- Request × Huma: https://request.network/blog/request-and-huma-to-make-web3-invoice-factoring-a-reality
- Tokenised payables + stablecoin: https://www.straitsx.com/blog-post/how-tokenised-payables-and-stablecoin-settlement-can-transform-supply-chain-finance
- MLETR: https://academy.iccwbo.org/digital-trade/article/mletr-an-overview-of-uncitrals-model-law-on-electronic-transferable-records/
- Data vault Morpho di Arc: api.morpho.org (chainId 5042), diambil 2026-09-24
