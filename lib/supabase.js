import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── 인증 (익명 로그인) ─────────────────────────────────────────
export const signInAnon = () => supabase.auth.signInAnonymously()
export const signOut    = () => supabase.auth.signOut()

// ── 프로필 ─────────────────────────────────────────────────────
export const fetchProfile = (userId) =>
  supabase.from('profiles').select('*').eq('id', userId).single()

export const saveProfile = (userId, data) =>
  supabase.from('profiles').update(data).eq('id', userId)

// ── 오이코스 CRUD ──────────────────────────────────────────────
export const fetchOikos = (userId) =>
  supabase.from('oikos').select('*').eq('user_id', userId).order('created_at')

export const createOikos = (data) =>
  supabase.from('oikos').insert(data).select().single()

export const updateOikos = (id, data) =>
  supabase.from('oikos').update(data).eq('id', id).select().single()

export const deleteOikos = (id) =>
  supabase.from('oikos').delete().eq('id', id)

// ── 기도 기록 ──────────────────────────────────────────────────
export const logPrayer = (userId, oikosId) =>
  supabase.from('prayer_logs').upsert(
    { user_id: userId, oikos_id: oikosId, prayed_at: today() },
    { onConflict: 'user_id,oikos_id,prayed_at' }
  )

export const fetchPrayerLogs = (userId, days = 60) => {
  const since = new Date()
  since.setDate(since.getDate() - days)
  return supabase.from('prayer_logs')
    .select('oikos_id, prayed_at').eq('user_id', userId)
    .gte('prayed_at', since.toISOString().split('T')[0])
    .order('prayed_at', { ascending: false })
}

export const calcStreak = (logs, oikosId) => {
  const dates = logs.filter(l => l.oikos_id === oikosId)
    .map(l => l.prayed_at).sort((a,b) => b.localeCompare(a))
  let s = 0
  for (let i = 0; i < dates.length; i++) {
    const e = new Date(); e.setDate(e.getDate() - i)
    if (dates[i] === e.toISOString().split('T')[0]) s++
    else break
  }
  return s
}

export const calcTotalStreak = (logs) => {
  const days = [...new Set(logs.map(l => l.prayed_at))].sort((a,b) => b.localeCompare(a))
  let s = 0
  for (let i = 0; i < days.length; i++) {
    const e = new Date(); e.setDate(e.getDate() - i)
    if (days[i] === e.toISOString().split('T')[0]) s++
    else break
  }
  return s
}

export const prayedToday = (logs, oikosId) =>
  logs.some(l => l.oikos_id === oikosId && l.prayed_at === today())

// ── 액션 기록 ──────────────────────────────────────────────────
export const logAction = (userId, oikosId, actionType, note = '') =>
  supabase.from('action_logs')
    .insert({ user_id: userId, oikos_id: oikosId, action_type: actionType, note })

// ── 교역자 대시보드 ────────────────────────────────────────────
export const fetchChurchOverview = (churchId) =>
  supabase.from('church_overview').select('*').eq('church_id', churchId)

// ── 푸시 알림 ──────────────────────────────────────────────────
export const savePushSub = (userId, sub) =>
  supabase.from('profiles').update({ push_subscription: sub }).eq('id', userId)

// ── 실시간 ─────────────────────────────────────────────────────
export const subscribeOikos = (userId, cb) =>
  supabase.channel('oikos').on('postgres_changes',
    { event:'*', schema:'public', table:'oikos', filter:`user_id=eq.${userId}` }, cb
  ).subscribe()

const today = () => new Date().toISOString().split('T')[0]
