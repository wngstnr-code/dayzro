# Desain Kontrak: Dayzro

> Versi desain 0.1 (2026-09-24). Target: Arc mainnet (chainId 5042). Solidity ^0.8.30, Foundry (arc-foundry), OpenZeppelin v5.

## 1. Prinsip
1. **Tanpa backend.** Semua state yang dibutuhkan UI bisa dibaca lewat view function (paginasi onchain). Tidak ada keeper: transisi berbasis waktu dihitung *lazy* di view, atau dipicu permissionless oleh pihak yang berkepentingan.
2. **Immutable & minimal admin.** Tidak ada proxy. Owner hanya bisa: set fee (≤100 bps, dikunci di kode), set treasury, menambah token (tidak bisa menghapus token yang sedang dipakai). Owner tidak punya kuasa atas dana user.
3. **ERC-20 saja.** USDC (`0x3600…0000`, 6 desimal) dan EURC (`0xbEf5…21c1`, 6 desimal). **Jangan pernah** memakai `msg.value` atau saldo native (18 desimal).
4. **Pull fallback.** Setiap pembayaran ke pihak ketiga memakai *try-transfer*. Kalau revert (misalnya blocklist), dana dikreditkan ke `claimable`.
5. **Tanpa randomness** (`PREVRANDAO` = 0 di Arc) dan tidak dibutuhkan.

## 2. Arsitektur

```
             ┌──────────────────────────── DayzroRegistry (ERC-721 "DZRO") ─────────────────────────────┐
 Supplier ──►│ createInvoice ─► Pending ─(buyer accept / acceptBySig)─► Accepted ─(pay penuh)─► Paid  │
 Buyer    ──►│ issuePayable (langsung Accepted)            │            │                             │
             │ Guarantee: deposit/withdraw/lock            │            ├─(due+30d, unsecured)► Defaulted ─(pay)► Paid
             │ BuyerStats (onchain reputation)             │            └─(due, guaranteed)─settleFromGuarantee─► Paid
             │ exposure[holder][buyer]                     │                                           │
             └─────────────────────────────────────────────┼───────────────────────────────────────────┘
                                                           │ transferFrom (NFT)
             ┌──────────────── DayzroFacility ──────────────▼──────┐
Financier ──►│ open/fund/withdraw, setBuyerLimit                  │
 Supplier ──►│ sell(fid, rid, minPrice) → USDC ke supplier <1 dtk │──► fee ke treasury
             └────────────────────────────────────────────────────┘
```

Dua kontrak saja:
- **`DayzroRegistry`**: receivable NFT, mesin status, pembayaran, jaminan, reputasi, dan exposure.
- **`DayzroFacility`**: likuiditas pemberi dana dan penjualan instan dengan harga dihitung onchain.

Pemberi dana memegang NFT langsung di wallet-nya (EOA atau Safe), jadi pembayaran dari pembeli otomatis masuk ke dia.

## 3. `DayzroRegistry`

### 3.1 Tipe data
```solidity
enum Status { None, Pending, Accepted, Paid, Cancelled, Defaulted }

struct Receivable {
    // slot 1
    address supplier;        // kreditur awal (penerbit invoice)
    uint64  dueDate;         // unix detik
    uint32  flags;           // bit0 GUARANTEED, bit1 EVER_DEFAULTED, bit2 BUYER_ISSUED
    // slot 2
    address buyer;           // debitur
    uint64  acceptedAt;
    Status  status;
    // slot 3
    address token;           // USDC atau EURC
    uint64  issuedAt;
    // slot 4
    uint128 faceAmount;      // nominal (6 desimal)
    uint128 paidAmount;
    // slot 5-6
    bytes32 docHash;         // keccak256 PDF invoice / syarat, dokumen tidak disimpan onchain
    bytes32 ref;             // keccak256 nomor invoice/PO, dipakai juga sebagai memoId Arc Memo
}

struct BuyerStats {          // per (buyer, token)
    uint32  accepted;
    uint32  paidOnTime;      // lunas ≤ dueDate
    uint32  paidLate;        // lunas > dueDate (termasuk pemulihan setelah default)
    uint32  defaults;        // pernah ditandai default
    uint32  guaranteeSettled;// dilunasi dari jaminan setelah jatuh tempo
    uint64  totalDaysLate;   // untuk rata-rata keterlambatan
    uint128 acceptedVolume;
    uint128 paidVolume;
    uint128 outstanding;     // sisa belum dibayar untuk semua receivable Accepted/Defaulted
}
```
Status **Overdue** tidak disimpan. Dihitung di view: `Accepted && block.timestamp > dueDate`.

