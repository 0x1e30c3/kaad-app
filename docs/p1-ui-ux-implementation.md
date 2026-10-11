# Laporan implementasi P1 UI/UX Kadd

Tanggal: **11 Oktober 2026**  
Acuan: [Audit UI/UX DEX](ui-ux-audit-dex.md).  
Status: **Implementasi kode untuk 12 temuan P1 selesai; pemeriksaan statis dan tes data lulus. Validasi visual browser masih diperlukan.**

## Perubahan per temuan

| ID | Implementasi | File utama |
| --- | --- | --- |
| L01 | Tiga kolom Trenches baru aktif pada `xl` (1280 px). Viewport di bawahnya memakai tab kategori. Baris token memberi ruang tersendiri untuk metrik dan Buy agar label transaksi terbaca. | `Trenches.tsx` |
| L02 | Header desktop menampilkan Trenches, Perps, Trending; semua tujuan tersedia lewat More. Lebar search mengikuti breakpoint. | `Header.tsx`, `Search.tsx` |
| L03 | Identitas token dibatasi lebar kontainer, nama/simbol dapat membungkus, dan nama lengkap tersedia lewat atribut title. Label CTA panjang dipotong secara visual. | `token/[address]/page.tsx` |
| L04 | Input nominal deposit Perps mengambil satu baris penuh; Deposit/Open account dan Withdraw ada pada baris berikutnya dengan wrap. | `PerpsTrade.tsx` |
| L05 | Tinggi navigasi bawah menggunakan variabel CSS termasuk safe area. Padding konten, posisi Trade, dan toast mengacu ke tinggi yang sama. Toast ditempatkan di atas ruang Trade, dibatasi lebar viewport, dan mengikuti tinggi isi. | `globals.css`, layout aplikasi, halaman token, `Header.tsx`, `Overlays.tsx` |
| V05 | Warna faint diperbaiki untuk tema light/dark dan landing. Fill Buy/Sell dipisahkan dari warna status; label putih memakai fill lebih gelap. Penerapan mencakup form spot, Perps, strategi, Clubs, onboarding, quick start, dan terminal landing. | `globals.css` dan komponen terkait |
| U01 | More di mobile menyediakan seluruh delapan tujuan, termasuk Trending, Stats, AI Agents, dan Leaderboard. Menu memakai disclosure native, link dengan status halaman aktif, serta penutupan Escape/keluar fokus. | `Header.tsx` |
| U02 | Trenches tidak memakai `orEmpty`. Setiap kategori membawa status gagal/stale dan waktu respons terakhir. Ada loading awal, refreshing manual, daftar kosong, error, stale, Refresh/Retry. Label LIVE statis pada Trenches/header dihapus. | `market.ts`, `Trenches.tsx`, halaman/loading Trenches |
| U03 | Mode Practice/Real funds diperjelas pada panel spot dan Perps. Saldo testnet diberi konteks Practice; badge akun tetap terlihat di mobile. Konteks sumber harga mainnet dan eksekusi testnet ditulis eksplisit. | `Account.tsx`, `TradePanel.tsx`, `PerpsTrade.tsx`, `QuickBuy.tsx` |
| U04 | Label Quick Buy menjadi `Buy <nominal> tUSDC`. Default membuka dialog review dengan Cancel dan konfirmasi eksplisit. Token berisiko menampilkan alasan umum dari klasifikasi daftar. One-click hanya untuk kategori low risk dan harus diaktifkan pengguna. | `QuickBuy.tsx`, `Trenches.tsx`, `quickBuyPreference.ts` |
| U05 | Angka besar diberi label `Market cap / FDV` karena sumber lama menggunakan FDV saat market cap kosong. Perubahan harga diberi periode 24h; harga token tetap ditampilkan terpisah. | `token/[address]/page.tsx` |
| U06 | Widget leaderboard landing berlabel Demo langsung pada heading. Section Groups berlabel Demo dan memiliki penjelasan sebelum daftar. | `landing/Widgets.tsx`, halaman Groups |

Path komponen pada tabel relatif terhadap `kadd/src/components`; halaman relatif terhadap `kadd/src/app/(app)`; library relatif terhadap `kadd/src/lib`.

## Perilaku data pasar

