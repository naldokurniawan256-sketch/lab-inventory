-- Jalankan seluruh file ini di Supabase > SQL Editor
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null, full_name text,
  role text not null check (role in ('admin','staff')), active boolean not null default true);
create table items (
  id bigint generated always as identity primary key,
  kode text unique not null, nama text not null, kategori text,
  stok int not null default 0 check (stok >= 0));
create table borrowings (
  id bigint generated always as identity primary key,
  item_id bigint not null references items on delete restrict,
  peminjam text not null, jumlah int not null check (jumlah > 0),
  tgl_pinjam date not null, tgl_kembali date,
  status text not null default 'Dipinjam' check (status in ('Dipinjam','Selesai')),
  created_by uuid references profiles(id));

create function is_admin() returns boolean language sql security definer stable as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and active) $$;
create function is_active() returns boolean language sql security definer stable as
$$ select exists(select 1 from profiles where id = auth.uid() and active) $$;

alter table profiles enable row level security;
alter table items enable row level security;
alter table borrowings enable row level security;
create policy p_read on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy p_admin on profiles for all to authenticated using (is_admin()) with check (is_admin());
create policy i_read on items for select to authenticated using (is_active());
create policy i_admin on items for all to authenticated using (is_admin()) with check (is_admin());
create policy b_read on borrowings for select to authenticated using (is_admin() or created_by = auth.uid());

-- Stok diubah lewat fungsi ini supaya Staff tidak perlu hak edit barang
create function borrow_item(p_item bigint, p_name text, p_qty int, p_date date) returns void
language plpgsql security definer as $$
begin
  if not is_active() then raise exception 'Akun nonaktif'; end if;
  update items set stok = stok - p_qty where id = p_item and stok >= p_qty;
  if not found then raise exception 'Stok tidak cukup'; end if;
  insert into borrowings(item_id, peminjam, jumlah, tgl_pinjam, created_by) values (p_item, p_name, p_qty, p_date, auth.uid());
end $$;
create function return_item(p_id bigint) returns void
language plpgsql security definer as $$
declare v_item bigint; v_qty int;
begin
  if not is_active() then raise exception 'Akun nonaktif'; end if;
  update borrowings set status = 'Selesai', tgl_kembali = current_date
    where id = p_id and status = 'Dipinjam' and (is_admin() or created_by = auth.uid())
    returning item_id, jumlah into v_item, v_qty;
  if not found then raise exception 'Transaksi tidak ditemukan atau sudah selesai'; end if;
  update items set stok = stok + v_qty where id = v_item;
end $$;

insert into items (kode, nama, kategori, stok) values
('BR001','Laptop Lenovo','Komputer',5),('BR002','Mouse Logitech','Periferal',10),
('BR003','Keyboard Mechanical','Periferal',8),('BR004','Proyektor Epson','Presentasi',3),
('BR005','Monitor LG','Display',6),('BR006','Kabel HDMI','Kabel',12),('BR007','Router TP-Link','Jaringan',4),
('BR008','Switch 24 Port','Jaringan',2),('BR009','Webcam Logitech','Periferal',6),('BR010','Headset','Audio',9);
