# Laboratory Inventory & Borrowing Management System
React + Vite + Supabase, hosting di Vercel.

## 1. Supabase
1. Buat project di supabase.com. Authentication > Providers > Email: **matikan "Confirm email"**.
2. SQL Editor: jalankan isi `schema.sql`.
3. Authentication > Users > Add user: email `admin@lab.local`, password pilihanmu, centang Auto Confirm. Salin UUID-nya, lalu jalankan:
   `insert into profiles (id, username, full_name, role) values ('UUID-ADMIN','admin','Administrator','admin');`
4. Buat akun Staff demo lewat aplikasi (login Admin > menu Pengguna).
5. Project Settings > API: salin Project URL dan anon key.

## 2. Jalankan lokal
`cp .env.example .env` (isi URL dan key), lalu `npm install && npm run dev`.

## 3. Deploy
Push ke GitHub, import di vercel.com, isi Environment Variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`, Deploy.

Login memakai username (di balik layar menjadi `username@lab.local`).
