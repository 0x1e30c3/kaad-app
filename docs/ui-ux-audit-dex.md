# Audit UI/UX Kadd — Acuan Terminal DEX

Tanggal: **10 Oktober 2026**  
Status: **Laporan dan rekomendasi; belum ada perubahan aplikasi.**

**Arah perbaikan:** terminal trading yang padat tetapi terbaca, stabil saat data berubah, jelas membedakan latihan dan dana nyata, serta cepat dipakai untuk mencari token, memeriksa risiko, dan mengirim order.

## 1. Ruang lingkup dan batas audit

Audit mencakup landing page, navigasi, Trenches, detail token, form trading, Perps, leaderboard, Groups, onboarding, pencarian, dan notifikasi.

Temuan berasal dari pembacaan source code dan perhitungan warna CSS. Referensi eksternal ditinjau melalui halaman publik dan dokumentasi resmi. **Belum dilakukan pengujian visual interaktif, screenshot lintas viewport, atau transaksi.** Halaman Hyperliquid menggunakan rendering client sehingga layout aplikasinya tidak dapat diverifikasi melalui ekstraksi halaman; acuan alurnya menggunakan dokumentasi resmi.

Nama **“Astro DEX” belum terkonfirmasi**. Astroport digunakan sebagai referensi sementara, bukan dianggap pasti sebagai produk yang dimaksud. Astroport, AstroSwap, dan Aster adalah produk berbeda.

| Label bukti | Makna |
| --- | --- |
| **Kode** | Perilaku atau struktur ditemukan langsung dalam implementasi. |
| **Risiko** | Struktur mengindikasikan masalah; reproduksi di browser masih diperlukan. |
| **Heuristik** | Penilaian desain berdasarkan kejelasan tugas dan hierarki informasi. |

| Prioritas | Kriteria |
| --- | --- |
| **P1 — Utama** | Mengganggu akses, pembacaan, atau pemahaman tindakan transaksi. |
| **P2 — Berikutnya** | Memperlambat penggunaan, menambah beban baca, atau mengurangi konsistensi. |
| **P3 — Polesan** | Penyederhanaan dekorasi dan gerakan setelah masalah penggunaan selesai. |

## 2. Acuan UI/UX DEX

Kolom “Penerapan untuk Kadd” merupakan rekomendasi audit, bukan klaim bahwa semua referensi memakai rancangan identik.