### 3.2 Konstanta & parameter
| Nama | Nilai | Alasan |
|---|---|---|
| `DEFAULT_GRACE` | 30 hari | Setelah due + 30 hari, receivable unsecured boleh ditandai default oleh siapa pun |
| `MAX_TENOR` | 365 hari | Batas `dueDate` saat dibuat |
| `MIN_FACE` | 1e6 (1 USDC) | Anti-spam |

### 3.3 Fungsi: penerbitan & penerimaan
```solidity
function createInvoice(
    address buyer, address token, uint128 faceAmount, uint64 dueDate,
    bytes32 docHash, bytes32 ref
) external returns (uint256 id);
// msg.sender = supplier. Mint NFT ke supplier, status Pending (belum bisa ditransfer).

function accept(uint256 id, bool guaranteed) external;               // msg.sender == buyer
function acceptBySig(uint256 id, bool guaranteed, uint256 deadline, bytes calldata sig) external;
// Siapa pun boleh submit. ECDSA diterima jika recover == buyer (termasuk EOA ber-delegasi EIP-7702),
// fallback ERC-1271 untuk smart wallet (Safe).
// EIP-712 typed data (TANPA nonce: sig terikat ke id + domain, dan accept hanya bisa sekali,
// sehingga tidak bisa di-replay dan buyer bisa menandatangani banyak invoice paralel):
// Accept(uint256 id, address token, uint128 faceAmount, uint64 dueDate, bytes32 docHash, bool guaranteed, uint256 deadline)
// Semua term invoice di-sign sehingga supplier tidak bisa mengubah term setelah pembeli tanda tangan.

function issuePayable(
    address supplier, address token, uint128 faceAmount, uint64 dueDate,
    bytes32 docHash, bytes32 ref, bool guaranteed
) external returns (uint256 id);
// msg.sender = buyer. Langsung Accepted, NFT di-mint ke supplier (mis. pembeli menerbitkan PO/tagihan yang sudah disetujui).

function reject(uint256 id) external;   // buyer, hanya saat Pending → Cancelled
function cancel(uint256 id) external;   // supplier, hanya saat Pending → Cancelled
```
Jika `guaranteed == true` saat accept: `guaranteeFree(buyer, token) >= faceAmount`. Kalau cukup, `guaranteeLocked += faceAmount` dan set flag GUARANTEED.

### 3.4 Fungsi: pembayaran & settlement
```solidity
function pay(uint256 id, uint128 amount) external;                    // siapa pun (umumnya buyer); transferFrom msg.sender
function payWithPermit(uint256 id, uint128 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
function payFromGuarantee(uint256 id, uint128 amount) external;       // hanya buyer; memakai saldo jaminan miliknya
function settleFromGuarantee(uint256 id) external;                    // siapa pun, jika GUARANTEED && now > dueDate
function markDefault(uint256 id) external;                            // siapa pun, jika !GUARANTEED && Accepted && now > dueDate + DEFAULT_GRACE
function claim(address token) external;                               // tarik saldo claimable
```
Alur internal `_settle(id, amount, source)`:
1. `amount = min(amount, face - paid)`. Revert kalau status bukan Accepted/Defaulted.
2. Tarik dana (dari `msg.sender` atau dari saldo jaminan buyer).
3. `holder = ownerOf(id)`. Coba `token.transfer(holder, amount)` lewat low-level call. Kalau gagal, `claimable[holder][token] += amount`.
4. Update `paidAmount`, `exposure[holder][buyer] -= amount`, `stats.outstanding -= amount`, `paidVolume += amount`.
5. Kalau GUARANTEED: `guaranteeLocked -= min(amount, sisaLock)`. Pembayaran dari wallet membuka lock, pembayaran dari jaminan membuka lock sekaligus mengurangi saldo.
6. Kalau lunas: status `Paid`. Hitung stats: `≤ dueDate` → paidOnTime, selain itu paidLate dan `totalDaysLate += ceil((now-due)/1d)`. Kalau sumbernya `settleFromGuarantee` → guaranteeSettled.

