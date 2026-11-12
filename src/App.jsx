import { useEffect, useState, useCallback } from 'react'
import { supabase, tempClient, toEmail } from './supabase'

const today = () => new Date().toISOString().slice(0, 10)

export default function App() {
  const [me, setMe] = useState(null)
  const [ready, setReady] = useState(false)
  const [page, setPage] = useState('dashboard')

  const loadMe = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMe(null); setReady(true); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (!data || !data.active) { await supabase.auth.signOut(); setMe(null) } else setMe(data)
    setReady(true)
  }, [])

  useEffect(() => { loadMe() }, [loadMe])
  if (!ready) return <p style={{ padding: 20 }}>Memuat…</p>
  if (!me) return <Login onDone={loadMe} />

  const admin = me.role === 'admin'
  const tabs = [['dashboard', 'Dashboard'], ['items', 'Barang'], ['tx', 'Transaksi'], ...(admin ? [['staff', 'Pengguna']] : [])]
  return (
    <>
      <header>
        <b>Inventaris Lab</b>
        <nav>{tabs.map(([k, l]) => <button key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}>{l}</button>)}</nav>
        <span>{me.full_name || me.username} ({me.role})</span>
        <button className="b gray" onClick={async () => { await supabase.auth.signOut(); setMe(null) }}>Keluar</button>
      </header>
      <main>
        {page === 'dashboard' && <Dashboard />}
        {page === 'items' && <Items admin={admin} />}
        {page === 'tx' && <Transactions me={me} admin={admin} />}
        {page === 'staff' && admin && <Staff />}
      </main>
    </>
  )
}

function Login({ onDone }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(u), password: p })
    if (error) return setErr('Username atau password salah.')
    await onDone()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) setErr('Akun nonaktif. Hubungi Admin.')
  }
  return (
    <form className="card login" onSubmit={submit}>
      <h2>Masuk</h2>
      <input placeholder="Username" value={u} onChange={e => setU(e.target.value)} required />
      <input type="password" placeholder="Password" value={p} onChange={e => setP(e.target.value)} required />
      {err && <p className="err">{err}</p>}
      <button className="b">Masuk</button>
    </form>
  )
}

function Dashboard() {
  const [s, setS] = useState(null), [recent, setRecent] = useState([])
  useEffect(() => { (async () => {
    const { data: items } = await supabase.from('items').select('stok')
    const { data: tx } = await supabase.from('borrowings').select('*, items(nama)').order('id', { ascending: false })
    const avail = (items || []).reduce((a, i) => a + i.stok, 0)
    const out = (tx || []).filter(t => t.status === 'Dipinjam').reduce((a, t) => a + t.jumlah, 0)
    setS({ total: avail + out, avail, out, count: (tx || []).length })
    setRecent((tx || []).slice(0, 5))
  })() }, [])
  if (!s) return <p>Memuat…</p>
  return (
    <>
      <div className="stats">
        <div><strong>{s.total}</strong>Total barang</div><div><strong>{s.avail}</strong>Tersedia</div>
        <div><strong>{s.out}</strong>Sedang dipinjam</div><div><strong>{s.count}</strong>Total transaksi</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Aktivitas terbaru</h3>
        {recent.length === 0 ? <p>Belum ada transaksi. Catat peminjaman pertama di menu Transaksi.</p> :
          <table><tbody>{recent.map(t => <tr key={t.id}><td>{t.tgl_pinjam}</td><td>{t.peminjam}</td><td>{t.items?.nama} ×{t.jumlah}</td><td><span className="tag">{t.status}</span></td></tr>)}</tbody></table>}
      </div>
    </>
  )
}

