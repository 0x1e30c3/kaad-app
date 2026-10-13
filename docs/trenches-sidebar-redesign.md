# Redesign Trenches, sidebar, dan Trending

Mulai: 11 Oktober 2026. Selesai implementasi dan verifikasi akhir: **13 Oktober 2026**.

Status: **Implementasi selesai; pemeriksaan offline akhir lulus.** Batas pemeriksaan browser dijelaskan di bawah.

## Hasil implementasi

- Navigasi aplikasi berpindah ke sidebar: label lengkap pada desktop lebar, ikon dengan accessible name pada tablet, drawer native dengan focus trap dan Escape pada mobile.
- Logo Kadd di sidebar, header mobile, dan drawer menuju landing page `/`.
- Trenches menjadi grid token ringkas: identitas, market cap/FDV, perubahan harga 24h, volume 24h, likuiditas, risiko, watchlist, dan Buy dengan satuan tUSDC.
- Grid mengikuti lebar konten dengan minimum card 248 px. Target pada 1440 px adalah empat card sejajar; mobile sempit memakai satu kolom agar angka dan aksi tetap terbaca.
- Kategori Hot, New pairs, dan Top volume menggunakan data yang tersedia. Filter keyword berlaku pada token yang sudah dimuat dalam kategori; pencarian global tetap tersedia di header.
- Filter risiko, sorting, dan pengaturan Quick Buy disembunyikan dalam disclosure. Onboarding dimulai dalam keadaan ringkas dan tetap dapat dibuka.
- Trending menggunakan board tiga kolom dari Trenches sebelumnya: New pairs, Hot 1h, Top volume. Breakpoint berdasarkan lebar konten melalui container query, bukan hanya viewport; ketika ruang kurang, kategori memakai tombol pilihan.
- Watchlist tetap dapat dipakai di kedua halaman. Trending mengganti tampilan tabel sebelumnya; kontrol periode/sort tabel lama tidak menjadi bagian board baru. Masing-masing kolom memiliki periode yang tertulis.
- Auto-update dapat dimatikan. Saat pointer atau fokus keyboard berada di daftar token, polling berikutnya dijeda untuk mengurangi pergeseran target klik. Permintaan refresh yang sudah berjalan tidak dibatalkan.

## Pertimbangan audit UI/UX

Acuan: [audit UI/UX](ui-ux-audit-dex.md) dan [implementasi P1](p1-ui-ux-implementation.md).

| Temuan | Penerapan |
| --- | --- |
| L01/L02/U01 | Sidebar mengurangi persaingan ruang header; semua menu tersedia. Board memperhitungkan ruang yang diambil sidebar. |
| L03 | Nama/simbol pada card dipotong secara visual dengan nama lengkap melalui title dan accessible link name. |
| L05 | Offset CTA mobile pada halaman token ikut memperhitungkan sidebar tablet. Safe area navigasi tetap dipertahankan. |
| L06 | Onboarding tidak terbuka otomatis; saat dibuka, kolom langkah tidak dipaksakan menjadi lima pada tablet. |
| V03/V04 | Card fokus pada identitas dan beberapa metrik. Tidak ada statistik hero tambahan atau card dekoratif bertumpuk. |
| V05/V06 | Token warna P1 dipertahankan; navigasi dan aksi utama mobile memiliki target sentuh sekitar 44 px. |
| U02 | Loading, error, empty, stale, timestamp, dan Retry tetap berbeda. Trending sekarang memakai snapshot status, menggantikan `orEmpty`/label LIVE statis pada route tersebut. |
| U03/U04 | Practice, sumber harga mainnet, nominal tUSDC, review default, dan preferensi one-click tetap eksplisit. |
| U08 | Drawer memakai dialog native. Pilihan kategori memakai tombol dengan `aria-pressed`; filter memakai input/select berlabel. |

## Referensi

