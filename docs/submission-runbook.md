# Runbook submission Kadd — Monad Metropolis

Semua yang tersisa sampai submit, berurutan, dengan cara mengecek tiap langkah. Deadline: **14 Okt 2026, 10:59 WIB**.

Dokumen lain yang dirujuk dari sini (tidak diulang isinya):
- [`env-setup.md`](env-setup.md) — semua environment variable
- [`perpl-setup.md`](perpl-setup.md) — bot Perpl langkah demi langkah
- [`telegram-setup.md`](telegram-setup.md) — Telegram + Redis
- [`../SUBMISSION.md`](../SUBMISSION.md) — teks submission, naskah video demo & pitch
- [`../TRACKS.md`](../TRACKS.md) — syarat track & bounty

---

## 0. Peta track & bounty

| Target | Hadiah | Yang ditunjukkan ke juri | Status kode | Yang masih harus dilakukan |
|---|---|---|---|---|
| **Track: Onchain Finance & Trading** | $10k | Find → Check → Follow: smart money, backtest, copy vault berlimit kontrak, perps dengan harga likuidasi | ✅ | Isi ✍️ Founder & Traction (§9), kumpulkan traction (§10) |
| **Nansen** | $5k | Tab Smart Money, badge SMART, ticker, /start picks, agent API | ✅ | Tunjukkan di video (§8) |
| **Envio** | $1k | Indexer multichain (Kadd testnet + Perpl mainnet), Stats, risk Perpl | ✅ | Repo public (§12) |
| **Mera — UX** | $2.5k | Passkey → gas otomatis → trade pertama < 1 menit, signing tanpa prompt, stateless test | ✅ | Latihan stateless test (§4) |
| **Mera — One Passkey, Many Keys** | $2.5k | Private notes terenkripsi ke passkey, dibuka di device lain | ✅ | Upstash (§2), tes & rekam cross-device (§3) |
| **Perpl — API** | $5k | Copy bot yang mirror trader mainnet di Perpl testnet | ✅ kode | 🔴 **Setup bot + aktivitas onchain** (§5) |
| **Perpl — Analytics/Risk** | $3k | /perps/risk, profil wallet perps, compare, search alamat | ✅ | Tunjukkan di video |
| **Agora — Mobile Trading** | $10k | Di HP: login passkey → saldo AUSD → trade Perpl | ✅ kode | 🔴 **Rekam demo di HP** (§6) |
| **Kuru — Consumer Trading App** | $5k | Live · Kuru di halaman token, Get AUSD (MON→AUSD) | ✅ | Trade mainnet nyata + isi target user/demand/retention (§7) |

Tidak diikuti: MetaMask Agent Wallet, Agora Cross-Border Payments, Kuru New Assets.

---

## 1. Merge & deploy