**Integrasi Arc:**
- **Memo:** frontend memanggil `Memo.memo(target=Registry, data=pay(id,amt), memoId=ref, memoData=<PO/nomor invoice UTF-8>)`. `CallFrom` menjaga `msg.sender` = EOA buyer, jadi `pay` bekerja tanpa perubahan kontrak. Event `Memo` bisa dibaca ERP/indexer mana pun.
- **Multicall3From:** `aggregate3([USDC.approve(Registry, amt), Registry.pay(id, amt)])` dalam satu tx dari EOA.
- **Permit:** USDC/EURC di Arc mendukung EIP-2612 (`DOMAIN_SEPARATOR`, `nonces`, version "2", sudah dicek di mainnet). `payWithPermit` untuk EOA biasa (akun EIP-7702 pakai jalur Multicall3From, lihat bagian 11).

### 3.5 Fungsi: jaminan (guarantee)
```solidity
function depositGuarantee(address token, uint128 amount) external;
function withdrawGuarantee(address token, uint128 amount) external;  // hanya bagian bebas (balance - locked)
function guaranteeOf(address buyer, address token) external view returns (uint128 balance, uint128 locked);
```
Dana jaminan disimpan di Registry (tidak di-yield di MVP. APY vault USDC Morpho di Arc sekarang ±0%, dan ini menambah risiko). Fase 2: adapter ERC-4626 opsional.

### 3.6 Fungsi: penyesuaian oleh pemegang
```solidity
function reduceFace(uint256 id, uint128 reduceBy) external;  // hanya holder: credit note / diskon / penghapusan sebagian
function release(uint256 id) external;                       // hanya holder: penghapusan penuh → Cancelled
```
Keduanya membuka lock jaminan secara proporsional dan mengurangi `outstanding`/`exposure`. Stats tidak dihitung sebagai bayar/default.

### 3.7 Aturan transfer NFT (override `_update`)
| Status | Bisa ditransfer? |
|---|---|
| Pending | ❌ (belum jadi kewajiban) |
| Accepted / Defaulted | ✅. Update `exposure[from][buyer] -= remaining; exposure[to][buyer] += remaining`. Kalau `to == buyer`, utang padam (lihat 4.4 poin 5) |
| Paid / Cancelled | ❌ (arsip) |
Mint Pending tidak menambah exposure. Accept menambah `exposure[holder][buyer]`.

### 3.8 View untuk frontend (tanpa indexer)
```solidity
function getReceivable(uint256 id) external view returns (Receivable memory, Status effective, uint128 remaining, address holder);
function buyerStats(address buyer, address token) external view returns (BuyerStats memory);
function idsBySupplier(address s, uint256 offset, uint256 limit) external view returns (uint256[] memory);
function idsByBuyer(address b, uint256 offset, uint256 limit) external view returns (uint256[] memory);
function totalReceivables() external view returns (uint256);
function exposure(address holder, address buyer, address token) external view returns (uint128);
function claimable(address account, address token) external view returns (uint256);
function tokenURI(uint256 id) public view returns (string memory);   // SVG onchain: nominal, jatuh tempo, status
```
Portofolio pemegang = ERC-721 Enumerable (`tokenOfOwnerByIndex`). Array per supplier/buyer bersifat append-only.

### 3.9 Profil pembeli (opsional, murah)
```solidity
function setProfile(string calldata name, string calldata domain) external; // disimpan per address
```
Frontend memverifikasi domain di browser lewat DNS-over-HTTPS (`_dayzro.<domain>` TXT = `dayzro=<address>`). Hasilnya badge "Domain verified" tanpa server milik kita.