| Referensi | Yang dapat diverifikasi | Penerapan untuk Kadd |
| --- | --- | --- |
| **[Pump.fun Explore](https://pump.fun/explore)** | Pencarian coin/user serta kategori seperti Movers, New, Market cap, dan Last trade. | Fokuskan discovery pada identitas token, metrik pembanding, filter, dan akses detail. |
| **[Pump Terminal](https://terminal.pump.fun/)** | Halaman publik mengarah ke sign-in; terminal penuh belum ditinjau. | Referensi konteks produk trading cepat; tidak dijadikan bukti ukuran card atau layout setelah login. |
| **[Hyperliquid — Order types](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/order-types)** | Dokumentasi membedakan market, limit, trigger order, dan opsi eksekusi. | Buat jenis order mudah dikenali; tampilkan opsi lanjutan sesuai kebutuhan. |
| **[Hyperliquid — TP/SL](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/take-profit-and-stop-loss-orders-tp-sl)** | Dokumentasi menghubungkan TP/SL dengan chart, form order, dan tabel posisi. | Hubungkan input order, konteks chart, dan pengelolaan posisi dalam alur yang konsisten. |
| **[Astroport — Swap](https://docs.astroport.fi/docs/learn/workstation/traders-port/swap)** | Pemilihan token, nominal, estimasi hasil, slippage, konfirmasi, dan expert mode; chart dapat dibuka sebagai split view. | Tampilkan ringkasan transaksi sebelum eksekusi; one-click menjadi pilihan sadar. Acuan sementara untuk “Astro DEX”. |
| **[DEX Screener](https://dexscreener.com/)** | Watchlist, New Pairs, periode, filter, serta kolom harga, volume, likuiditas, dan market cap. | Gunakan baris data sejajar untuk membandingkan token; tampilkan periode dan satuan secara eksplisit. |

**Pembagian peran:** discovery mengambil acuan Pump.fun dan DEX Screener; order/posisi mengambil acuan dokumentasi Hyperliquid; form swap sederhana mengambil acuan Astroport. Pola tampilan Kadd tetap harus mengikuti data dan kemampuan eksekusi yang benar-benar tersedia.

## 3. Ringkasan keputusan desain

| Elemen | Keputusan yang disarankan | Alasan |
| --- | --- | --- |
| Card token | Pertahankan jika ringkas dan mudah dipindai. | Identitas token tetap penting dalam discovery. |
| Card statistik terpisah | Gabungkan menjadi strip metrik. | Perbandingan angka lebih cepat dan ruang lebih efisien. |
| Card di dalam card | Kurangi lapisan permukaan dan border. | Hierarki lebih mudah dibaca. |
| Dot pada heading | Hapus. | Tidak membawa informasi. |
| Dot status | Pertahankan dengan label dan status aktual. | Membantu membaca koneksi atau pembaruan data. |
| Shadow/hover | Gunakan untuk elemen yang memang interaktif. | Menghindari kesan bahwa angka statis dapat diklik. |
| Glow, glass, magnetic CTA | Kurangi; CTA tetap diam saat dituju. | Fokus pengguna berada pada informasi dan tindakan. |
| Warna hijau/merah | Gunakan konsisten untuk arah transaksi dan perubahan nilai. | Makna warna tidak bercampur dengan dekorasi. |
| Kepadatan terminal | Padat pada desktop; prioritaskan konten pada mobile. | Mengecilkan semua teks bukan solusi responsif. |

## 4. Tabel temuan dan perbaikan

Setiap tabel dibatasi empat kolom agar nyaman dibaca. ID menghubungkan temuan dengan source code pada bagian 5.

### A. Layout dan responsivitas

| ID / prioritas | Temuan | Dampak | Perbaikan |
| --- | --- | --- | --- |
| **L01 · P1** | **Kode:** Trenches memakai 3 kolom minimum 340 px sejak `md`. Total dengan gap dan padding sekitar 1.068 px. | Konten melampaui area tersedia pada viewport 768–1024 px. | Pertahankan tab sampai tiga kolom muat; tentukan breakpoint dari kebutuhan konten. |
| **L02 · P1** | **Risiko:** 8 menu, search, tema, dan akun berbagi satu baris header. | Header sesak pada laptop kecil, terutama saat label menu muncul. | Pindahkan menu sekunder ke More; buat search fleksibel. |
| **L03 · P1** | **Risiko:** Nama/simbol token panjang belum dibatasi pada header detail. | Identitas token mendorong kontrol ke luar area. | Batasi lebar, izinkan wrap atau truncate, dan sediakan nama lengkap saat dibutuhkan. |
| **L04 · P1** | **Risiko:** Input, Deposit, dan Withdraw Perps berada dalam satu baris tanpa wrap. | Form berdesakan pada ponsel kecil. | Input satu baris penuh; tindakan berada pada baris berikutnya. |
| **L05 · P1** | **Risiko:** Trade fixed pada 68 px; toast pada 80 px; bottom nav menambahkan safe area. | Toast dan tindakan dapat bertumpuk atau tertutup. | Atur seluruh elemen bawah dari tinggi navigasi dan safe area yang sama. |
| **L06 · P2** | **Kode + heuristik:** Onboarding menjadi 5 kolom sejak 640 px. | Kalimat terbungkus sempit; checklist menghabiskan ruang discovery. | Tampilkan langkah aktif, progres ringkas, dan rincian yang dapat dibuka. |
| **L07 · P2** | **Risiko:** Header Panel tinggi tetap dan kontainernya memotong overflow. | Judul atau tindakan panjang dapat terpotong. | Header boleh bertambah tinggi; tindakan turun baris saat ruang habis. |

### B. Visual, card, dan keterbacaan

| ID / prioritas | Temuan | Dampak | Perbaikan |
| --- | --- | --- | --- |
| **V01 · P2** | **Heuristik:** Landing menggabungkan space image, glass, glow, bento, dan shadow besar. | Identitas terminal trading kalah oleh dekorasi generik. | Utamakan preview alur produk; pilih satu bahasa visual utama. |
| **V02 · P3** | **Kode + heuristik:** Dot dipakai pada heading dan indikator status. | Elemen dekoratif menyerupai penanda informasi. | Hapus dot heading; gunakan dot status dengan label. |
| **V03 · P2** | **Kode + heuristik:** Card statistik memakai hover border/shadow meskipun tidak interaktif. | Affordance keliru; statistik terasa seperti tombol. | Gunakan strip metrik; hover hanya pada elemen dengan aksi. |
| **V04 · P2** | **Heuristik:** Card Groups berisi PnL besar, badge, chart, avatar, aktivitas, dan beberapa aksi. | Sulit menentukan informasi utama dan membandingkan grup. | Tampilkan identitas, satu metrik utama, konteks singkat, dan satu aksi utama. |
| **V05 · P1** | **Kode + perhitungan:** Teks faint dan teks putih pada tombol hijau memiliki kontras rendah. | Metadata dan tombol sulit dibaca, terutama dalam ukuran kecil. | Perbaiki token warna per tema; pisahkan warna status dari warna tombol. |
| **V06 · P2** | **Kode + heuristik:** Beberapa tombol filter, timeframe, dan preset setinggi 24–28 px. | Target sentuh kecil pada mobile. | Target praktis mobile sekitar 44 px; desktop dapat lebih rapat dengan hit area memadai. |
| **V07 · P3** | **Kode + heuristik:** Magnetic CTA, parallax, spotlight, dan scroll inertia berjalan pada landing. | Gerakan berlebih; target tombol kurang stabil. | Hapus magnetic CTA; prioritaskan transisi yang menunjukkan perubahan keadaan. |

### C. Alur trading, status, dan navigasi

| ID / prioritas | Temuan | Dampak | Perbaikan |
| --- | --- | --- | --- |
| **U01 · P1** | **Kode:** Trending, Stats, dan AI Agents tidak tersedia pada navigasi utama mobile. | Fitur sulit ditemukan kembali. | Tambahkan More atau navigasi lengkap yang selalu dapat diakses. |
| **U02 · P1** | **Kode:** LIVE tidak mengikuti keberhasilan fetch; `orEmpty` mengubah kegagalan menjadi daftar kosong. | Gangguan layanan terlihat sebagai tidak adanya token. | Bedakan loading, empty, error, dan stale; tampilkan last updated serta Retry. |
| **U03 · P1** | **Kode + heuristik:** Harga mainnet, perdagangan testnet, dan opsi live berada berdekatan; label akun testnet tersembunyi pada layar kecil. | Pengguna dapat salah memahami sumber harga dan konteks saldo. | Mode Practice/Real funds persisten dekat saldo dan submit; bedakan jaringan data dan eksekusi. |
| **U04 · P1** | **Kode:** Quick Buy menampilkan petir + nominal; konfirmasi risiko hanya “Sure?” selama 4 detik. | Aksi, satuan, dan alasan risiko tidak cukup jelas tanpa tooltip. | Label “Buy 10 tUSDC”; konfirmasi risiko eksplisit; one-click sebagai preferensi pengguna. |
| **U05 · P1** | **Kode:** Angka terbesar pada detail token adalah market cap tanpa label berdampingan. | Angka dapat disangka harga token. | Label “Market cap”; harga dan periodenya tetap terlihat. |
| **U06 · P1** | **Kode + heuristik:** Leaderboard mini menggunakan angka statis; keterangan demo Groups berada setelah daftar. | Data contoh mudah disangka performa aktual. | Label Demo langsung pada widget/section; sumber dan periode untuk data aktual. |
| **U07 · P2** | **Kode:** Toast hilang setelah 2,8 detik, tinggi tetap 40 px, dan belum dibatasi sesuai viewport. | Pesan panjang sulit dibaca; error mudah terlewat. | Toast mengikuti isi; error penting persisten dekat form dengan Retry. |
| **U08 · P2** | **Kode:** Search belum memiliki relasi combobox/listbox; tabs belum lengkap hubungan panel dan keyboard panah. | Navigasi keyboard dan pembacaan screen reader kurang jelas. | Lengkapi semantik, fokus, hubungan panel, dan interaksi keyboard. |

### Detail pengukuran warna V05

Rasio berikut dihitung dari pasangan warna solid di CSS, bukan pengukuran screenshot. Transparansi dan latar aktual dapat mengubah hasil. Target internal yang disarankan untuk teks kecil adalah minimal 4,5:1; ini bukan pernyataan audit kepatuhan aksesibilitas penuh.

| Pemakaian | Teks / latar | Rasio |
| --- | --- | ---: |
| Faint pada panel light | `#8b929c` / `#ffffff` | 3,14:1 |
| Faint pada panel dark | `#6a717b` / `#101215` | 3,81:1 |
| Faint pada landing light | `#a1a1a8` / `#ffffff` | 2,57:1 |
| Teks putih pada Buy dark | `#ffffff` / `#2ccf7f` | 2,03:1 |
| Teks putih pada Buy light | `#ffffff` / `#0c9a57` | 3,64:1 |

## 5. Peta bukti source code

Tautan relatif dapat dibuka dari repository. Cari komponen atau pola yang disebutkan; nomor baris dapat berubah setelah implementasi.

| ID | Sumber | Bukti yang diperiksa |
| --- | --- | --- |
| L01 | [Trenches](../kadd/src/components/Trenches.tsx) | `md:min-w-[340px]`, tiga kolom, gap, padding. |
| L02, U01 | [Header](../kadd/src/components/Header.tsx), [Search](../kadd/src/components/Search.tsx) | NAV, MOBILE, breakpoint label, lebar search. |
| L03, L05, U05 | [Token page](../kadd/src/app/%28app%29/token/%5Baddress%5D/page.tsx) | Header token, `t.mc`, tombol fixed, sidebar trade. |
| L04 | [PerpsTrade](../kadd/src/components/PerpsTrade.tsx) | Baris input nominal, Deposit, Withdraw. |
| L05, U07 | [Overlays](../kadd/src/components/Overlays.tsx), [store](../kadd/src/lib/store.ts) | Posisi toast, `h-10`, durasi 2800 ms. |
| L06 | [Onboarding](../kadd/src/components/Onboarding.tsx) | `sm:grid-cols-5`, langkah dan progres. |
| L07, V03 | [UI primitives](../kadd/src/components/ui.tsx), [PerpsBoard](../kadd/src/components/PerpsBoard.tsx) | Header Panel, overflow, card hover, statistik. |
| V01, V02 | [Landing](../kadd/src/app/page.tsx), [CSS](../kadd/src/app/globals.css) | Space image, glass, glow, dot heading. |
| V04, U06 | [Groups page](../kadd/src/app/%28app%29/groups/page.tsx), [Widgets](../kadd/src/components/landing/Widgets.tsx) | GroupCard, catatan demo, angka LeaderboardMini. |
| V05 | [CSS](../kadd/src/app/globals.css), [TradePanel](../kadd/src/components/TradePanel.tsx) | Token faint/up dan tombol `text-white bg-up`. |
| V06 | [Trenches](../kadd/src/components/Trenches.tsx), [TokenChart](../kadd/src/components/TokenChart.tsx) | Quick Buy, filter, `h-6`, `h-7`. |
| V07 | [Fx](../kadd/src/components/landing/Fx.tsx), [SmoothScroll](../kadd/src/components/landing/SmoothScroll.tsx) | Magnetic, parallax, spotlight, Lenis. |
| U02 | [Trenches page](../kadd/src/app/%28app%29/trenches/page.tsx), [market](../kadd/src/lib/market.ts), [AutoRefresh](../kadd/src/components/AutoRefresh.tsx) | `orEmpty`, refresh berkala, label LIVE pada Trenches. |
| U03 | [TradePanel](../kadd/src/components/TradePanel.tsx), [Account](../kadd/src/components/Account.tsx) | Network tabs, catatan testnet, label akun `hidden xl:flex`. |
| U04 | [QuickBuy](../kadd/src/components/QuickBuy.tsx) | Label nominal, tooltip, “Sure?”, timeout konfirmasi. |
| U08 | [Search](../kadd/src/components/Search.tsx), [TokenTabs](../kadd/src/components/TokenTabs.tsx), [Overlays](../kadd/src/components/Overlays.tsx) | Keyboard search, role tabs, penamaan login dialog. |

## 6. Rancangan arah per halaman

Ini usulan struktur untuk tahap desain, belum berupa perubahan aplikasi.

| Halaman | Hierarki yang disarankan | Acuan |
| --- | --- | --- |
| Trenches | Search/filter → kategori token → baris token ringkas → quick action yang jelas. | Pump.fun + DEX Screener. |
| Trending | Periode/filter → tabel angka sejajar → akses detail/watchlist. | DEX Screener. |
| Detail token | Identitas dan metrik berlabel → chart → form order → riwayat/risiko. | Discovery DEX + alur swap Astroport. |
| Perps | Market → chart dan konteks posisi → form order → posisi/order aktif. | Alur Hyperliquid yang terdokumentasi. |
| Leaderboard | Sumber/periode → tabel pembanding → profil dan konteks risiko trader. | Prinsip pemindaian tabel DEX. |
| Groups | Identitas → status demo/aktual → metrik ringkas → detail/join. | Adaptasi social trading Kadd. |
| Landing | Manfaat utama → preview produk → alur penggunaan → CTA. | Menjelaskan tugas sebelum dekorasi. |

Pada desktop, panel chart dan form order dapat berdampingan bila ruang cukup. Pada mobile, gunakan perpindahan jelas antara Chart, Trade, dan Activity, atau form trade yang dibuka dari CTA. Pilihan akhir perlu diuji terhadap tugas pengguna.

Jangan menambahkan order book, depth chart, atau jenis order hanya demi menyerupai referensi bila venue/data Kadd tidak mendukungnya. Hindari pula mengubah semua halaman menjadi tabel: card identitas tetap berguna untuk discovery dan grup.

## 7. Urutan perbaikan dan kriteria selesai

| Tahap | Fokus | Kriteria selesai |
| --- | --- | --- |
| **1** | Layout, overflow, dan lapisan mobile. | Tidak ada scroll horizontal seluruh halaman; toast, nav, dan CTA tidak bertumpuk. |
| **2** | Mode transaksi, label metrik, status data. | Practice/Real funds, satuan, sumber, dan status pembaruan dapat dipahami tanpa tooltip. |
| **3** | Kontras, target sentuh, navigasi. | Kontrol utama terbaca pada kedua tema; semua menu dapat dijangkau di mobile dan keyboard. |
| **4** | Card dan kepadatan informasi. | Data pembanding sejajar; hover menandai aksi nyata; detail sekunder dapat dibuka. |
| **5** | Landing dan animasi. | Preview produk menjadi fokus; CTA stabil; dekorasi tidak menyaingi konten. |

## 8. Matriks verifikasi lanjutan

Seluruh pemeriksaan berikut **belum dijalankan di browser**. Ini daftar penerimaan untuk tahap implementasi mendatang.

| Skenario | Yang harus diperiksa |
| --- | --- |
| Viewport 360 / 390 px | Header, panjang nama token, input nominal, label tombol, dan safe area. |
| Viewport 768 / 1024 px | Trenches tidak memaksakan tiga kolom; navigasi dan search tetap muat. |
| Viewport 1440 px | Kepadatan informasi proporsional; ruang kosong tidak diisi card tanpa fungsi. |
| Light / dark | Teks, placeholder, status, tombol Buy/Sell, dan fokus tetap jelas. |
| Nama panjang / nominal besar | Tidak mendorong layout; satuan dan angka tetap dapat dibaca. |
| Loading / empty / error / stale | Pesan dan tindakan berbeda; kegagalan tidak ditampilkan sebagai data kosong. |
| Order pending / sukses / gagal | Feedback dekat form; retry tidak membingungkan status transaksi sebelumnya. |
| Keyboard / zoom 200% | Fokus terlihat; menu, tabs, dialog, dan hasil search dapat digunakan. |
| Mobile keyboard terbuka | Input dan submit dapat dijangkau; CTA fixed tidak menutupi form. |
| Refresh data | Posisi scroll dan target quick action tidak berubah secara mengejutkan; perlu pengujian. |

**Hasil audit ini adalah backlog desain.** Validasi visual dan pengujian alur diperlukan sebelum temuan berlabel Risiko dinyatakan sebagai bug yang sudah direproduksi.
