# 📖 PANDUAN LENGKAP APLIKASI KASIR PRO POS (100% OFFLINE)

Selamat! Aplikasi kasir desktop Anda telah selesai dibuat dan siap digunakan **100% Offline** tanpa memerlukan koneksi internet sama sekali.

---

## 🚀 1. Cara Membuka / Menjalankan Aplikasi
Anda dapat membuka aplikasi kasir ini dengan sangat mudah:
1. Buka folder `C:\aplikasi kasir`.
2. Klik 2x file **`Buka_Aplikasi_Kasir.bat`**.
3. Jendela aplikasi kasir desktop akan terbuka secara otomatis!

*(Bisa juga melalui terminal dengan menjalankan perintah `npm start` di folder ini).*

---

## 🎨 2. Mengedit Desain Struk & Menambahkan Logo Toko
Aplikasi ini dilengkapi dengan **Editor Struk Live (WYSIWYG)**:
1. Buka tab **"Desain Struk"** pada menu atas aplikasi.
2. **Upload Logo**:
   - Klik tombol **"Upload Logo Baru"**.
   - Pilih file gambar logo toko Anda (PNG / JPG / WebP).
   - Gunakan slider **Lebar Logo** untuk menyesuaikan ukuran logo di struk.
3. **Info Toko**:
   - Masukkan **Nama Toko / Bisnis**, **Slogan**, **Alamat**, dan **No. Telepon / WhatsApp**.
4. **Ukuran Kertas**:
   - Pilih **58 mm** (untuk printer thermal mini portabel / Bluetooth).
   - Pilih **80 mm** (untuk printer thermal kasir standar meja).
5. **Kustomisasi Lainnya**:
   - Pilihan jenis huruf: **Monospace** (klasik kasir) atau **Sans-Serif** (modern).
   - Karakter garis pemisah (`-`, `=`, `*`, `.`).
   - Tampilkan/sembunyikan: Tanggal, Nama Kasir, Nama Pelanggan, Barcode Struk, dan Pajak PPN.
   - Pesan Bawah (Footer): Ubah pesan ucapan terima kasih atau syarat retur barang.
6. Lihat hasil perubahan secara langsung di panel **Live Preview** sebelah kanan.
7. Klik tombol **"Simpan Perubahan"**.

---

## 🖨️ 3. Menghubungkan Mesin Cetak Struk (USB & Bluetooth)
Aplikasi kasir ini mendukung **3 Metode Sambungan Printer**:

### A. Menggunakan Kabel USB (Direkomendasikan)
1. Colokkan kabel USB printer thermal Anda ke port USB komputer/laptop.
2. Pasang (install) driver bawaan printer (biasanya bernama `POS-58`, `POS-80`, `Xprinter`, `Epson`, `Panda`, dll.).
3. Buka tab **"Printer (USB/Bluetooth)"** di aplikasi kasir.
4. Pilih mode **"Driver Windows (Spooler)"**.
5. Pilih nama printer Anda pada menu dropdown.
6. Klik tombol **"Tes Cetak Thermal Sekarang"**. Mesin printer akan mencetak struk percobaan!

### B. Menggunakan Bluetooth (Nirkabel / Tanpa Kabel)
1. Nyalakan mesin printer Bluetooth thermal Anda.
2. Di Windows, buka **Settings > Bluetooth & devices > Add device > Bluetooth**.
3. Pilih perangkat printer Anda (contoh: `MTP-2`, `RPP02`, `POS-58`, `Goojprt`).
4. Masukkan kode PIN pairing: biasanya **`0000`** atau **`1234`**.
5. Setelah terpasang:
   - Jika printer muncul sebagai driver di Windows, pilih di tab **"Printer (USB/Bluetooth)"**.
   - Atau Anda bisa menggunakan mode **"Direct Bluetooth"** langsung dari aplikasi.
6. Klik **"Tes Cetak Thermal Sekarang"** untuk memastikan koneksi berjalan lancar!

### C. Menggunakan Port Serial COM (Virtual COM USB)
1. Untuk printer USB yang terdeteksi sebagai port COM (CH340/PL2303).
2. Pilih mode **"Kabel USB Virtual COM"**, atur Baud Rate (standar 9600 bps).

---

## 🛒 4. Cara Menggunakan Menu Kasir (POS)
1. **Mencari Produk**:
   - Ketik nama produk di kolom pencarian.
   - **Barcode Scanner**: Arahkan scanner barcode fisik Anda ke barcode produk, barang akan otomatis masuk ke keranjang!
2. **Kategori**:
   - Klik tab kategori (*Minuman, Makanan, Snack, Sembako, Alat Tulis*) untuk memfilter produk.