1. Merge **PR #19** (`feat/app-pumpfun-ui` → `dev`). Vercel deploy otomatis.
2. Kalau PR menyentuh `indexer/`, Envio membuat deployment baru → salin URL GraphQL baru ke `ENVIO_INDEXER_URL` di
   Vercel → **Redeploy**. (PR #19 tidak menyentuh indexer, jadi biasanya tidak perlu.)
3. Tunggu 1–2 menit setelah deploy sebelum mengecek `/perps/risk` (instance dingin; chart terisi setelah cache 60 detik).

### Smoke test production (±10 menit)

Buka https://kaad-app.vercel.app di Chrome desktop, lalu di HP.

| Halaman | Cek |
|---|---|
| `/` | Landing tampil; angka "Live from Monad" terisi; VectorField bergerak ikut kursor; FAQ buka-tutup |
| `/trenches` | 4 panel terisi (Trending, Smart money calls, Leaderboard, Latest trades); ticker "Top wallets" jalan |
| Search (⌘K) | Ketik `chog` → token; paste alamat wallet → "Open wallet"; paste alamat token → halaman token |
| `/token/<CHOG>` | Chart, skor risiko, panel trade, Live · Kuru |
| `/wallet/<alamat>` | Profil, panel **Your private note**, Perps on Perpl (kalau wallet punya posisi) |
| `/leaderboard` | Tab Smart Money terisi (Nansen) |
| `/perps`, `/perps/risk` | Pasar, peta likuidasi, posisi terdekat likuidasi |
| `/stats` | Angka dari indexer (bukan 0 semua) |
| HP | Bottom nav, tab panel di /trenches, Quick buy terlihat, trade panel bisa dipakai satu tangan |

Kalau ada yang kosong: cek env di §11 (Troubleshooting).

---

## 2. Upstash Redis (wajib untuk Private notes & Telegram)

1. Vercel → project `kaad-app` → **Storage** → **Create Database** → **Upstash for Redis** → plan free → region dekat
   fungsi Vercel.
2. **Connect** ke project untuk **Production** (dan Preview kalau perlu). Vercel otomatis menambah `KV_REST_API_URL` dan
   `KV_REST_API_TOKEN`.
3. **Redeploy**.
4. Cek: buka `https://kaad-app.vercel.app/api/notes?address=0x0000000000000000000000000000000000000001`
   → harus `{"ready":true,"vault":null,...}`. Kalau `ready:false` → env belum masuk / belum redeploy.

---

## 3. Private notes — tes & rekaman (bounty Mera Many Keys)

**Cara kerjanya (untuk dijelaskan di video):** catatan disimpan sebagai satu *Mera secret vault*. Key enkripsinya
(AES-256-GCM) diturunkan dari passkey yang sama, tapi lewat **salt PRF acak sendiri** — jadi tidak berhubungan dengan
key wallet, dan tiap simpan memakai salt baru. Server Kadd hanya menyimpan ciphertext; penulisan wajib ditandatangani
akun pemilik dengan timestamp, sehingga versi lama tidak bisa diputar ulang.

### Syarat
- Upstash sudah terhubung (§2).
- Passkey yang tersinkron ke dua device (iCloud Keychain, Google Password Manager, atau 1Password).
- Browser yang mendukung passkey PRF: Chrome / Safari terbaru.

### Langkah (rekam layar dua device)
1. **Device A (laptop):** login → buka wallet mana saja (mis. dari Leaderboard) → panel **Your private note** →
   **Unlock notes** (1 prompt passkey) → tulis catatan → **Save note** (1 prompt passkey). Muncul toast
   "Note saved, encrypted to your passkey".
2. Tunjukkan bahwa server tidak bisa membaca: buka `/api/notes?address=<alamat akunmu>` → yang terlihat hanya
   `ciphertext`, `nonce`, `prfSalt`.
3. **Device B (HP):** buka kaad-app.vercel.app (atau hapus data situs di device A untuk versi "stateless") → **Sign in**
   dengan passkey yang sama → alamat akun sama → buka wallet yang sama → **Unlock notes** → catatan muncul.
4. (Opsional) Edit di device B → simpan → refresh device A → Unlock → versi baru.

### Kalau gagal
| Pesan | Artinya |
|---|---|
| "Private notes need storage that isn't set up…" | Upstash belum terhubung / belum redeploy (§2) |
| "This device or browser doesn't support passkey PRF yet…" | Ganti ke Chrome/Safari terbaru atau password manager yang mendukung PRF |
| "A newer version is already saved" | Device lain menyimpan lebih baru → refresh, Unlock lagi |
| "Clock out of sync" | Jam device meleset > 5 menit |

Tes otomatis (lokal): lihat header `kadd/scripts/notes-e2e.mts` (mock Redis + dev server), harus mencetak
`notes e2e: all checks passed`.

---

## 4. Mera UX — stateless test (juri pasti mencoba)

1. Device A: buka situs → **Sign in** → buat passkey → catat alamat akun (menu akun di kanan atas).
2. Buka DevTools → Application → **Clear site data** (atau buka di device lain / jendela private).
3. Buka situs lagi → **Sign in** → pilih passkey yang sama → **alamat harus sama**, saldo tUSDC & posisi tetap ada
   (dibaca dari chain, bukan localStorage).
4. Untuk video time-to-first-transaction: `/start` menampilkan timer dari datang sampai trade terkonfirmasi.

Yang hilang setelah clear data (dan itu wajar, sebutkan kalau ditanya): daftar follow, watchlist, alert lokal —
tersimpan di browser. Akun, saldo, vault, club, dan private notes ikut kembali dari passkey + chain.

---

## 5. Perpl bot — aktivitas onchain (bounty Perpl API) 🔴 prioritas

Ikuti [`perpl-setup.md`](perpl-setup.md) langkah 1–8. Ringkasnya:

1. Wallet khusus bot (bukan wallet pribadi) → testnet MON dari https://faucet.monad.xyz.
2. https://testnet.perpl.xyz → connect wallet bot → ambil AUSD testnet → **deposit ≥ 100 AUSD** (membuka akun).
3. Aktifkan One-Click Trading → https://testnet.perpl.xyz/apikeys → buat key **trade** scope.
4. Pilih leader: Leaderboard → Perps · Perpl → trader dengan posisi aktif, leverage wajar.
5. Vercel env: `PERPL_BOT_API_KEY`, `PERPL_BOT_API_SECRET`, `PERPL_BOT_ADDRESS`, `PERPL_BOT_LEADER`,
   `PERPL_BOT_BUDGET_USD` (mis. 200), `PERPL_BOT_MAX_LEVERAGE` (mis. 3) → **Redeploy**.

### Cek berhasil
- Leaderboard → tab Perps · Perpl → panel bot menampilkan buku posisi bot vs leader.
- Explorer testnet untuk `PERPL_BOT_ADDRESS`: ada transaksi order dari keeper tiap tick.
- Biarkan jalan **beberapa jam sebelum deadline** supaya ada riwayat trade yang bisa ditunjukkan.

Hentikan sementara: `PERPL_BOT_PAUSED=1` → redeploy.

---

## 6. Demo Agora di HP (bounty Agora Mobile Trading) 🔴 prioritas

Deliverable juri: **login passkey → saldo AUSD → minimal 1 trade Perpl**, di HP.

### Persiapan
- Pilih jalur:
  - **Testnet (gratis):** AUSD testnet dari testnet.perpl.xyz ke alamat akun Kadd-mu (alamat yang sama dengan passkey).
  - **Mainnet (uang asli, lebih meyakinkan):** isi akun dengan sedikit MON → `/perps` mainnet → **Get AUSD**
    (swap MON→AUSD lewat Kuru di dalam Kadd).
- Rekam layar: iPhone (Control Center → Screen Recording) atau Android (Quick Settings → Screen record).

### Alur rekaman (±60 detik)
1. Buka kaad-app.vercel.app di HP → **Sign in** dengan passkey (Face ID / sidik jari). Sebut: "tanpa app wallet,
   tanpa seed phrase".
2. Bottom nav → **Perps** → tunjukkan **saldo AUSD** (di wallet dan di Perpl).
3. Deposit AUSD ke Perpl (kalau belum) → pilih market (BTC/ETH) → Long/Short, leverage → tunjukkan **harga likuidasi**
   di tiket → konfirmasi (passkey menandatangani langsung ke kontrak Perpl).
4. **Your positions** → posisi terbuka → (opsional) Close.

---

## 7. Kuru — bukti demand

Juri Kuru menilai: target user, bukti demand, strategi akuisisi & retensi, rencana lanjut.

1. Lakukan **beberapa trade mainnet nyata** lewat Kadd: halaman token → **Live · Kuru** → quote → review minimum →
   passkey. Simpan hash transaksinya (Monadscan) untuk dicantumkan.
2. (Opsional) `KURU_REFERRER` + `KURU_REFERRER_BPS` di Vercel = jalur revenue (lihat env-setup §7).
3. Isi target user, demand, retention di SUBMISSION (§9). Retensi yang sudah ada di produk: alert Telegram & in-app,
   copy vault yang terus berjalan, invite onchain, share card.

---

## 8. Nansen, Envio, Perpl Analytics — yang ditunjukkan

| Bounty | Tunjukkan | Di mana |
|---|---|---|
| Nansen | Data Nansen sebagai fitur inti: tab Smart Money, badge SMART, ticker, /start picks, endpoint yang dipakai | Leaderboard, /trenches, `NANSEN.md` |
| Envio | Indexer live (Envio Cloud), schema & handlers, data dipakai di Stats dan risk Perpl, multichain | `/stats`, `/perps/risk`, folder `indexer/` |
| Perpl Analytics | Protokol (TVL, OI, volume, peta likuidasi, flows) ↔ drill-down wallet (search alamat → profil, posisi, harga likuidasi, PnL all-time, compare) | `/perps/risk`, search, `/wallet/…`, `/perps/compare` |

Sudah dicatat di SUBMISSION kenapa histori trade/win rate per wallet Perpl tidak ada (event fill tidak terindeks per akun,
~50k/hari, tidak muat plan gratis Envio).

---

## 9. Mengisi bagian ✍️ di SUBMISSION.md

Cari tanda ✍️ dan isi dengan jawaban konkret (juri menilai *spesifik*, bukan "crypto traders"):

| Bagian | Pertanyaan yang harus dijawab |
|---|---|
| Founder & market | Siapa **first user**-mu? Komunitas/grup mana, berapa orang, apa yang mereka lakukan sekarang (copy KOL manual, screenshot, bot Telegram)? |
| Traction | Angka dari `/stats` saat submit: trades, volume, wallets, copy vault, invite yang join & trade. Plus hal di luar app: orang yang sudah kamu ajak bicara/coba. |
| Kuru (target user, demand, retention) | Target user spesifik; bukti demand (trade nyata, user yang kembali); rencana retensi (alert, vault berjalan, club) |
| Pitch: Problem / Traction / Team & next | Ikuti naskah di SUBMISSION → bagian Pitch video |
| Judge access → Repo | Link repo public, atau konfirmasi akses untuk `metropolis@hackathon.monad.xyz` |
| Monad Community | Hanya kalau tim terdaftar di komunitas onboard (diatur di profil portal) |

---

## 10. Traction cepat (bobot 20%)

- Kirim link invite (**Portfolio** → Invite a friend → Copy invite link) ke 10–20 orang; invite tercatat **onchain** (`KaddReferrals`) dan terlihat di
  `/stats` — angka yang bisa diverifikasi juri.
- Minta tiap orang: Sign in → `/start` → copy satu trade ($10 tUSDC, gratis). ±1 menit per orang.
- Buat 1–2 **copy club** dan ajak teman deposit; buka 1–2 copy vault aktif supaya halaman vault punya riwayat copy.
- Screenshot `/stats` sebelum submit untuk dimasukkan ke SUBMISSION.

---

## 11. Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `/stats` atau leaderboard Kadd kosong | `ENVIO_INDEXER_URL` lama / kosong | Salin URL deployment Envio terbaru → redeploy |
| Tab Perps pakai "open PnL", bukan all-time | Indexer tidak terbaca | Sama seperti di atas |
| Smart Money kosong / ticker hanya Perpl | `NANSEN_API_KEY` kosong atau kuota habis | Cek key; data di-cache 10 menit |
| Harga/chart token gagal | GeckoTerminal rate-limit IP Vercel | Isi `COINGECKO_API_KEY` |
| User baru tidak bisa transaksi | `DRIP_PRIVATE_KEY` kosong / wallet drip habis MON | Isi ulang MON testnet ke wallet drip |
| Auto copy tidak jalan | Keeper key ≠ `KEEPER` di kontrak, atau cron tidak memanggil `/api/copy/keeper` | Cek `KEEPER_PRIVATE_KEY` |
| `/perps/risk` chart kosong setelah deploy | Instance dingin | Tunggu 1–2 menit, refresh |
| Envio "plan limit" | Event melebihi 100k | Jangan tambah event volume tinggi; hapus deployment lama di Envio |

---

## 12. Checklist deliverable (dari TRACKS.md)

- [ ] Logo/graphic (JPG/PNG/WEBP, ≤ 3MB)
- [ ] Repo **public**, atau akses untuk `metropolis@hackathon.monad.xyz` (konfirmasi dulu sebelum mengubah visibilitas)
- [ ] Video demo ≤ 3 menit, produk live (naskah di SUBMISSION) — termasuk klip HP untuk Agora (§6)
- [ ] Video pitch ≤ 2 menit
- [ ] Link live: https://kaad-app.vercel.app + instruksi akses juri (sudah di SUBMISSION → Judge access)
- [ ] Bagian ✍️ di SUBMISSION terisi (§9)
- [ ] Bounty yang dipilih di form: Nansen, Envio, Mera UX, Mera Many Keys, Perpl API, Perpl Analytics, Agora Mobile, Kuru Consumer
- [ ] (Opsional) iklan produk ≤ 30 detik

## 13. Keamanan sebelum submit

- **Rotasi** semua key yang pernah tercetak di log/chat atau ikut zip env yang dibagikan: wallet drip/keeper (buat
  wallet baru, isi MON testnet, ganti env), token Envio, key Nansen/CoinGecko, token bot Telegram, key bot Perpl.
- Jangan commit `.env.local`; bagikan env lewat Vercel (undang anggota tim → `vercel env pull`) atau password manager.
- Kontrak belum diaudit — sudah tertulis di landing & SUBMISSION; jangan dorong user memakai uang besar di mainnet.