function Items({ admin }) {
  const [rows, setRows] = useState([]), [q, setQ] = useState(''), [f, setF] = useState(null), [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('items').select('*').order('kode'); setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])
  const save = async (e) => {
    e.preventDefault(); setErr('')
    const { id, ...v } = f; v.stok = Number(v.stok)
    const { error } = id ? await supabase.from('items').update(v).eq('id', id) : await supabase.from('items').insert(v)
    if (error) return setErr(error.message)
    setF(null); load()
  }
  const del = async (i) => {
    if (!confirm(`Hapus ${i.nama}?`)) return
    const { error } = await supabase.from('items').delete().eq('id', i.id)
    if (error) alert('Tidak bisa dihapus: barang sudah punya riwayat peminjaman.'); else load()
  }
  const shown = rows.filter(r => `${r.kode} ${r.nama} ${r.kategori}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="card">
      <div className="row">
        <input placeholder="Cari kode, nama, kategori" value={q} onChange={e => setQ(e.target.value)} />
        {admin && <button className="b" onClick={() => setF({ kode: '', nama: '', kategori: '', stok: 0 })}>Tambah barang</button>}
      </div>
      {f && <form className="row" onSubmit={save}>
        <input placeholder="Kode" value={f.kode} onChange={e => setF({ ...f, kode: e.target.value })} required />
        <input placeholder="Nama" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} required />
        <input placeholder="Kategori" value={f.kategori || ''} onChange={e => setF({ ...f, kategori: e.target.value })} />
        <input type="number" min="0" value={f.stok} onChange={e => setF({ ...f, stok: e.target.value })} required />
        <button className="b">Simpan</button><button type="button" className="b gray" onClick={() => setF(null)}>Batal</button>
        {err && <span className="err">{err}</span>}
      </form>}
      <table>
        <thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th><th>Stok</th><th>Status</th>{admin && <th></th>}</tr></thead>
        <tbody>{shown.map(i => <tr key={i.id}><td>{i.kode}</td><td>{i.nama}</td><td>{i.kategori}</td><td>{i.stok}</td>
          <td><span className="tag">{i.stok > 0 ? 'Tersedia' : 'Habis'}</span></td>
          {admin && <td><button className="b gray" onClick={() => setF(i)}>Edit</button> <button className="b red" onClick={() => del(i)}>Hapus</button></td>}</tr>)}</tbody>
      </table>
    </div>
  )
}

function Transactions({ me, admin }) {
  const [items, setItems] = useState([]), [tx, setTx] = useState([]), [err, setErr] = useState('')
  const [f, setF] = useState({ peminjam: '', item: '', qty: 1, tgl: today() })
  const load = useCallback(async () => {
    const { data: it } = await supabase.from('items').select('*').order('kode'); setItems(it || [])
    let qy = supabase.from('borrowings').select('*, items(kode,nama), profiles(username)').order('id', { ascending: false })
    if (!admin) qy = qy.eq('created_by', me.id) // Staff hanya melihat transaksi yang ia catat
    const { data } = await qy; setTx(data || [])
  }, [admin, me.id])
  useEffect(() => { load() }, [load])
  const borrow = async (e) => {
    e.preventDefault(); setErr('')
    const { error } = await supabase.rpc('borrow_item', { p_item: Number(f.item), p_name: f.peminjam, p_qty: Number(f.qty), p_date: f.tgl })
    if (error) return setErr(error.message)
    setF({ ...f, peminjam: '', qty: 1 }); load()
  }
  const giveBack = async (id) => {
    const { error } = await supabase.rpc('return_item', { p_id: id })
    if (error) alert(error.message); else load()
  }
  return (
    <>
      <form className="card row" onSubmit={borrow}>
        <input placeholder="Nama peminjam" value={f.peminjam} onChange={e => setF({ ...f, peminjam: e.target.value })} required />
        <select value={f.item} onChange={e => setF({ ...f, item: e.target.value })} required>
          <option value="">Pilih barang</option>
          {items.filter(i => i.stok > 0).map(i => <option key={i.id} value={i.id}>{i.kode} – {i.nama} (stok {i.stok})</option>)}
        </select>
        <input type="number" min="1" style={{ width: 80 }} value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} required />
        <input type="date" value={f.tgl} onChange={e => setF({ ...f, tgl: e.target.value })} required />
        <button className="b">Simpan peminjaman</button>
        {err && <span className="err">{err}</span>}
      </form>
      <div className="card">
        <h3>Riwayat peminjaman dan pengembalian</h3>
        <table>
          <thead><tr><th>Tgl pinjam</th><th>Peminjam</th><th>Barang</th><th>Jml</th><th>Kembali</th><th>Status</th><th></th></tr></thead>
          <tbody>{tx.map(t => <tr key={t.id}><td>{t.tgl_pinjam}</td><td>{t.peminjam}</td><td>{t.items?.nama}</td><td>{t.jumlah}</td>
            <td>{t.tgl_kembali || '-'}</td><td><span className="tag">{t.status}</span></td>
            <td>{t.status === 'Dipinjam' && <button className="b" onClick={() => giveBack(t.id)}>Kembalikan</button>}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

function Staff() {
  const [rows, setRows] = useState([]), [f, setF] = useState({ username: '', full_name: '', password: '' }), [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('role').order('username'); setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])
  const add = async (e) => {
    e.preventDefault(); setMsg('')
    const t = tempClient()
    const { data, error } = await t.auth.signUp({ email: toEmail(f.username), password: f.password })
    if (error) return setMsg(error.message)
    const { error: e2 } = await supabase.from('profiles').insert({ id: data.user.id, username: f.username.trim().toLowerCase(), full_name: f.full_name, role: 'staff' })
    if (e2) return setMsg(e2.message)
    setF({ username: '', full_name: '', password: '' }); setMsg('Akun Staff dibuat.'); load()
  }
  const toggle = async (u) => { await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id); load() }
  const rename = async (u) => {
    const n = prompt('Nama lengkap baru', u.full_name || ''); if (n === null) return
    await supabase.from('profiles').update({ full_name: n }).eq('id', u.id); load()
  }
  return (
    <>
      <form className="card row" onSubmit={add}>
        <input placeholder="Username" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} required />
        <input placeholder="Nama lengkap" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} required />
        <input type="password" minLength="6" placeholder="Password (min 6)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required />
        <button className="b">Tambah Staff</button><span className={msg.includes('dibuat') ? '' : 'err'}>{msg}</span>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map(u => <tr key={u.id}><td>{u.username}</td><td>{u.full_name}</td><td>{u.role}</td>
            <td><span className="tag">{u.active ? 'Aktif' : 'Nonaktif'}</span></td>
            <td>{u.role === 'staff' && <><button className="b gray" onClick={() => rename(u)}>Edit</button> <button className="b" onClick={() => toggle(u)}>{u.active ? 'Nonaktifkan' : 'Aktifkan'}</button></>}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}
