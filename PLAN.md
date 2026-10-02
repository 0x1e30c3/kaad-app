# PLAN — Kadd

> Social trading terminal di Monad · Track **Onchain Finance & Trading** · diperbarui 2026-10-02

## Ringkasan

Terminal trading ala gmgn untuk **trader yang trading bareng teman**. Pembeda utama dari gmgn (yang sudah support Monad):
- **KaddClub**: patungan dana grup onchain di Kuru — primitive baru "investment club" yang tanpa oracle, member selalu bisa keluar.
- Login passkey (Mera), tanpa seed phrase.
- UI sosial: grup, feed teman, leaderboard, label risiko token yang mudah dipahami.

## Status

| Bagian | Status |
|---|---|
| UI (Trenches, Trending, token, Grup, Leaderboard, Portfolio), light/dark, mobile, PWA, bahasa Inggris | Selesai |
| Data token asli (Monad mainnet): GeckoTerminal untuk list/chart/trades/info, DexScreener untuk search & harga | Selesai (trade di terminal masih saldo demo) |
| Landing page (GSAP + Lenis, terminal interaktif di hero, light/dark) | Selesai |
| Alamat kontrak di env (`.env.local` app, `.env` contracts) | Selesai |
| Login passkey Mera (PRF → BIP-39/32 → signing session) | Real, belum diuji manual dengan passkey |
| KaddClub + Factory (Foundry) | 27 unit test + 4 fork test vs Kuru asli lulus |
| Factory di Monad testnet | v2 `0xcF7e…b647` (verified, dipakai app). v1 `0x54b1…ad27` usang |
| Halaman Club (buat, setor, tarik, klaim, trade captain) | Terhubung ke kontrak; diuji di fork lokal |
| Trading Kuru asli | **Terhambat**: order book testnet kosong, USDC testnet hanya bisa di-mint admin Kuru |

## Berikutnya

Keputusan: **data token = Monad mainnet (read-only, GeckoTerminal)**; trading & Clubs tetap di **testnet**.

| # | Fase | Isi | Butuh user? |
|---|---|---|---|
| 1 ✅ | Data token asli | Trenches (pool baru), Trending, halaman token (chart OHLCV, trades, info + skor GT, honeypot), Search & harga live lewat DexScreener. Field yang tidak ada (top holder, sniper, insider) tampil "—", tidak dikarang. | Tidak |
| 2 ✅ | Bahasa | Seluruh app ke bahasa Inggris, konsisten dengan landing. | Tidak |
| 3 | Repo + deploy | `git init`, commit, push ke GitHub, deploy Vercel (HTTPS tetap untuk passkey), set env. | Ya: akun GitHub & Vercel |
| 4 | Uji passkey | Buat akun, reload → buka, perangkat lain, di domain Vercel. | Ya: HP/laptop |
| 5 | Grup bersama | Backend (DB lewat Vercel Marketplace) supaya grup, kode undangan & feed teman benar-benar dibagi. | Ya: pilih/approve DB |
| 6 | Connect wallet cadangan | Wallet injected (MetaMask/Rabby) di samping passkey. | Tidak |
| 7 | Trading asli | Setelah Kuru kirim USDC/liquidity testnet: TradePanel → Kuru, Clubs end-to-end. | Ya: kontak Kuru |
| 8 | Copy-trade | Tahap 1: izin TRADE terbatas di subaccount Kuru. | Tidak |
| 9 | Submission | Video demo ≤3 mnt, pitch ≤2 mnt, uji ke 10–20 teman. | Ya |

## Target bounty

| Bounty | Kaitan |
|---|---|
| Track Onchain Finance & Trading ($10k) | KaddClub + terminal |
| Kuru Consumer App ($5k) / New Markets ($5k) | Trading lewat order book Kuru |
| Mera Best UX ($2.5k) | Akun passkey penuh, stateless |
| Mera One Passkey Many Keys ($2.5k) | Key Ed25519 Perpl dari PRF (rencana) |
| Perpl API ($5k) | Perps / copy-trade (rencana) |
| Envio ($1k) | Indexer event club & token (rencana) |

## Referensi

- Detail track & bounty: `TRACKS.md` · pemenang hackathon serupa: `WINNERS.md`
- App: `kadd/README.md` · Kontrak: `contracts/README.md`
