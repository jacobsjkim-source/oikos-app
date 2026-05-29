'use client'
import { createClient } from '@supabase/supabase-js'

// ── 클라이언트 ──────────────────────────────────────────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ══════════════════════════════════════════════════════════════
// 인증 (Auth)
// ══════════════════════════════════════════════════════════════

export const signInWithKakao = () =>
  supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ══════════════════════════════════════════════════════════════
// 프로필 (Profile)
// ══════════════════════════════════════════════════════════════

export const fetchProfile = (userId) =>
  supabase.from('profiles').select('*').eq('id', userId).single()

export const updateProfile = (userId, data) =>
  supabase.from('profiles').update(data).eq('id', userId)

export const joinChurch = async (userId, inviteCode) => {
  const { data: church, error } = await supabase
    .from('churches').select('id').eq('invite_code', inviteCode).single()
  if (error) return { error: '올바른 초대 코드가 아닙니다.' }
  return supabase.from('profiles').update({ church_id: church.id }).eq('id', userId)
}

export const createChurch = async (userId, churchName) => {
  const { data: church, error } = await supabase
    .from('churches').insert({ name: churchName }).select().single()
  if (error) return { error }
  await supabase.from('profiles')
    .update({ church_id: church.id, role: 'pastor' }).eq('id', userId)
  return { data: church }
}

// ══════════════════════════════════════════════════════════════
// 오이코스 (Oikos CRUD)
// ══════════════════════════════════════════════════════════════

export const fetchOikos = (userId) =>
  supabase.from('oikos').select('*').eq('user_id', userId).order('created_at')

export const createOikos = (data) =>
  supabase.from('oikos').insert(data).select().single()

export const updateOikos = (id, data) =>
  supabase.from('oikos').update(data).eq('id', id).select().single()

export const deleteOikos = (id) =>
  supabase.from('oikos').delete().eq('id', id)

// ══════════════════════════════════════════════════════════════
// 기도 기록 (Prayer Logs)
// ══════════════════════════════════════════════════════════════

export const logPrayer = (userId, oikosId) =>
  supabase.from('prayer_logs').upsert(
    { user_id: userId, oikos_id: oikosId, prayed_at: today() },
    { onConflict: 'user_id,oikos_id,prayed_at' }
  )

export const fetchPrayerLogs = (userId, days = 30) => {
  const since = new Date()
  since.setDate(since.getDate() - days)
  return supabase.from('prayer_logs')
    .select('oikos_id, prayed_at').eq('user_id', userId)
    .gte('prayed_at', since.toISOString().split('T')[0])
    .order('prayed_at', { ascending: false })
}

// 오이코스별 연속 기도일 계산
export const calcStreak = (logs, oikosId) => {
  const dates = logs
    .filter(l => l.oikos_id === oikosId)
    .map(l => l.prayed_at)
    .sort((a, b) => b.localeCompare(a))
  let streak = 0
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date()
    expected.setDate(expected.getDate() - i)
    if (dates[i] === expected.toISOString().split('T')[0]) streak++
    else break
  }
  return streak
}

// 오늘 기도했는지 여부
export const prayedToday = (logs, oikosId) =>
  logs.some(l => l.oikos_id === oikosId && l.prayed_at === today())

// 전체 연속 기도일 (최소 1명 이상 기도한 날 기준)
export const calcTotalStreak = (logs) => {
  const days = [...new Set(logs.map(l => l.prayed_at))].sort((a,b) => b.localeCompare(a))
  let streak = 0
  for (let i = 0; i < days.length; i++) {
    const expected = new Date()
    expected.setDate(expected.getDate() - i)
    if (days[i] === expected.toISOString().split('T')[0]) streak++
    else break
  }
  return streak
}

// ══════════════════════════════════════════════════════════════
// 액션 기록 (Action Logs)
// ══════════════════════════════════════════════════════════════

export const logAction = (userId, oikosId, actionType, note = '') =>
  supabase.from('action_logs')
    .insert({ user_id: userId, oikos_id: oikosId, action_type: actionType, note })

export const fetchActionLogs = (userId) =>
  supabase.from('action_logs').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false })

// ══════════════════════════════════════════════════════════════
// 교역자 대시보드 (Admin)
// ══════════════════════════════════════════════════════════════

export const fetchChurchOverview = (churchId) =>
  supabase.from('church_overview').select('*').eq('church_id', churchId)

export const fetchAllOikosByChurch = (churchId) =>
  supabase.from('oikos')
    .select('*, profiles!inner(church_id, display_name, id)')
    .eq('profiles.church_id', churchId)
    .order('created_at')

// ══════════════════════════════════════════════════════════════
// 푸시 알림 구독 저장
// ══════════════════════════════════════════════════════════════

export const savePushSub = (userId, subscription) =>
  supabase.from('profiles')
    .update({ push_subscription: subscription }).eq('id', userId)

// ══════════════════════════════════════════════════════════════
// 실시간 구독 (Realtime)
// ══════════════════════════════════════════════════════════════

export const subscribeOikos = (userId, callback) =>
  supabase.channel('oikos-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'oikos', filter: `user_id=eq.${userId}` }, callback)
    .subscribe()

// ── 유틸 ───────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0]
