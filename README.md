# Ruang TKA Bahasa Indonesia – Pemahaman Tekstual

Website latihan mandiri TKA Bahasa Indonesia Kelas VI berdasarkan empat subkompetensi pada kisi-kisi yang diberikan:

1. Mengidentifikasi kosakata umum dan khusus dalam berbagai bidang.
2. Mengidentifikasi objek berdasarkan kosakata dalam teks fiksi atau nonfiksi.
3. Menyusun kembali informasi dari teks dalam bentuk ikhtisar/bagan.
4. Mengidentifikasi informasi tersurat dalam teks.

## Isi aplikasi

- **Empat modul materi belajar mandiri** yang lengkap dan mengikuti kisi-kisi: (1) kosakata umum dan khusus, (2) identifikasi objek dalam teks fiksi/nonfiksi, (3) ikhtisar dan bagan, serta (4) informasi tersurat.
- Setiap modul memuat tujuan belajar, penjelasan konsep, tabel/klasifikasi, contoh bacaan, langkah berpikir secara bertahap, contoh soal dengan pembahasan, pertanyaan refleksi, dan tiga cek pemahaman interaktif (PG, MCMA, dan kategori).
- Murid dapat menandai modul selesai; progres belajar dan hasil cek pemahaman tersimpan pada browser/perangkat yang digunakan.

- 60 bank soal orisinal: 15 soal per subkompetensi.
- Komposisi bentuk soal: 20 pilihan ganda sederhana, 20 MCMA, dan 20 pilihan ganda kompleks kategori.
- Setiap sesi memilih tepat 30 soal secara acak. Sebaran per subkompetensi dijaga menjadi 7–8 soal.
- Urutan soal dan urutan pilihan jawaban ikut diacak.
- Timer 45 menit, navigasi nomor soal, tanda untuk ditinjau, dan indikator progres.
- Kolom bukti teks untuk melatih murid menemukan dasar jawaban.
- Refleksi strategi dan kesulitan belajar.
- Skor otomatis, analisis per subkompetensi, serta pembahasan untuk setiap soal.
- Dasbor guru: ringkasan kelas, riwayat murid, detail jawaban, bukti teks, refleksi, unduh CSV/JSON, dan cetak/PDF.
- Tampilan responsif untuk laptop, tablet, dan ponsel.

## Cara mencoba langsung (mode lokal)

1. Ekstrak ZIP. Pastikan `materials.js` berada dalam folder yang sama dengan `index.html`, `app.js`, dan `questions.js`. Jalankan server lokal dari folder ini:

   ```bash
   python -m http.server 8000
   ```

2. Buka `http://localhost:8000`.
3. Dari beranda pilih **Pelajari materi**. Buka Modul 1–4 untuk membaca materi, contoh pembahasan, langkah menjawab, refleksi, dan cek pemahaman interaktif.
4. Setelah belajar, murid dapat memilih **Ruang Murid** untuk mengerjakan 30 soal acak.
5. Untuk mencoba dasbor guru pada mode lokal, gunakan:
   - Nama pengguna: `guru`
   - Kata sandi: `GuruTKA61!`

**Batasan mode lokal:** hasil hanya tersimpan di localStorage pada browser/perangkat yang sama. Data dari ponsel murid tidak otomatis masuk ke laptop guru. Mode ini untuk uji coba antarmuka dan alur pengerjaan.

## Mengaktifkan sinkronisasi daring ant perangkat dengan Supabase

Agar murid mengerjakan dari perangkat masing-masing dan guru melihat hasilnya dari akun guru, hubungkan aplikasi ke proyek Supabase. Supabase menyediakan autentikasi dan database daring; website ini tetap dapat di-host sebagai website statis.

1. Buat proyek baru di Supabase.
2. Buka **SQL Editor** pada proyek tersebut.
3. Salin seluruh isi `supabase-schema.sql`, jalankan satu kali, dan pastikan tidak ada error.
4. Ambil **Project URL** dan **anon/public key** dari pengaturan API proyek Supabase. Jangan menggunakan `service_role` key.
5. Buka `config.js` lalu isi:

   ```js
   window.APP_CONFIG = {
     supabaseUrl: "https://PROJECT-ANDA.supabase.co",
     supabaseAnonKey: "ANON_PUBLIC_KEY_ANDA"
   };
   ```

6. Publikasikan website (contohnya melalui GitHub Pages).
7. Buka website, pilih **Ruang Guru**, lalu pilih **Daftar guru**. Buat akun dengan email dan kata sandi guru. Jika Supabase meminta konfirmasi email, buka email tersebut lalu masuk kembali.
8. Setelah masuk, buat kode guru/kelas (minimal 6 karakter). Bagikan kode ini kepada murid.
9. Murid membuka website, mengisi nama dan kelas, memasukkan kode guru, lalu mengerjakan 30 soal. Setelah dikirim, hasil masuk ke akun guru yang memiliki kode tersebut.

### GitHub Pages (hosting website)

1. Buat repository GitHub baru.
2. Unggah file `index.html`, `styles.css`, `app.js`, `questions.js`, **`materials.js`**, dan `config.js` ke folder utama repository.
3. Buka **Settings → Pages** pada repository.
4. Pada bagian build/deployment, pilih **Deploy from a branch**, pilih branch utama (misalnya `main`) dan folder `/ (root)`, lalu simpan.
5. Setelah proses publikasi selesai, GitHub Pages memberikan alamat website. Bagikan alamat tersebut kepada murid.

GitHub Pages hanya menjadi tempat menyajikan file website statis. Data login guru dan hasil murid lintas perangkat disimpan oleh Supabase, bukan oleh GitHub Pages.

## Catatan penting sebelum dipakai satu sekolah

- Gunakan akun email guru yang dikelola sekolah.
- Bagikan kode guru hanya kepada kelas yang dituju. Jika kode diketahui pihak lain, mereka dapat mengirimkan hasil ke ruang guru tersebut.
- Data yang dikumpulkan dibatasi pada nama murid, kelas, hasil, jawaban, bukti teks, dan refleksi. Jangan menambahkan alamat rumah, nomor telepon, tanggal lahir, atau data pribadi yang tidak diperlukan.
- Mode lokal dan mode daring menggunakan penyimpanan yang berbeda. Hasil yang dibuat saat mode lokal tidak otomatis dipindahkan ke Supabase.
- Aplikasi ini adalah paket website siap diuji dan dipublikasikan. Proyek Supabase dan repository GitHub harus dibuat menggunakan akun milik sekolah/guru karena memerlukan persetujuan dan kredensial pribadi.

## Struktur file

- `index.html` – halaman utama.
- `styles.css` – desain responsif.
- `app.js` – alur murid, penilaian, dasbor guru, ekspor data, dan koneksi backend.
- `questions.js` – 60 bank soal beserta jawaban dan pembahasan.
- `materials.js` – empat modul materi lengkap dan cek pemahaman interaktif.
- `config.js` – konfigurasi koneksi Supabase (kosong pada paket awal).
- `supabase-schema.sql` – skema database, autentikasi, kebijakan akses, dan fungsi pengiriman hasil.

## Catatan progres modul materi

Tanda modul selesai dan status cek pemahaman disimpan pada `localStorage` browser yang dipakai murid. Penyimpanan ini bersifat per perangkat/browser dan belum disinkronkan ke dasbor guru Supabase. Hasil sesi latihan 30 soal tetap menggunakan alur penyimpanan lokal atau Supabase sesuai konfigurasi aplikasi.