[Pump.fun Explore](https://pump.fun/explore) ditinjau untuk struktur navigasi dan discovery berbasis kategori. Halaman publik menampilkan navigasi, pencarian, serta kategori seperti Movers, New, dan Market cap. Layout Kadd merupakan adaptasi atas permintaan pengguna; bukan salinan pixel-perfect atau klaim telah memeriksa seluruh UI Pump.fun setelah login. Tidak menambahkan data atau kemampuan transaksi yang tidak didukung Kadd.

## Verifikasi

### Pemeriksaan akhir pada kode proyek

Dijalankan dari `kadd/`:

| Pemeriksaan | Hasil |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit` | Lulus. |
| `npm run lint` | Lulus untuk seluruh aplikasi. |
| `node --import tsx scripts/check-discovery.tsx` | Lulus: render Trenches dan Trending untuk data terisi, kosong, gagal, stale; label risiko/practice/review; delapan tujuan navigasi; tiga logo mengarah ke `/`. |
| `node --import tsx src/lib/market-status.check.ts` | Lulus: fallback, partial failure, recovery, empty, dan cache lama. |
| `node --import tsx src/lib/market.check.ts` | Lulus: regresi gap chart. |
| `git diff --check` dari root | Lulus. |

`check-discovery.tsx` menggunakan render React di server dengan router context dan fixture lokal. Tes tersebut tidak menjalankan event browser atau transaksi, sehingga tidak dianggap sebagai E2E interaksi.

### Browser yang sudah dijalankan

Chromium headless pada salinan sementara di `/tmp`, menggunakan 24 token fixture termasuk nama/simbol panjang. Sumber komponen berasal dari proyek; data provider diganti fixture, font Google memakai fallback sistem, dan request eksternal browser diblokir. Fixture tidak dimasukkan ke aplikasi produksi.

| Viewport | Trenches | Trending | Overflow horizontal dokumen/konten |
| --- | --- | --- | --- |
| 360 × 900 | 24 card dirender | 1 kolom terlihat | Tidak ditemukan |
| 390 × 900 | 24 card dirender | 1 kolom terlihat | Tidak ditemukan |
| 768 × 900 | 24 card dirender | 1 kolom terlihat | Tidak ditemukan |
| 1024 × 900 | 24 card dirender | 1 kolom terlihat | Tidak ditemukan |
| 1440 × 900 | 24 card, 4 sejajar | 3 kolom terlihat | Tidak ditemukan |

Screenshot desktop dan mobile ditinjau. Hasil mobile menunjukkan terlalu banyak ruang di atas card pertama, sehingga dilakukan revisi lanjutan: mengurangi teks/link hero di mobile, merapatkan kategori dan Watchlist, serta meringkas timestamp. Peninjauan kode juga menemukan risiko posisi popover Quick Buy keluar viewport; popover sekarang bertumpu pada grup kontrol. Filter dan pengaturan Quick Buy dapat ditutup dengan Escape.

**Batas bukti:** matriks browser di atas berasal dari versi sebelum revisi mobile/popover terakhir. Pengulangan browser dan rangkaian uji interaksi akhir tidak selesai karena sesi terputus pada persetujuan proses browser. Sesuai permintaan melanjutkan tanpa klik persetujuan, verifikasi akhir memakai TypeScript, lint, render React, dan tes data offline. Tidak mengklaim uji klik/watchlist/dialog, mode dark, zoom, atau viewport akhir sudah lulus browser.

Tidak menjalankan production build, transaksi, deployment, commit, atau push. Data pasar nyata tetap berasal dari provider yang sudah digunakan proyek; pengujian fixture tidak membuktikan ketersediaan provider.

## File utama

- `kadd/src/components/Header.tsx`: sidebar, header, navigasi mobile, drawer, dan shortcut.
- `kadd/src/components/Trenches.tsx`: grid discovery dan kontrol ringkas.
- `kadd/src/components/TrendingBoard.tsx`: board tiga kategori.
- `kadd/src/components/MarketStatus.tsx`: status, timestamp, dan Retry bersama.
- `kadd/src/components/AutoRefresh.tsx`: dukungan jeda polling.
- `kadd/src/components/Onboarding.tsx`: keadaan ringkas dan breakpoint checklist.
- `kadd/src/app/globals.css`: ukuran sidebar, grid, dan container query.
- Layout aplikasi, route Trenches/Trending, loading Trending, dan posisi CTA halaman token.
- `kadd/scripts/check-discovery.tsx`: regresi render offline.

