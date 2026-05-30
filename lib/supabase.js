import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession:    true,   // localStorage에 세션 유지
      autoRefreshToken:  true,   // 자동 갱신
      detectSessionInUrl: false,
    },
  }
)

// ── 핵심: 교구+이름+코드 → 항상 같은 계정 ─────────────────────
// 브라우저 저장소가 지워져도 같은 정보로 입력하면 같은 계정 복구
const deriveCredentials = async (churchGroup, displayName, code) => {
  const raw = `${churchGroup}|${displayName}|${code}|oikos_hanam`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,28)
  return {
    email:    `u${hash}@oikos.kr`,
    password: `Oikos_${code}_2025_Hanam!`,
  }
}

// 최초 등록 또는 재로그인 — 항상 같은 계정 반환
export const signInOrRegister = async (churchGroup, displayName, code) => {
  const { email, password } = await deriveCredentials(churchGroup, displayName, code)

  // 1. 기존 계정 로그인 시도
  const { data: signIn } = await supabase.auth.signInWithPassword({ email, password })
  if (signIn?.session) return { session: signIn.session, isNew: false }

  // 2. 없으면 새 계정 생성 (이메일 확인 OFF 필요)
  const { data: signUp, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error }
  if (!signUp?.session) return { error: new Error('이메일 확인을 비활성화해주세요 (Supabase → Auth → Settings)') }
  return { session: signUp.session, isNew: true }
}

export const signOut = () => supabase.auth.signOut()

// ── 프로필 ─────────────────────────────────────────────────────
export const fetchProfile = (userId) =>
  supabase.from('profiles').select('*').eq('id', userId).single()

export const saveProfile = (userId, data) =>
  supabase.from('profiles').upsert({ id: userId, ...data })

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

// ── 실시간 ─────────────────────────────────────────────────────
export const subscribeOikos = (userId, cb) =>
  supabase.channel('oikos').on('postgres_changes',
    { event:'*', schema:'public', table:'oikos', filter:`user_id=eq.${userId}` }, cb
  ).subscribe()

// ── 푸시 알림 ──────────────────────────────────────────────────
export const savePushSub = (userId, sub) =>
  supabase.from('profiles').update({ push_subscription: sub }).eq('id', userId)

const today = () => new Date().toISOString().split('T')[0]