- Fetch gagal tanpa cache: tampilkan **Data unavailable** dan **Retry**, bukan empty state.
- Fetch berhasil dengan nol token: tampilkan empty state normal.
- Provider gagal tetapi ada respons terakhir: pertahankan data dan tampilkan **Stale** beserta waktu respons tersebut.
- Respons HTTP berumur lebih dari 90 detik: tandai stale.
- Daftar dua halaman dengan salah satu halaman memakai fallback: seluruh kategori ditandai stale. Jika halaman gagal belum memiliki fallback, kategori menampilkan error.
- Fetch kembali berhasil: status stale/error dibersihkan sesuai hasil baru.
- Waktu pembaruan memakai tanggal respons HTTP, atau waktu penerimaan jika tanggal respons tidak tersedia. Ini bukan timestamp transaksi blockchain.
- Refresh otomatis tetap mencoba setiap 30 detik saat tab terlihat. Refresh/Retry memakai router refresh dan masih mengikuti cache/revalidation Next.js.

Fallback tetap berada di memori instance server. Status ini diterapkan pada **Trenches**; halaman lain yang memakai `orEmpty` belum dimigrasikan dalam tahap ini.

## Perilaku Quick Buy

Preferensi one-click disimpan di `sessionStorage` untuk sesi tab dan disinkronkan dengan checkbox. Default nonaktif; kegagalan akses storage tetap mengharuskan review. Token caution/high risk tetap membutuhkan konfirmasi walaupun one-click aktif.

Dialog menyimpan token dan nominal yang direview sehingga pembaruan props tidak mengubah order yang sedang dikonfirmasi. Submit ganda dicegah selama permintaan berjalan; tombol dinonaktifkan untuk nominal nol, negatif, atau non-finite. Pesan error tersedia jika promise transaksi melempar error. Tidak ada transaksi yang dikirim dalam proses verifikasi ini.

## Verifikasi yang dijalankan

Semua perintah berikut dijalankan dari `kadd/`, kecuali pemeriksaan diff.

| Pemeriksaan | Hasil |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit` | Lulus. |
| `npm run lint` | Lulus untuk seluruh aplikasi. |
| `node --import tsx src/lib/market-status.check.ts` | Lulus: gagal tanpa cache, data terisi, fallback stale, empty valid, deduplikasi, kegagalan parsial, recovery, dan tanggal cache lama. Fetch dimock; tidak bergantung provider eksternal. |
| `node --import tsx src/lib/market.check.ts` | Lulus: regresi pengisian gap chart. |
| `git diff --check` | Lulus. |
| Perhitungan luminansi warna solid | Pasangan di bawah mencapai minimal 4,5:1. |

| Pasangan teks / latar | Rasio |
| --- | ---: |
| Faint light `#626b77` / panel `#ffffff` | 5,40:1 |
| Faint light `#626b77` / hover `#eaedf0` | 4,60:1 |
| Faint dark `#9aa1ab` / hover `#1b1f24` | 6,36:1 |
| Landing light `#686870` / hover `#ebebed` | 4,64:1 |
| Landing dark `#a0a0aa` / hover `#222226` | 6,12:1 |
| Putih / Buy `#087443` | 5,85:1 |
| Putih / Sell `#b62038` | 6,46:1 |

Rasio tersebut hanya membuktikan pasangan warna solid yang dihitung; bukan audit aksesibilitas penuh, screenshot, atau pengukuran elemen transparan/disabled.

## Batas verifikasi dan penerimaan visual

Belum menjalankan production build, browser interaktif, screenshot lintas viewport, ataupun transaksi testnet/mainnet. Browser automation tidak tersedia dalam sesi ini. Implementasi layout tidak dinyatakan telah lolos pengujian visual.

Checklist penerimaan lanjutan:

- Viewport 360, 390, 768, 1024, dan 1440 px: cek overflow, nama token panjang, dan nominal besar.
- Tema light/dark: cek keterbacaan, fokus, menu More, dan dialog Quick Buy.
- Perangkat dengan safe area serta keyboard mobile terbuka: cek nav, Trade, toast, dan input Perps.
- Keyboard/zoom 200%: cek akses seluruh navigasi dan siklus fokus dialog.
- Browser dengan respons provider dimock: cek loading/error/stale/empty dan pemulihan melalui Retry.
- Testnet terkontrol: cek review/cancel, one-click low risk, konfirmasi high risk, dan feedback transaksi.

Tidak ada deployment atau commit yang dibuat. Item P2/P3 tetap menjadi backlog audit.
