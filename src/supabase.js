import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(url, key)
// Client terpisah (tanpa simpan sesi) untuk membuat akun Staff tanpa logout Admin
export const tempClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
export const toEmail = (u) => `${u.trim().toLowerCase()}@lab.local`