3. **Mengatur Jumlah Barang**:
   - Gunakan tombol `+` dan `-` di keranjang.
4. **Tahan Transaksi (Hold Order - Tombol F7)**:
   - Jika pembeli ingin mengambil barang tambahan, klik **"Tahan (F7)"** untuk menyimpan sementara keranjangnya.
   - Anda dapat melayani pelanggan berikutnya, lalu memanggil kembali transaksi yang ditahan kapan saja.
5. **Pembayaran (Checkout - Tombol F9)**:
   - Klik tombol **"Bayar (F9)"**.
   - Pilih metode bayar: **Tunai**, **QRIS**, **Transfer**, **Debit**, atau **Kasbon**.
   - Untuk pembayaran tunai, klik tombol nominal cepat (*Uang Pas, 20rb, 50rb, 100rb, dll.*) atau ketik jumlah uang yang diterima.
   - Nilai kembalian akan otomatis dihitung secara akurat.
   - Klik **"Bayar & Cetak Struk"** untuk mencetak struk thermal secara otomatis!

---

## 📦 5. Manajemen Produk & Stok Barang
1. Buka tab **"Produk & Stok"**.
2. Klik **"Tambah Produk Baru"**.
3. Masukkan Nama Produk, Barcode (atau klik *"Buat Barcode Acak"* jika belum ada barcode), Kategori, Harga Modal (Beli), Harga Jual (Kasir), dan Stok Awal.
4. Keuntungan/Margin laba akan otomatis terhitung.
5. Anda juga dapat mengekspor daftar produk ke file **CSV / Excel**.

---

## 📊 6. Laporan Penjualan & Cetak Ulang Struk
1. Buka tab **"Laporan Penjualan"**.
2. Lihat ringkasan:
   - **Total Omzet Penjualan**
   - **Estimasi Laba Kotor (Profit)**
   - **Total Transaksi Selesai**
   - **5 Produk Terlaris Periode Ini**
3. Filter berdasarkan waktu: *Hari Ini, 7 Hari Terakhir, Bulan Ini, atau Semua Waktu*.
4. **Cetak Ulang (Re-Print)**: Klik ikon printer pada baris transaksi untuk mencetak ulang struk lama jika pelanggan meminta salinan struk.
5. Klik **"Export Laporan (CSV)"** untuk membuka laporan di Microsoft Excel.

---

## 💾 7. Cadangkan Data (Backup & Restore)
Seluruh data Anda tersimpan **100% lokal** di komputer Anda:
1. Buka menu **"Printer (USB/Bluetooth)"**.
2. Pada panel kanan, klik **"Download Backup Database (.json)"**.
3. Simpan file backup tersebut ke Flashdisk atau drive penyimpanan aman.
4. Jika ingin memindahkan aplikasi ke komputer baru, cukup klik **"Restore / Pulihkan dari File Backup"**.

---

## 🌐 8. Mode Web Browser (Testing di Browser & HP / Tablet)

Aplikasi kasir ini dapat diuji coba secara langsung melalui web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari) baik di komputer, laptop, maupun smartphone/tablet:

### A. Cara Menjalankan Mode Web (1-Klik)
1. Buka folder `C:\aplikasi kasir`.
2. Klik 2x file **`Buka_Aplikasi_Kasir_Browser.bat`**.
3. Browser default Anda akan otomatis terbuka ke:
   ```
   http://localhost:5173
   ```
4. Aplikasi kasir akan langsung aktif dengan database lokal (IndexedDB) yang sama lengkapnya.

### B. Menguji Coba dari HP / Tablet (Satu Jaringan Wi-Fi)
Saat Anda menjalankan file batch di atas, terminal akan menampilkan alamat IP jaringan lokal (*Network*), misalnya:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.15:5173/
```
1. Sambungkan HP atau Tablet Anda ke Wi-Fi yang sama dengan komputer.
2. Buka browser di HP (Chrome / Safari).
3. Ketikkan alamat `http://192.168.x.x:5173` sesuai alamat Network di terminal.
4. Anda dapat mencoba transaksi kasir langsung dari layar sentuh HP atau Tablet Anda!

### C. Mode Layar Penuh (Kiosk POS)
Di pojok kanan atas navbar pada mode web, terdapat tombol **"Layar Penuh (F11)"**. Klik tombol ini untuk menghilangkan bilah tab browser dan mengubah tampilan menjadi mesin kasir POS layar penuh.

### D. Mode Produksi Web (Preview Build)
Untuk menguji coba performa versi build produksi yang telah dikompresi:
- Klik 2x file **`Buka_Aplikasi_Kasir_Web_Build.bat`** (berjalan di port `4173`).