### 3.10 Event
```solidity
event InvoiceCreated(uint256 indexed id, address indexed supplier, address indexed buyer, address token, uint128 face, uint64 dueDate, bytes32 docHash, bytes32 ref);
event Accepted(uint256 indexed id, address indexed buyer, bool guaranteed);
event Rejected(uint256 indexed id);
event Cancelled(uint256 indexed id);
event Paid(uint256 indexed id, address indexed payer, address indexed holder, uint128 amount, uint8 source, bool pushed);
event Settled(uint256 indexed id, bool onTime);
event Defaulted(uint256 indexed id, address indexed buyer);
event FaceReduced(uint256 indexed id, uint128 newFace);
event GuaranteeDeposited(address indexed buyer, address indexed token, uint128 amount);
event GuaranteeWithdrawn(address indexed buyer, address indexed token, uint128 amount);
event Claimed(address indexed account, address indexed token, uint256 amount);
```

## 4. `DayzroFacility`

### 4.1 Tipe data
```solidity
struct Facility {
    address financier;
    address token;
    uint16  aprBps;           // tingkat diskon tahunan, mis. 1000 = 10%
    uint32  maxTenorDays;     // sisa hari maksimum sampai jatuh tempo
    bool    acceptGuaranteed; // beli receivable GUARANTEED dari buyer mana pun tanpa limit
    bool    active;
    uint128 available;        // likuiditas yang di-escrow
}
mapping(uint256 fid => mapping(address buyer => uint128 cap)) public buyerCap; // limit unsecured per buyer
```

### 4.2 Fungsi
```solidity
function open(address token, uint16 aprBps, uint32 maxTenorDays, bool acceptGuaranteed, uint128 deposit) external returns (uint256 fid);
function fund(uint256 fid, uint128 amount) external;
function withdraw(uint256 fid, uint128 amount) external;              // financier
function setTerms(uint256 fid, uint16 aprBps, uint32 maxTenorDays, bool acceptGuaranteed, bool active) external;
function setBuyerCap(uint256 fid, address buyer, uint128 cap) external;
function quote(uint256 fid, uint256 rid) external view returns (bool ok, uint128 price, uint128 fee, string memory reason);
function sell(uint256 fid, uint256 rid, uint128 minPrice) external;   // msg.sender == ownerOf(rid), sudah approve Facility
```

### 4.3 Harga (diskon bunga sederhana, dihitung onchain)
```
remaining = face - paid
t         = dueDate - now            (detik; syarat t > 0 dan t ≤ maxTenorDays·1d)
price     = remaining · (YEAR · 10_000) / (YEAR · 10_000 + aprBps · t)     // dibulatkan ke bawah
fee       = price · feeBps / 10_000                                        // protocol fee, feeBps ≤ 100
supplier menerima price - fee; treasury menerima fee; available -= price
```
Contoh: invoice $1.000, jatuh tempo 60 hari, APR 10%, maka price ≈ $983,83, fee 0,25% ≈ $2,46, supplier menerima ≈ $981,37 **dalam satu transaksi**.

### 4.4 Syarat `sell`
1. Facility `active`, token sama, `available ≥ price`, `price ≥ minPrice`.
2. Receivable berstatus Accepted (bukan Pending/Paid/Defaulted) dan belum overdue.
3. Jika GUARANTEED dan `acceptGuaranteed`: lolos tanpa cap.
   Selain itu: `registry.exposure(financier, buyer, token) + remaining ≤ buyerCap[fid][buyer]`.
   Catatan: exposure dihitung per financier, lintas semua facility miliknya.
4. Efek: `registry.transferFrom(seller, financier, rid)`, lalu bayar seller dan treasury.
5. Kasus khusus *dynamic discounting*: kalau `financier == buyer`, pembeli membayar lebih awal dengan diskon. Logikanya ada di **Registry `_update`**: setiap transfer receivable Accepted **ke alamat buyer-nya sendiri** memadamkan utang (status `Paid`, `paidOnTime`, `paidAmount = face`, `outstanding`/`exposure` dikurangi sisa, lock jaminan dibuka). Dengan begitu transfer OTC langsung ke buyer juga konsisten.

### 4.5 Event
```solidity
event FacilityOpened(uint256 indexed fid, address indexed financier, address token, uint16 aprBps, uint32 maxTenorDays, bool acceptGuaranteed);
event FacilityFunded(uint256 indexed fid, uint128 amount);
event FacilityWithdrawn(uint256 indexed fid, uint128 amount);
event BuyerCapSet(uint256 indexed fid, address indexed buyer, uint128 cap);
event Financed(uint256 indexed fid, uint256 indexed rid, address indexed seller, uint128 price, uint128 fee);
```

## 5. Invariant (wajib diuji dengan Foundry invariant tests)
1. Per token: `token.balanceOf(Registry) == Σ guaranteeBalance + Σ claimable`.
2. Per token: `token.balanceOf(Facility) == Σ facility.available` (fee langsung ke treasury).
3. `paidAmount ≤ faceAmount` untuk semua receivable.
4. `guaranteeLocked[b][t] ≤ guaranteeBalance[b][t]`, dan `guaranteeLocked` = Σ sisa receivable GUARANTEED milik b.
5. `stats[b][t].outstanding == Σ remaining` receivable b yang Accepted/Defaulted.
6. `exposure[h][b] == Σ remaining` receivable milik h dengan buyer b yang Accepted/Defaulted.
7. Status hanya maju sesuai diagram. Paid/Cancelled bersifat terminal.
8. NFT Pending/Paid/Cancelled tidak pernah berpindah pemilik.

## 6. Keamanan
- `ReentrancyGuard` di semua fungsi yang memindahkan token. `SafeERC20` untuk pull. Low-level call untuk try-push.
- EIP-712 domain memakai `chainId` + alamat kontrak, plus `deadline`. Tanpa nonce (one-shot per id). ECDSA untuk EOA dan EOA EIP-7702, ERC-1271 untuk Safe.
- `sell` memakai `minPrice` (proteksi terhadap perubahan terms facility di blok yang sama).
- Financier bisa mengubah APR kapan saja, tapi `minPrice` melindungi supplier.
- Tidak ada `selfdestruct` / delegatecall. Tidak ada upgrade.
- Owner = `Ownable2Step`, hanya untuk `setFeeBps (≤100)`, `setTreasury`, `allowToken`.
- Front-running `acceptBySig`: aman karena signature terikat ke id + seluruh term.
- Token dengan blocklist: pull dari blocklisted revert (wajar), push ke blocklisted masuk claimable.
- Batas awal di UI (bukan di kontrak): peringatan untuk face > $10k sampai ada audit.

## 7. Rencana test
- Unit test per fungsi dan per transisi status (termasuk semua revert path).
- Fuzz: pricing (`price ≤ remaining`, monoton turun terhadap t dan apr), pembayaran parsial acak.
- Invariant: handler acak (create/accept/pay/transfer/sell/default/reduce/withdraw) untuk invariant 1–8.
- **Fork test Arc mainnet dengan `arc-anvil`** (anvil biasa tidak mereproduksi USDC native Arc), memakai USDC/EURC asli, Memo, Multicall3From, dan permit.

## 8. Frontend (Vercel, tanpa backend)
- Next.js App Router + wagmi/viem + RainbowKit. Chain Arc 5042, RPC `https://rpc.mainnet.arc.io`.
- **Tidak ada** server actions atau database. Semua baca lewat view + Multicall3, semua tulis lewat wallet user.
- Satu pengecualian: `/api/rpc`, relay baca-saja ke RPC publik Arc (fallback ke 4 endpoint, hanya metode baca, tanpa state dan tanpa kunci). Alasannya: Brave Shields dan beberapa ad-blocker memblokir request ke `rpc.*.arc.io`, sedangkan request ke domain sendiri tidak diblokir. Transaksi tetap dikirim wallet lewat node-nya sendiri.
- Halaman:
  - `/` ringkasan protokol (total volume, facility aktif), dibaca dari kontrak.
  - `/new` supplier membuat invoice (hash PDF dihitung di browser, file tidak diunggah) dan mendapat link `/r/[id]`.
  - `/r/[id]` detail + aksi kontekstual: accept/sign (buyer), sell ke facility (holder), pay via Memo/Multicall3From/permit, settle/markDefault.
  - `/b/[address]` profil & statistik kredit pembeli + badge domain (DoH).
  - `/finance` pemberi dana: buat/isi facility, cap per pembeli, portofolio, klaim.
- Deploy ke Vercel sebagai situs statis.

## 9. Scope MVP vs fase berikutnya
| MVP (untuk submission) | Fase 2+ |
|---|---|
| Registry lengkap (bagian 3) | Marketplace terbuka (listing/offer) |
| Facility (bagian 4) | Pooled facility ERC-4626 (LP pasif + kurator) |
| Pembayaran via Memo, Multicall3From, permit | Invoice EURC dibiayai USDC via StableFX/Uniswap |
| Profil pembeli + verifikasi domain | Jaminan di-yield (adapter ERC-4626 Morpho) |
| SVG tokenURI | Arc Privacy Sector untuk nominal rahasia |
| | Agen AI (ERC-8004) sebagai pembeli dengan kebijakan limit |

## 10. Rencana kerja (solo, target submit ±7–9 Okt, lebih awal lebih baik)
| Hari | Pekerjaan |
|---|---|
| 1–2 | Setup arc-foundry, Registry: struct, create/accept/sig, transfer rules |
| 3–4 | Registry: pay/settle/guarantee/default/reduce, stats, exposure |
| 5 | Facility + pricing |
| 6–7 | Fuzz + invariant + fork test mainnet |
| 8 | Deploy mainnet + verifikasi di explorer.arc.io |
| 9–12 | Frontend 5 halaman |
| 13 | Transaksi nyata end-to-end (idealnya dengan 1 pihak luar), README, video demo 2 menit |
| 14 | Submit DoraHacks |

## 11. Catatan implementasi (2026-09-24)
- `exposure` dikunci per token: `exposure[holder][buyer][token]`. Cap facility berlaku per token, jadi USDC dan EURC tidak tercampur.
- `DayzroRenderer` adalah linked library (di-deploy terpisah) supaya Registry punya ruang ±4,4KB di bawah batas 24KB.
- **EIP-7702 di Arc mainnet:** banyak alamat (termasuk kunci uji populer) sudah ber-delegasi. USDC/EURC `permit` untuk akun seperti ini diverifikasi lewat ERC-1271 dan bisa gagal. Frontend harus menyediakan jalur cadangan: `accept()` sebagai tx biasa, dan `approve + pay` via Multicall3From.
- Status test: 34 unit Registry + 11 Facility (termasuk fuzz) + 3 invariant (8.192 panggilan acak per invariant; jalur sell/settle/default/transfer terbukti tereksekusi) + 5 fork test di Arc mainnet (USDC asli, Memo, Multicall3From, permit). Simulasi deploy mainnet: ±0,38 USDC gas.

## 12. Keputusan yang sudah diambil (dan alasannya)
- **Dua kontrak, bukan satu:** Facility bisa dikembangkan (pooled vault) tanpa menyentuh Registry yang memegang jaminan.
- **NFT dipegang financier langsung**, bukan di-escrow Facility: pembayaran otomatis ke pemegang, dan financier bebas menjual lagi.
- **Exposure dilacak di Registry** melalui hook transfer/pay. Cap per pembeli otomatis turun saat invoice dibayar, tanpa keeper.
- **Jaminan tidak di-yield di MVP:** APY vault USDC di Arc saat ini ±0%, dan integrasi 4626 menambah permukaan risiko.
- **Default setelah 30 hari grace** dan permissionless. Receivable yang di-default tetap bisa dibayar (pemulihan) dan tetap bisa ditransfer (jual ke penagih).
