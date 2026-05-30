'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabase, signOut, signInOrRegister,
  fetchOikos, createOikos, updateOikos, deleteOikos,
  fetchPrayerLogs, logPrayer, logAction,
  fetchProfile, saveProfile,
  calcStreak, calcTotalStreak, prayedToday, localYMD,
  savePushSub, subscribeOikos,
} from '../lib/supabase'

// ── 전도축제 날짜 ──────────────────────────────────────────────
const FESTIVAL = new Date('2026-10-25')
const FESTIVAL_NAME = '프라미스 전도축제'
const getDaysUntil = () => {
  const t = new Date(); t.setHours(0,0,0,0)
  const f = new Date(FESTIVAL); f.setHours(0,0,0,0)
  return Math.ceil((f - t) / 86400000)
}
const festLabel = () => {
  const d = getDaysUntil()
  if (d > 0) return 'D-' + d
  if (d === 0) return 'D-day!'
  return 'D+' + Math.abs(d)
}

// ── 상수 ──────────────────────────────────────────────────────
const STAGES = ['관심없음','호기심','열린마음','초청준비']
const SM = {
  관심없음: { bg:'#FAEEDA', cl:'#633806', bar:'#EF9F27' },
  호기심:   { bg:'#E1F5EE', cl:'#085041', bar:'#5DCAA5' },
  열린마음: { bg:'#EEEDFE', cl:'#3C3489', bar:'#7F77DD' },
  초청준비: { bg:'#FAECE7', cl:'#712B13', bar:'#F0997B' },
}
const RELS  = ['가족','친구','직장동료','이웃','학교','기타']
const AVC   = [['#EEEDFE','#3C3489'],['#E1F5EE','#085041'],['#FAEEDA','#633806'],
                ['#FBEAF0','#72243E'],['#EAF3DE','#27500A'],['#FAECE7','#712B13']]
const PSTYLES = [
  { id:'short',  l:'짧은 묵상기도', d:'1~2분 · 핵심만' },
  { id:'deep',   l:'깊은 중보기도', d:'5분 · 풍성한 간구' },
  { id:'thanks', l:'감사와 찬양',   d:'은혜로 시작' },
  { id:'verse',  l:'성경 구절 포함', d:'말씀으로 묶기' },
]
const navy = '#1a1a2e', purple = '#534AB7'
const CHURCH = {
  교구:     { icon:'⛪', desc:'1~12교구',     groups:Array.from({length:12},(_,i)=>i+1+'교구'), roles:['장로','권사','집사','성도'] },
  청년교구: { icon:'🙌', desc:'1~3청년교구',  groups:['1청년교구','2청년교구','3청년교구'],      roles:null },
  교육부:   { icon:'📚', desc:'영아부~고등부', groups:['영아부','유아부','유치부','유년부','초등부','소년부','중등부','고등부'], roles:null },
}
const DAY_ACTIONS = [
  { until:3,  title:'짧은 안부 보내기',    icon:'💬' },
  { until:7,  title:'커피 기프티콘 보내기', icon:'☕' },
  { until:14, title:'함께 식사 약속',       icon:'🍽' },
  { until:21, title:'간증 영상 공유',       icon:'🎬' },
  { until:30, title:'전도축제 초청',         icon:'✉️' },
]
const getDA = (day) => DAY_ACTIONS.find(a => day <= a.until) || DAY_ACTIONS[4]

// ── 30일치 일일 메시지 (관계형성→친밀→나눔→초청) ──────────────
// 각 날짜마다 다른 문구. c=가까운사이(가족/친구), f=정중한사이
const DAILY_MSGS = [
  // 1주차: 관계 형성 · 안부
  { c:['{n}, 오랜만이야! 잘 지내지? 갑자기 생각나서 연락했어 😊','{n}, 요즘 어떻게 지내? 문득 궁금해서 ㅎㅎ'], f:['{n}님, 안녕하세요! 오랜만에 안부 여쭤요. 잘 지내시죠? 😊','{n}님, 잘 지내고 계신가요? 문득 생각나서 연락드려요'] },
  { c:['{n}, 오늘 하루는 어땠어? 별일 없지? 😄','{n}, 요즘 바쁘게 지내? 무리하지 말고~'], f:['{n}님, 오늘 하루 잘 보내셨어요? 😊','{n}님, 요즘 어떻게 지내시는지 궁금했어요'] },
  { c:['{n}, 날씨 진짜 좋다! 이런 날엔 네 생각나더라 🌿','{n}, 오늘 하늘 봤어? 너무 예뻐서 생각났어 ☀️'], f:['{n}님, 날씨가 참 좋네요. 좋은 하루 보내세요 🌿','{n}님, 화창한 날이에요. 행복한 하루 되시길 바라요 ☀️'] },
  { c:['{n}, 이번 주도 화이팅이야! 응원할게 💪','{n}, 한 주 시작인데 힘내자! 늘 응원해 😊'], f:['{n}님, 이번 한 주도 힘내세요! 응원할게요 💪','{n}님, 좋은 한 주 보내시길 기도할게요 😊'] },
  { c:['{n}, 밥은 잘 챙겨먹고 다녀? 건강 챙겨 🍚','{n}, 끼니 거르지 말고! 몸이 재산이야 😄'], f:['{n}님, 식사는 잘 챙기고 계세요? 건강 챙기세요 🍚','{n}님, 바쁘셔도 끼니 거르지 마세요 😊'] },
  { c:['{n}, 커피 한 잔 보낼게! 잠깐 쉬면서 마셔 ☕','{n}, 오늘 고생했어. 따뜻한 거 한 잔 해 ☕'], f:['{n}님, 작은 마음이에요. 커피 한 잔 하세요 ☕','{n}님, 잠깐 쉬시라고 커피 보내드려요 ☕'] },
  { c:['{n}, 한 주 수고 많았어! 주말 푹 쉬어 😊','{n}, 이번 주도 고생했어~ 좋은 주말 보내'], f:['{n}님, 한 주 수고 많으셨어요. 주말 잘 보내세요 😊','{n}님, 평안한 주말 보내시길 바라요'] },
  // 2주차: 친밀감 · 만남
  { c:['{n}, 우리 얼굴 본 지 너무 오래됐다! 언제 한번 보자 😄','{n}, 보고 싶다~ 시간 되면 얼굴 한번 보자'], f:['{n}님, 한번 뵙고 싶어요. 시간 괜찮으세요? 😊','{n}님, 오랜만에 얼굴 한번 뵙고 싶네요'] },
  { c:['{n}, 우리 밥 한 끼 하자! 내가 살게 ㅎㅎ','{n}, 맛있는 거 먹으러 가자. 언제 시간 돼?'], f:['{n}님, 식사 한번 같이 하실래요? 😄','{n}님, 맛있는 곳 알아뒀는데 같이 가요'] },
  { c:['{n}, 넌 늘 밝아서 옆에 있으면 기분 좋아져 😊','{n}, 너 만나면 항상 힘이 나더라. 고마워'], f:['{n}님, 늘 긍정적이셔서 뵐 때마다 좋아요 😊','{n}님과 얘기하면 늘 힘이 나요'] },
  { c:['{n}, 혹시 필요한 거 있으면 언제든 말해! 도울게','{n}, 힘든 일 있으면 편하게 얘기해~ 들어줄게'], f:['{n}님, 도움 필요하시면 언제든 말씀하세요','{n}님, 어려운 일 있으시면 편하게 연락주세요'] },
  { c:['{n}, 문득 예전에 같이 놀던 거 생각나더라 ㅎㅎ','{n}, 우리 옛날 얘기하면서 추억 돋았어 😄'], f:['{n}님, 예전 함께한 시간이 문득 생각나네요 😊','{n}님과의 좋은 기억이 떠올랐어요'] },
  { c:['{n}, 나 요즘 이렇게 지내! 너는 어때? 😊','{n}, 요즘 내 근황 공유! 너도 얘기해줘'], f:['{n}님, 요즘 저는 이렇게 지내요. {n}님은요? 😊','{n}님 근황도 궁금해요. 잘 지내시죠?'] },
  { c:['{n}, 주말 계획 있어? 없으면 같이 뭐라도 하자!','{n}, 이번 주말 뭐해? 바람 쐬러 갈까? 😄'], f:['{n}님, 주말 평안히 보내세요 😊','{n}님, 주말에 시간 되시면 차 한잔해요'] },
  // 3주차: 마음 나눔
  { c:['{n}, 나 요즘 마음이 참 편안해졌어. 신기하지? 😊','{n}, 요즘 마음에 여유가 생긴 것 같아'], f:['{n}님, 요즘 마음이 참 평안해요 😊','{n}님, 요즘 마음의 여유가 생겼어요'] },
  { c:['{n}, 너 같은 친구 있어서 참 감사해 💚','{n}, 살면서 너 만난 게 복이야. 고마워'], f:['{n}님 같은 분이 곁에 있어 감사해요 💚','{n}님, 늘 감사한 마음이에요'] },
  { c:['{n}, 나 요즘 좋은 글 읽고 있는데 마음이 따뜻해져 📖','{n}, 요즘 마음에 와닿는 글귀가 있어서 나누고 싶어'], f:['{n}님, 요즘 좋은 말씀 읽으며 위로받고 있어요 📖','{n}님, 마음에 남는 글이 있어 나누고 싶었어요'] },
  { c:['{n}, 혹시 요즘 힘든 일 있어? 언제든 들어줄게','{n}, 마음 무거운 일 있으면 나한테 털어놔도 돼'], f:['{n}님, 힘드신 일 있으면 언제든 말씀하세요','{n}님, 마음 어려우실 때 편하게 연락주세요'] },
  { c:['{n}, 나 요즘 좀 달라진 것 같지 않아? ㅎㅎ 마음이 밝아졌어','{n}, 요즘 내가 좀 평온해 보이지? 이유가 있어 😊'], f:['{n}님, 요즘 제 마음이 많이 밝아졌어요 😊','{n}님, 요즘 마음에 평안이 찾아왔어요'] },
  { c:['{n}, 나 요즘 교회에서 좋은 사람들 많이 만났어 😊','{n}, 좋은 공동체를 만나서 마음이 따뜻해'], f:['{n}님, 요즘 좋은 분들을 많이 만나고 있어요 😊','{n}님, 따뜻한 공동체를 만났어요'] },
  { c:['{n}, 언젠가 너랑 같이 가보고 싶은 곳이 있어 😊','{n}, 너한테 소개해주고 싶은 곳이 있어!'], f:['{n}님, 함께 가보고 싶은 곳이 있어요 😊','{n}님께 소개해드리고 싶은 곳이 있어요'] },
  // 4주차: 초청
  { c:['{n}, 우리 교회에서 특별한 행사를 하는데, 너 생각이 났어 😊','{n}, 곧 교회에서 좋은 행사가 있어. 같이 갈래?'], f:['{n}님, 저희 교회에서 특별한 행사가 있어요. 생각이 나서요 😊','{n}님, 곧 좋은 행사가 있는데 함께하면 어떨까요?'] },
  { c:['{n}, 부담 갖지 말고 그냥 놀러온다 생각하고 와! 😄','{n}, 진짜 편하게 구경만 와도 돼. 어때?'], f:['{n}님, 부담 없이 편하게 구경 오셔도 돼요 😄','{n}님, 그냥 가볍게 와보셔도 좋아요'] },
  { c:['{n}, 너랑 같이 가면 진짜 좋을 것 같아! 같이 가자 😊','{n}, 혼자 가기보다 너랑 같이 가고 싶어'], f:['{n}님, 함께 가면 정말 좋을 것 같아요 😊','{n}님과 같이 가고 싶어서요'] },
  { c:['{n}, '+FESTIVAL_NAME+'이 10월 25일에 열려! 그날 같이 가자 🙏','{n}, 10월 25일 '+FESTIVAL_NAME+'인데 꼭 같이 가고 싶어'], f:['{n}님, 10월 25일 '+FESTIVAL_NAME+'에 초대하고 싶어요 🙏','{n}님, 10월 25일에 특별한 행사가 있어요'] },
  { c:['{n}, 지난번에 말한 그 행사 말야! 마음에 두고 있어? 😊','{n}, 그 교회 행사, 같이 가는 거 생각해봤어?'], f:['{n}님, 지난번 말씀드린 행사 기억하시죠? 😊','{n}님, 그 행사 함께 가실 수 있을까 해서요'] },
  { c:['{n}, 너랑 꼭 같이 가고 싶어서 다시 연락했어 💚','{n}, 진심으로 너랑 함께하고 싶어. 와줄 수 있어?'], f:['{n}님과 꼭 함께 가고 싶어서 다시 연락드려요 💚','{n}님, 진심으로 함께하고 싶어요'] },
  { c:['{n}, 행사가 며칠 안 남았어! 같이 갈 준비 됐지? 😄','{n}, 곧이야! 그날 비워둬, 같이 가자'], f:['{n}님, 행사가 곧이에요! 함께해주시면 좋겠어요 😄','{n}님, 며칠 안 남았어요. 시간 비워두세요'] },
  { c:['{n}, 딱 한 번만 와봐. 진짜 후회 안 할 거야 🙏','{n}, 한 번만 믿고 와줘. 좋은 시간 될 거야'], f:['{n}님, 한 번만 와보시면 정말 좋으실 거예요 🙏','{n}님, 믿고 한번 와주시면 감사하겠어요'] },
  { c:['{n}, 오늘이야! 우리 같이 가자 😊 기다릴게!','{n}, 드디어 오늘! 같이 가는 거 잊지 않았지? 🙏'], f:['{n}님, 오늘이에요! 함께 가요 😊 기다릴게요','{n}님, 드디어 오늘이네요. 뵙기를 기대해요 🙏'] },
]

function getMessageTemplates(oikos) {
  const n = oikos.name
  const day = Math.max(1, Math.min(30, oikos.day_in_challenge || 1))
  const close = ['가족','친구'].includes(oikos.relation || '')
  const entry = DAILY_MSGS[day - 1] || DAILY_MSGS[0]
  const list = close ? entry.c : entry.f
  return list.map(m => m.replace(/\{n\}/g, n))
}

// ── 스와이프 뒤로가기 ──────────────────────────────────────────
function useSwipeBack(onBack) {
  const sx = useRef(null), sy = useRef(null)
  return {
    onTouchStart: e => { sx.current = e.touches[0].clientX; sy.current = e.touches[0].clientY },
    onTouchEnd: e => {
      if (sx.current === null) return
      const dx = e.changedTouches[0].clientX - sx.current
      const dy = Math.abs(e.changedTouches[0].clientY - sy.current)
      if (dx > 80 && dy < 100) onBack()
      sx.current = null
    },
  }
}

// ── 공통 컴포넌트 ──────────────────────────────────────────────
const Av = ({ name, ci=0, size=40 }) => {
  const [bg,cl] = AVC[ci%AVC.length]
  return <div style={{ width:size,height:size,borderRadius:'50%',background:bg,color:cl,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.33,fontWeight:700,flexShrink:0 }}>{name?.slice(0,2)||'?'}</div>
}
const SPill = ({ stage }) => {
  const m = SM[stage]||SM['호기심']
  return <span style={{ fontSize:10,fontWeight:700,background:m.bg,color:m.cl,padding:'2px 8px',borderRadius:10 }}>{stage}</span>
}
const Btn = ({ onClick, children, style={} }) =>
  <button onClick={onClick} style={{ border:'none',cursor:'pointer',fontFamily:'inherit',...style }}>{children}</button>

function KrInput({ value, onChange, style={}, ...p }) {
  const c = useRef(false)
  return <input value={value}
    onCompositionStart={()=>{ c.current=true }}
    onCompositionEnd={e=>{ c.current=false; onChange(e.target.value) }}
    onChange={e=>{ if(!c.current) onChange(e.target.value) }}
    style={style} {...p} />
}
function KrTextarea({ value, onChange, style={}, ...p }) {
  const c = useRef(false)
  return <textarea value={value}
    onCompositionStart={()=>{ c.current=true }}
    onCompositionEnd={e=>{ c.current=false; onChange(e.target.value) }}
    onChange={e=>{ if(!c.current) onChange(e.target.value) }}
    style={style} {...p} />
}

// ── 4자리 코드 입력 컴포넌트 ───────────────────────────────────
function PinInput({ value, onChange, dark=false }) {
  const inputRef = useRef(null)
  const digits = (value || '').padEnd(4, '')
  const bg   = dark ? 'rgba(255,255,255,0.08)' : '#fff'
  const fill = dark ? 'rgba(255,255,255,0.18)' : '#EEEDFE'
  const border = dark ? 'rgba(255,255,255,0.2)' : '#d3d1c7'
  const activeBorder = dark ? '#9FE1CB' : purple
  const textColor = dark ? '#fff' : navy

  return (
    <div style={{ position:'relative' }} onClick={()=>inputRef.current?.focus()}>
      <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
        {[0,1,2,3].map(i => {
          const filled = digits[i] && digits[i] !== ' '
          return (
            <div key={i} style={{
              width:56, height:64, borderRadius:14,
              background: filled ? fill : bg,
              border: '2px solid ' + (filled ? activeBorder : border),
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:28, fontWeight:800, color:textColor,
              transition:'all 0.15s',
            }}>
              {filled ? digits[i] : <span style={{ color: dark ? 'rgba(255,255,255,0.2)' : '#d3d1c7', fontSize:20 }}>·</span>}
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        type="tel" inputMode="numeric" maxLength={4}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g,'').slice(0,4))}
        style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0, cursor:'pointer' }}
      />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 앱 진입점 — 로그인 유지 + 프로필 체크 후 화면 결정
// ══════════════════════════════════════════════════════════════
export default function Page() {
  // 'loading' | 'register' | 'app'
  const [appState, setAppState] = useState('loading')
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)

  useEffect(() => {
    let mounted = true

    const finishWithSession = async (s) => {
      if (!mounted) return
      setSession(s)
      const { data: prof } = await fetchProfile(s.user.id)
      if (!mounted) return
      setProfile(prof)
      setAppState(prof?.display_name && prof?.church_group ? 'app' : 'register')
    }

    const init = async () => {
      try {
        // 1) 저장된 세션 확인 (로컬스토리지)
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        if (data.session) { await finishWithSession(data.session); return }

        // 2) 세션 없으면 → 저장된 교구/이름/코드로 자동 재로그인 (30일 유지 핵심!)
        let creds = null
        try { creds = JSON.parse(localStorage.getItem('oikos_creds') || 'null') } catch {}
        if (creds?.group && creds?.name && creds?.code) {
          const { session: s } = await signInOrRegister(creds.group, creds.name, creds.code)
          if (s && mounted) { await finishWithSession(s); return }
        }

        // 3) 둘 다 없으면 등록 화면
        if (mounted) setAppState('register')
      } catch {
        if (mounted) setAppState('register')
      }
    }

    init()

    // 10초 후에도 '로딩 중'이면 등록 화면으로 (이미 app/register면 유지 — 버그 수정)
    const timeout = setTimeout(() => {
      if (mounted) setAppState(prev => prev === 'loading' ? 'register' : prev)
    }, 10000)

    // 로그아웃만 감지 (로그인은 init이 처리 — 중복 방지)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        try { localStorage.removeItem('oikos_creds') } catch {}
        setSession(null); setProfile(null); setAppState('register')
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  if (appState === 'loading') return (
    <div style={{ height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:navy,gap:16 }}>
      <img src="/logo.png" alt="하남교회" style={{ width:160,opacity:0.9 }} />
      <div style={{ fontSize:13,color:'#AFA9EC',fontFamily:"'Noto Sans KR',sans-serif" }}>불러오는 중...</div>
    </div>
  )

  if (appState === 'register') return (
    <RegisterScreen
      session={session}
      onDone={(s, prof) => { setSession(s); setProfile(prof); setAppState('app') }}
    />
  )

  return <OikosApp session={session} profile={profile} setProfile={setProfile} />
}

// ══════════════════════════════════════════════════════════════
// 교회 등록 화면
// ══════════════════════════════════════════════════════════════
function RegisterScreen({ session, onDone }) {
  const [step, setStep]       = useState(1)
  const [dept, setDept]       = useState('')
  const [group, setGroup]     = useState('')
  const [name, setName]       = useState('')
  const [role, setRole]       = useState('성도')
  const [code, setCode]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')
  const di = CHURCH[dept]

  const canProceed = name.trim() && group && code.length === 4

  const handleComplete = async () => {
    if (!canProceed) return
    setSaving(true); setMsg('')
    try {
      // 교구+이름+코드로 항상 같은 계정 로그인/생성
      const { session: s, error } = await signInOrRegister(group, name.trim(), code)
      if (error) {
        setMsg('오류: ' + error.message)
        setSaving(false); return
      }
      if (!s) {
        setMsg('Supabase 이메일 확인을 비활성화해주세요.')
        setSaving(false); return
      }
      const pd = {
        display_name: name.trim(),
        church_dept:  dept,
        church_group: group,
        church_role:  dept === '교구' ? role : null,
        user_code:    code,
      }
      await saveProfile(s.user.id, pd)
      // 자동 재로그인용 정보 저장 (브라우저 초기화돼도 같은 계정 복구)
      try { localStorage.setItem('oikos_creds', JSON.stringify({ group, name: name.trim(), code })) } catch {}
      onDone(s, { ...pd, id: s.user.id })
    } catch(e) {
      setMsg('오류가 발생했습니다. 다시 시도해주세요.')
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:navy, fontFamily:"'Noto Sans KR',sans-serif", display:'flex', flexDirection:'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap'); *{box-sizing:border-box;} input::placeholder{color:rgba(255,255,255,0.3);}`}</style>

      {/* 헤더 */}
      <div style={{ padding:'40px 24px 20px', textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:700, color:'#fff', marginBottom:4 }}>오이코스 전도 프로그램</div>
        <div style={{ fontSize:13, color:'#AFA9EC' }}>소중한 한 영혼을 위한 30일 기도 여정</div>
      </div>

      {/* 진행 바 */}
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:24 }}>
        {[1,2].map(i=>(
          <div key={i} style={{ width:step>=i?32:8, height:8, borderRadius:4, background:step>=i?'#9FE1CB':'rgba(255,255,255,0.15)', transition:'all 0.3s' }} />
        ))}
      </div>

      <div style={{ flex:1, padding:'0 24px', display:'flex', flexDirection:'column' }}>

        {/* STEP 1: 교구 선택 */}
        {step===1 && (
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:6 }}>어디 소속이세요?</div>
            <div style={{ fontSize:13, color:'#AFA9EC', marginBottom:24 }}>해당하는 곳을 선택해주세요</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.entries(CHURCH).map(([key,val])=>(
                <div key={key} onClick={()=>{ setDept(key); setGroup(''); setStep(2) }}
                  style={{ background:'rgba(255,255,255,0.08)', border:'1.5px solid '+(dept===key?'#9FE1CB':'rgba(255,255,255,0.15)'), borderRadius:16, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.15s' }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{val.icon}</div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:2 }}>{key}</div>
                    <div style={{ fontSize:12, color:'#AFA9EC' }}>{val.desc}</div>
                  </div>
                  <div style={{ marginLeft:'auto', fontSize:18, color:'#AFA9EC' }}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: 상세 정보 + 이름 + 4자리 코드 */}
        {step===2 && di && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <Btn onClick={()=>{ setStep(1); setGroup('') }}
                style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:16 }}>←</Btn>
              <div style={{ fontSize:18, fontWeight:700, color:'#fff' }}>{dept} 등록</div>
            </div>

            {/* 그룹 */}
            <div style={{ fontSize:12, fontWeight:700, color:'#AFA9EC', marginBottom:10 }}>
              {dept==='교구'?'교구 선택':dept==='청년교구'?'청년교구 선택':'부서 선택'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:dept==='교구'?'repeat(4,1fr)':'repeat(3,1fr)', gap:6, marginBottom:20 }}>
              {di.groups.map(g=>(
                <div key={g} onClick={()=>setGroup(g)}
                  style={{ background:group===g?'#9FE1CB':'rgba(255,255,255,0.08)', border:'1px solid '+(group===g?'#9FE1CB':'rgba(255,255,255,0.15)'), borderRadius:10, padding:'10px 4px', fontSize:12, fontWeight:group===g?700:400, color:group===g?navy:'#fff', textAlign:'center', cursor:'pointer' }}>
                  {g}
                </div>
              ))}
            </div>

            {/* 직분 (교구만) */}
            {dept==='교구' && (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:'#AFA9EC', marginBottom:10 }}>직분</div>
                <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
                  {di.roles.map(r=>(
                    <div key={r} onClick={()=>setRole(r)}
                      style={{ background:role===r?'#9FE1CB':'rgba(255,255,255,0.08)', border:'1px solid '+(role===r?'#9FE1CB':'rgba(255,255,255,0.15)'), borderRadius:20, padding:'8px 16px', fontSize:13, fontWeight:role===r?700:400, color:role===r?navy:'#fff', cursor:'pointer' }}>
                      {r}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 이름 */}
            <div style={{ fontSize:12, fontWeight:700, color:'#AFA9EC', marginBottom:10 }}>이름</div>
            <KrInput value={name} onChange={setName} placeholder="홍길동"
              style={{ width:'100%', height:50, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:12, padding:'0 16px', fontSize:16, fontFamily:'inherit', outline:'none', color:'#fff', marginBottom:24 }} />

            {/* 4자리 코드 */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#AFA9EC', marginBottom:4 }}>나만의 4자리 숫자 코드</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:16 }}>동명이인을 구분하기 위한 숫자예요. 기억하기 쉬운 숫자로 설정하세요.</div>
              <PinInput value={code} onChange={setCode} dark />
              {code.length > 0 && code.length < 4 && (
                <div style={{ fontSize:11, color:'#F0997B', textAlign:'center', marginTop:10 }}>4자리를 모두 입력해주세요</div>
              )}
            </div>

            {/* 미리보기 */}
            {canProceed && (
              <div style={{ marginBottom:16, padding:'12px 16px', background:'rgba(159,225,203,0.12)', border:'1px solid rgba(159,225,203,0.3)', borderRadius:12, textAlign:'center', lineHeight:1.8 }}>
                <span style={{ color:'#9FE1CB', fontWeight:700 }}>{group}</span>
                {dept==='교구' && <span style={{ color:'rgba(255,255,255,0.6)' }}> {role}</span>}
                <span style={{ color:'#fff', fontWeight:700 }}> {name}</span>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}> · {code}</span>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>로 등록돼요</div>
              </div>
            )}

            {msg && <div style={{ fontSize:12, color:'#F0997B', marginBottom:12, textAlign:'center' }}>{msg}</div>}

            <Btn onClick={handleComplete}
              style={{ width:'100%', height:52, background:canProceed?'#9FE1CB':'rgba(255,255,255,0.12)', borderRadius:14, fontSize:16, fontWeight:700, color:canProceed?navy:'rgba(255,255,255,0.3)', cursor:canProceed?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
              {saving ? '등록 중...' : canProceed ? '시작하기 →' : '정보를 모두 입력해주세요'}
            </Btn>
          </div>
        )}

        {/* 하남교회 로고 */}
        <div style={{ marginTop:'auto', paddingTop:32, paddingBottom:40, textAlign:'center' }}>
          <img src="/logo.png" alt="하남교회" style={{ width:160, opacity:0.7 }} />
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 오이코스 등록 오버레이 (독립 컴포넌트 — 키보드 유지)
// ══════════════════════════════════════════════════════════════
function AddOverlay({ userId, onClose, onAdded }) {
  const [step, setStep]     = useState(1)
  const [form, setForm]     = useState({ name:'', phone:'', rel:'친구', stage:'호기심', topics:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const swipe = useSwipeBack(onClose)

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const { error } = await createOikos({
      user_id:userId, name:form.name, phone:form.phone, relation:form.rel,
      stage:form.stage, topics:form.topics.split('\n').filter(t=>t.trim()), notes:form.notes,
    })
    setSaving(false)
    if (error) { alert('저장 실패. 다시 시도해주세요.'); return }
    onAdded(form.name); onClose()
  }

  return (
    <div style={{ position:'absolute',top:0,left:0,right:0,bottom:0,background:'#f7f5f0',zIndex:100,display:'flex',flexDirection:'column' }} {...swipe}>
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'14px 18px 10px',borderBottom:'0.5px solid #d3d1c7',flexShrink:0 }}>
        <Btn onClick={onClose} style={{ width:30,height:30,borderRadius:'50%',background:'#e8e5de',display:'flex',alignItems:'center',justifyContent:'center' }}>←</Btn>
        <span style={{ fontSize:15,fontWeight:700,color:navy,flex:1 }}>오이코스 등록</span>
        <span style={{ fontSize:12,color:'#888780' }}>{step} / 2</span>
      </div>
      <div style={{ height:3,background:'#e8e5de',flexShrink:0 }}>
        <div style={{ height:3,width:(step/2*100)+'%',background:purple,transition:'width 0.3s' }} />
      </div>
      <div style={{ flex:1,overflowY:'auto',padding:'20px 18px' }}>
        {step===1 ? (
          <>
            <div style={{ fontSize:11,fontWeight:700,color:purple,letterSpacing:'0.06em',marginBottom:4 }}>STEP 1</div>
            <div style={{ fontSize:20,fontWeight:700,color:navy,lineHeight:1.35,marginBottom:4 }}>누구를 위해<br />기도하나요?</div>
            <div style={{ fontSize:13,color:'#888780',marginBottom:20 }}>기본 정보를 입력해주세요</div>
            {[{label:'이름',req:true,key:'name',ph:'홍길동'},{label:'연락처',req:false,key:'phone',ph:'010-0000-0000'}].map(f=>(
              <div key={f.key} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,fontWeight:700,color:'#444441',marginBottom:5 }}>{f.label} {f.req&&<span style={{ color:'#D85A30' }}>*</span>}</div>
                <KrInput value={form[f.key]} onChange={v=>setForm(p=>({...p,[f.key]:v}))} placeholder={f.ph}
                  style={{ width:'100%',height:42,background:'#fff',border:'0.5px solid #B4B2A9',borderRadius:10,padding:'0 12px',fontSize:14,fontFamily:'inherit',outline:'none',color:navy }} />
              </div>
            ))}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12,fontWeight:700,color:'#444441',marginBottom:8 }}>관계</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7 }}>
                {RELS.map(r=>(
                  <div key={r} onClick={()=>setForm(p=>({...p,rel:r}))}
                    style={{ background:form.rel===r?'#EEEDFE':'#fff',border:'0.5px solid '+(form.rel===r?'#7F77DD':'#d3d1c7'),borderRadius:20,padding:'8px 4px',fontSize:12,fontWeight:form.rel===r?700:400,color:form.rel===r?'#3C3489':'#5F5E5A',textAlign:'center',cursor:'pointer' }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
            <Btn onClick={()=>form.name.trim()&&setStep(2)}
              style={{ width:'100%',height:48,background:form.name.trim()?navy:'#d3d1c7',borderRadius:14,color:'#fff',fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>
              다음 단계 →
            </Btn>
          </>
        ) : (
          <>
            <div style={{ fontSize:11,fontWeight:700,color:purple,letterSpacing:'0.06em',marginBottom:4 }}>STEP 2</div>
            <div style={{ fontSize:20,fontWeight:700,color:navy,lineHeight:1.35,marginBottom:4 }}>기도제목과<br />관계 단계를</div>
            <div style={{ fontSize:13,color:'#888780',marginBottom:20 }}>AI 기도문 생성에 활용됩니다</div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,fontWeight:700,color:'#444441',marginBottom:5 }}>기도제목</div>
              <KrTextarea value={form.topics} onChange={v=>setForm(p=>({...p,topics:v}))}
                placeholder={'복음에 마음이 열리도록\n직장 스트레스가 줄어들도록'}
                style={{ width:'100%',height:80,background:'#fff',border:'0.5px solid #B4B2A9',borderRadius:10,padding:'10px 12px',fontSize:13,fontFamily:'inherit',outline:'none',resize:'none',lineHeight:1.6,color:navy }} />
              <div style={{ fontSize:10,color:'#888780',marginTop:3 }}>한 줄에 하나씩 입력하세요</div>
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12,fontWeight:700,color:'#444441',marginBottom:8 }}>현재 관계 단계</div>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                {STAGES.map((s,i)=>{
                  const m=SM[s], descs=['교회나 복음에 관심 없는 상태','교회나 기독교에 호기심을 보임','마음을 열고 대화가 가능한 상태','전도축제 초청 받아들일 준비됨']
                  return (
                    <div key={s} onClick={()=>setForm(p=>({...p,stage:s}))}
                      style={{ display:'flex',alignItems:'center',gap:10,background:form.stage===s?m.bg:'#fff',border:'0.5px solid '+(form.stage===s?m.bar:'#d3d1c7'),borderRadius:10,padding:'10px 12px',cursor:'pointer' }}>
                      <div style={{ width:10,height:10,borderRadius:'50%',background:form.stage===s?m.bar:'#d3d1c7',flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:13,fontWeight:700,color:form.stage===s?m.cl:navy }}>{s}</div>
                        <div style={{ fontSize:10,color:'#888780' }}>{descs[i]}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <Btn onClick={handleAdd}
              style={{ width:'100%',height:48,background:purple,borderRadius:14,color:'#fff',fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>
              {saving ? '저장 중...' : '등록 완료 ✓'}
            </Btn>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 메시지 선택 오버레이 (독립 컴포넌트)
// ══════════════════════════════════════════════════════════════
function MessageSelectOverlay({ oikos, onClose }) {
  const [shared, setShared] = useState(null)
  const swipe = useSwipeBack(onClose)
  const templates = getMessageTemplates(oikos)

  const handleSelect = async (msg, idx) => {
    setShared(idx)
    try {
      if (navigator.share) {
        // 네이티브 공유창 (카카오톡, 문자 등 선택)
        await navigator.share({ text: msg })
        setTimeout(onClose, 400)
      } else {
        // 공유 미지원(데스크탑) → 복사로 폴백
        await navigator.clipboard?.writeText(msg)
        setTimeout(onClose, 900)
      }
    } catch (e) {
      // 사용자가 공유 취소 → 오버레이 유지 (다른 문구 선택 가능)
      setShared(null)
    }
  }

  return (
    <div style={{ position:'absolute',top:0,left:0,right:0,bottom:0,background:'#f7f5f0',zIndex:100,display:'flex',flexDirection:'column' }} {...swipe}>
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'14px 18px 10px',borderBottom:'0.5px solid #d3d1c7',flexShrink:0 }}>
        <Btn onClick={onClose} style={{ width:30,height:30,borderRadius:'50%',background:'#e8e5de',display:'flex',alignItems:'center',justifyContent:'center' }}>←</Btn>
        <span style={{ fontSize:15,fontWeight:700,color:navy,flex:1 }}>{oikos.name}님께 보낼 메시지</span>
      </div>
      <div style={{ padding:'10px 16px',background:'#fff',borderBottom:'0.5px solid #d3d1c7',display:'flex',alignItems:'center',gap:8 }}>
        <Av name={oikos.name} ci={0} size={30} />
        <div style={{ flex:1 }}>
          <span style={{ fontSize:12,fontWeight:700,color:navy }}>{oikos.name}</span>
          <span style={{ fontSize:11,color:'#888780',marginLeft:6 }}>Day {oikos.day_in_challenge||1}</span>
        </div>
        <SPill stage={oikos.stage} />
      </div>
      <div style={{ flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:8 }}>
        <div style={{ fontSize:11,color:'#888780',marginBottom:4 }}>탭하면 공유창이 열려요 · 카카오톡·문자 등 선택해 보내세요 👇</div>
        {templates.map((msg,idx)=>(
          <div key={idx} onClick={()=>handleSelect(msg,idx)}
            style={{ background:shared===idx?'#E1F5EE':'#fff', border:'1.5px solid '+(shared===idx?'#5DCAA5':'#d3d1c7'), borderRadius:14, padding:'14px 16px', cursor:'pointer', transition:'all 0.2s' }}>
            <div style={{ fontSize:13,color:navy,lineHeight:1.65,marginBottom:6 }}>{msg}</div>
            <div style={{ textAlign:'right',fontSize:11,fontWeight:700,color:shared===idx?'#085041':purple }}>
              {shared===idx ? '✓ 공유창 열림' : '📤 탭해서 공유'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 기도제목 수정 — 카드 플립 (이름 누르면 휙 돌아감)
// ══════════════════════════════════════════════════════════════
function EditTopicsOverlay({ oikos, onClose, onSaved }) {
  const [flipped, setFlipped] = useState(false)
  const [name, setName]       = useState(oikos.name || '')
  const [topics, setTopics]   = useState((oikos.topics || []).join('\n'))
  const [saving, setSaving]   = useState(false)
  const [savedName, setSavedName] = useState(oikos.name || '')
  const [savedList, setSavedList] = useState(oikos.topics || [])
  const ci = oikos._ci || 0

  // 열리면 잠깐 앞면 보여준 뒤 휙~ 뒤집기
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 320)
    return () => clearTimeout(t)
  }, [])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const list = topics.split('\n').map(t => t.trim()).filter(Boolean)
    await updateOikos(oikos.id, { name: name.trim(), topics: list })
    setSaving(false)
    setSavedName(name.trim())
    setSavedList(list)       // 앞면도 새 내용으로 갱신
    setFlipped(false)        // 앞면으로 휙 돌아가며 결과 보여주기
    onSaved()
    setTimeout(onClose, 1100)
  }

  const m = SM[oikos.stage] || SM['호기심']
  const [avBg, avCl] = AVC[ci % AVC.length]

  return (
    <div onClick={onClose}
      style={{ position:'absolute', inset:0, background:'rgba(20,20,35,0.55)', backdropFilter:'blur(3px)', zIndex:150, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:330, perspective:1400 }}>
        <div style={{
          position:'relative', width:'100%', height:420,
          transformStyle:'preserve-3d',
          transition:'transform 0.7s cubic-bezier(0.4,0.2,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* ── 앞면: 정보 ── */}
          <div onClick={()=>setFlipped(true)} style={{
            position:'absolute', inset:0, backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
            background:'#fff', borderRadius:24, padding:24, cursor:'pointer',
            boxShadow:'0 20px 50px rgba(0,0,0,0.3)',
            display:'flex', flexDirection:'column', alignItems:'center',
          }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:avBg, color:avCl, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:700, marginBottom:14 }}>
              {savedName?.slice(0,2)}
            </div>
            <div style={{ fontSize:19, fontWeight:700, color:navy, marginBottom:4 }}>{savedName}</div>
            <div style={{ fontSize:12, color:'#888780', marginBottom:14 }}>{oikos.relation} · Day {oikos.day_in_challenge||1}</div>
            <div style={{ width:'100%', flex:1, overflowY:'auto' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#888780', marginBottom:8 }}>기도제목</div>
              {savedList.length ? savedList.map((t,i)=>(
                <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', background:'#f7f5f0', borderRadius:8, padding:'8px 10px', marginBottom:5 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:m.bar, marginTop:6, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#444441', lineHeight:1.5 }}>{t}</span>
                </div>
              )) : <div style={{ fontSize:12, color:'#B4B2A9' }}>아직 기도제목이 없어요</div>}
            </div>
            <div style={{ fontSize:11, color:purple, fontWeight:700, marginTop:10 }}>{flipped ? '' : '탭하면 수정 화면으로 ✏️'}</div>
          </div>

          {/* ── 뒷면: 수정 ── */}
          <div style={{
            position:'absolute', inset:0, backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
            transform:'rotateY(180deg)',
            background:'#fff', borderRadius:24, padding:22,
            boxShadow:'0 20px 50px rgba(0,0,0,0.3)',
            display:'flex', flexDirection:'column',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:avBg, color:avCl, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>
                {(name||'?').slice(0,2)}
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:navy }}>정보 수정 ✏️</div>
                <div style={{ fontSize:11, color:'#888780' }}>이름과 기도제목을 바꿀 수 있어요</div>
              </div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#888780', marginBottom:5 }}>이름</div>
            <KrInput value={name} onChange={setName} placeholder="이름"
              style={{ width:'100%', height:42, background:'#f7f5f0', border:'1.5px solid #e8e5de', borderRadius:12, padding:'0 14px', fontSize:14, fontFamily:'inherit', outline:'none', color:navy, marginBottom:14 }} />
            <div style={{ fontSize:11, fontWeight:700, color:'#888780', marginBottom:5 }}>기도제목</div>
            <KrTextarea value={topics} onChange={setTopics}
              placeholder={'복음에 마음이 열리도록\n가정에 평안이 임하도록\n교회에 함께 나오도록'}
              style={{ flex:1, width:'100%', background:'#f7f5f0', border:'1.5px solid #e8e5de', borderRadius:14, padding:'12px 14px', fontSize:13, fontFamily:'inherit', outline:'none', resize:'none', lineHeight:1.7, color:navy }} />
            <div style={{ fontSize:10, color:'#888780', margin:'6px 2px 12px' }}>기도제목은 한 줄에 하나씩</div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={()=>setFlipped(false)} style={{ width:48, height:46, background:'#f1efe8', borderRadius:12, fontSize:18 }}>↩</Btn>
              <Btn onClick={handleSave} style={{ flex:1, height:46, background:name.trim()?purple:'#d3d1c7', borderRadius:12, color:'#fff', fontSize:14, fontWeight:700 }}>
                {saving ? '저장 중...' : '저장하기 ✓'}
              </Btn>
            </div>
          </div>
        </div>
        <div style={{ textAlign:'center', marginTop:14 }}>
          <Btn onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', borderRadius:20, padding:'7px 18px', fontSize:12, fontWeight:700 }}>닫기</Btn>
        </div>
      </div>
    </div>
  )
}
// ══════════════════════════════════════════════════════════════
function OikosApp({ session, profile, setProfile }) {
  const userId = session.user.id
  const [tab, setTab]                = useState('home')
  const [oikosList, setOikos]        = useState([])
  const [prayerLogs, setLogs]        = useState([])
  const [dataLoading, setDL]         = useState(true)
  const [overlay, setOverlay]        = useState(null)
  const [selId, setSelId]            = useState(null)
  const [msgTarget, setMsgTarget]    = useState(null)
  const [editTarget, setEditTarget]  = useState(null)
  const [deleteTarget, setDelTarget] = useState(null)
  const [pState, setPState]          = useState('select')
  const [pStyle, setPStyle]          = useState('short')
  const [pResult, setPResult]        = useState('')
  const [stageF, setStageF]          = useState('전체')
  const [toast, setToast]            = useState('')

  const displayName = profile?.display_name || '성도'
  const displaySub  = profile?.church_group  || ''
  const displayRole = profile?.church_role   || ''
  const displayCode = profile?.user_code     || ''

  const loadData = useCallback(async () => {
    setDL(true)
    const [{ data:oks }, { data:logs }] = await Promise.all([
      fetchOikos(userId), fetchPrayerLogs(userId, 60),
    ])
    // created_at 기준으로 챌린지 Day 자동 계산 (등록일=Day 1)
    const withDay = (oks||[]).map(o => {
      let day = 1
      if (o.created_at) {
        const start = new Date(o.created_at); start.setHours(0,0,0,0)
        const now = new Date(); now.setHours(0,0,0,0)
        day = Math.max(1, Math.min(30, Math.floor((now - start) / 86400000) + 1))
      }
      return { ...o, day_in_challenge: day }
    })
    setOikos(withDay); setLogs(logs||[])
    if (withDay.length > 0 && !selId) setSelId(withDay[0].id)
    setDL(false)
  }, [userId])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const ch = subscribeOikos(userId, () => loadData())
    return () => supabase.removeChannel(ch)
  }, [userId, loadData])

  const totalStreak = calcTotalStreak(prayerLogs)
  const prayedCount = oikosList.filter(o => prayedToday(prayerLogs, o.id)).length
  const selOikos    = oikosList.find(o => o.id === selId) || oikosList[0]
  const todayOikos  = oikosList[0]

  const showToast  = (m) => { setToast(m); setTimeout(() => setToast(''), 2400) }
  const openPrayer = (id) => { setSelId(id); setPState('select'); setPResult(''); setOverlay('prayer') }
  const openMsg    = (o)  => { setMsgTarget(o); setOverlay('message') }
  const openEdit   = (o, idx)  => { setEditTarget({ ...o, _ci: idx }) }

  const handlePrayed = async (id) => { await logPrayer(userId, id); await loadData(); showToast('기도 완료! 🙏') }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteOikos(deleteTarget.id)
    await loadData()
    showToast(deleteTarget.name + '님이 삭제됐어요')
    setDelTarget(null)
  }

  const handleStageChange = async (id, s) => {
    await updateOikos(id, { stage:s }); await loadData()
    showToast("'" + s + "'로 변경됐어요")
  }

  const openGift = (oikos) => {
    window.open('https://gift.kakao.com', '_blank')
    logAction(userId, oikos.id, 'gift')
    showToast('카카오 선물하기로 연결됐어요')
  }

  const handleInviteShare = async () => {
    const msg = '저희 하남교회 ' + FESTIVAL_NAME + '에 초대합니다 🙏\n10월 25일, 부담 없이 함께해요. 좋은 시간이 될 거예요 😊'
    try {
      if (navigator.share) {
        await navigator.share({ text: msg })
      } else {
        await navigator.clipboard?.writeText(msg)
        showToast('초청 메시지가 복사됐어요!')
      }
    } catch (e) { /* 사용자 취소 */ }
  }

  const genPrayer = async () => {
    if (!selOikos) return
    setPState('loading')
    const styleMap = {
      short:'짧고 간결한 1~2분 묵상기도', deep:'깊고 풍성한 5분 중보기도',
      thanks:'감사와 찬양으로 시작하는 기도', verse:'성경 구절을 인용하는 기도',
    }
    try {
      const res = await fetch('/api/prayer', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt:
          '다음 사람을 위한 한국 교회 성도의 기도문을 써주세요.\n' +
          '이름: ' + selOikos.name + ' / 관계: ' + selOikos.relation + ' / 전도 단계: ' + selOikos.stage + '\n' +
          '기도제목: ' + (selOikos.topics||[]).join(', ') + '\n' +
          (selOikos.notes ? '메모: ' + selOikos.notes + '\n' : '') +
          '스타일: ' + styleMap[pStyle] + '\n' +
          '조건: "하늘에 계신 아버지 하나님"으로 시작, "예수님의 이름으로 기도합니다 아멘"으로 마무리, 이름을 친근하게 부르기, 200~300자, 기도문만 출력'
        }),
      })
      const data = await res.json()
      setPResult(data?.text || '기도문 생성에 실패했습니다.')
      setPState('result')
    } catch (e) {
      setPResult('네트워크 오류가 발생했습니다.\n\n' + (e?.message || '') + '\n\n인터넷 연결을 확인하고 다시 시도해주세요.')
      setPState('result')
    }
  }

  // ── 홈 ────────────────────────────────────────────────────────
  const Home = () => (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div style={{ background:navy, padding:'16px 20px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <span style={{ fontSize:12, color:'#AFA9EC' }}>{displaySub} {displayRole}</span>
              {displayCode && (
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.08)', borderRadius:6, padding:'1px 6px' }}>· {displayCode}</span>
              )}
            </div>
            <div style={{ fontSize:19, fontWeight:700, color:'#fff', lineHeight:1.35 }}>
              <span style={{ color:'#9FE1CB' }}>{displayName}</span>님,<br />오늘도 기도해요 🙏
            </div>
          </div>
          <Btn onClick={signOut} style={{ background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'5px 12px', fontSize:11, color:'#AFA9EC' }}>로그아웃</Btn>
        </div>
        <div style={{ display:'flex', gap:8, margin:'12px 0' }}>
          {[{icon:'🔥',label:'연속 기도',val:totalStreak+'일'},{icon:'🙏',label:'오늘 기도',val:prayedCount+'/'+oikosList.length}].map((c,i)=>(
            <div key={i} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.1)',borderRadius:20,padding:'5px 10px' }}>
              <span style={{ fontSize:13 }}>{c.icon}</span>
              <span style={{ fontSize:12,color:'#fff' }}>{c.label}</span>
              <span style={{ fontSize:14,fontWeight:700,color:'#9FE1CB' }}>{c.val}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {['주','월','화','수','목','금','토'].map((d,i)=>{
            // 주일(일요일)=0 부터 시작. i=0(주일)~6(토)
            const date=new Date(), dow=date.getDay(), diff=i-dow
            date.setDate(date.getDate()+diff)
            const ds=localYMD(date), td=localYMD()
            const done=prayerLogs.some(l=>l.prayed_at===ds), isT=ds===td
            return (
              <div key={i} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}>
                <span style={{ fontSize:9,color: i===0 ? 'rgba(240,153,123,0.9)' : 'rgba(255,255,255,0.4)' }}>{d}</span>
                <div style={{ width:26,height:26,borderRadius:'50%',background:done?'#5DCAA5':isT?purple:'rgba(255,255,255,0.08)',border:isT&&!done?'2px solid #9FE1CB':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#fff' }}>
                  {done?'✓':isT?'★':''}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {todayOikos ? (
        <>
          {/* 오늘의 기도 대상 — 전체 스와이프 캐러셀 */}
          <div style={{ padding:'14px 0 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 16px', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#444441' }}>오늘의 기도 대상</div>
              <div style={{ fontSize:11, fontWeight:700, color: prayedCount===oikosList.length ? '#0F6E56' : '#888780' }}>
                {prayedCount===oikosList.length ? '🎉 오늘 모두 완료!' : prayedCount+'/'+oikosList.length+' 완료'}
              </div>
            </div>
            <div style={{ display:'flex', overflowX:'auto', scrollSnapType:'x mandatory', gap:10, padding:'0 16px', WebkitOverflowScrolling:'touch' }}>
              {oikosList.map((o,i)=>{
                const prayed = prayedToday(prayerLogs, o.id)
                return (
                  <div key={o.id} style={{ scrollSnapAlign:'start', flexShrink:0, width:'85%', background:prayed?'#3DAE8A':purple, borderRadius:18, padding:16, transition:'background 0.3s' }}>
                    <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:10 }}>
                      <Av name={o.name} ci={i} size={48} />
                      <div onClick={()=>openEdit(o, i)} style={{ flex:1, minWidth:0, cursor:'pointer' }}>
                        <div style={{ fontSize:15, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', gap:5 }}>
                          {o.name}
                          <span style={{ fontSize:11, opacity:0.7 }}>✏️</span>
                        </div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', marginTop:1 }}>{o.relation} · Day {o.day_in_challenge||1}</div>
                      </div>
                      <SPill stage={o.stage} />
                    </div>
                    <div style={{ minHeight:36, marginBottom:12 }}>
                      {(o.topics||[]).slice(0,2).map((t,j)=>(
                        <div key={j} style={{ fontSize:12, color:'rgba(255,255,255,0.85)', lineHeight:1.55 }}>· {t}</div>
                      ))}
                      {(!o.topics || o.topics.length===0) && (
                        <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>기도제목을 추가해보세요</div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <Btn onClick={()=>handlePrayed(o.id)}
                        style={{ flex:1, height:42, background:prayed?'rgba(255,255,255,0.22)':'#fff', borderRadius:12, fontSize:13, fontWeight:700, color:prayed?'#fff':purple, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        {prayed ? '✓ 오늘 기도 완료' : '🙏 기도했어요'}
                      </Btn>
                      <Btn onClick={()=>openPrayer(o.id)} style={{ width:42, height:42, background:'rgba(255,255,255,0.18)', borderRadius:12, fontSize:16, color:'#fff' }}>✨</Btn>
                      <Btn onClick={()=>openMsg(o)} style={{ width:42, height:42, background:'rgba(255,255,255,0.18)', borderRadius:12, fontSize:16, color:'#fff' }}>💬</Btn>
                    </div>
                  </div>
                )
              })}
            </div>
            {oikosList.length > 1 && (
              <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:12 }}>
                {oikosList.map((o,i)=>(
                  <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:prayedToday(prayerLogs,o.id)?'#5DCAA5':'#d3d1c7', transition:'background 0.3s' }} />
                ))}
              </div>
            )}
            <div style={{ textAlign:'center', fontSize:10, color:'#B4B2A9', marginTop:6 }}>
              ← 옆으로 넘기며 {oikosList.length}명 모두 기도해요 →
            </div>
          </div>

          {/* 빠른 도구 */}
          <div style={{ padding:'16px 16px 0' }}>
            <div style={{ fontSize:12,fontWeight:700,color:'#444441',marginBottom:8 }}>빠른 도구</div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[
                { icon:'☕', label:'기프티콘',   desc:'카카오 선물하기',        bg:'#E1F5EE', fn:()=>openGift(todayOikos) },
                { icon:'✉️', label:'초청장 공유', desc:FESTIVAL_NAME, bg:'#FAECE7', fn:handleInviteShare },
              ].map((a,i)=>(
                <div key={i} onClick={a.fn} style={{ background:'#fff',border:'0.5px solid #d3d1c7',borderRadius:14,padding:'13px 12px',cursor:'pointer' }}>
                  <div style={{ width:34,height:34,borderRadius:10,background:a.bg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8,fontSize:18 }}>{a.icon}</div>
                  <div style={{ fontSize:12,fontWeight:700,color:navy,marginBottom:2 }}>{a.label}</div>
                  <div style={{ fontSize:10,color:'#888780' }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding:'48px 20px',textAlign:'center' }}>
          <div style={{ fontSize:40,marginBottom:12 }}>🙏</div>
          <div style={{ fontSize:16,fontWeight:700,color:navy,marginBottom:8 }}>오이코스를 등록해보세요</div>
          <div style={{ fontSize:13,color:'#888780',lineHeight:1.6 }}>아래 + 버튼으로 첫 번째 오이코스를 추가해요</div>
        </div>
      )}

      {oikosList.length > 0 && (
        <div style={{ margin:'14px 16px 16px',background:navy,borderRadius:16,padding:'14px 16px' }}>
          <div style={{ fontSize:12,fontWeight:700,color:'#fff',marginBottom:10 }}>4주 챌린지 진행</div>
          {oikosList.map(o=>{
            const pct=Math.round(((o.day_in_challenge||1)/30)*100)
            return (
              <div key={o.id} style={{ display:'flex',gap:8,alignItems:'center',marginBottom:7 }}>
                <span style={{ fontSize:11,color:'#AFA9EC',width:36,flexShrink:0 }}>{o.name.slice(0,2)}</span>
                <div style={{ flex:1,height:6,background:'rgba(255,255,255,0.1)',borderRadius:3,overflow:'hidden' }}>
                  <div style={{ width:pct+'%',height:6,background:SM[o.stage]?.bar||'#7F77DD',borderRadius:3 }} />
                </div>
                <span style={{ fontSize:10,color:'#9FE1CB',fontWeight:700,width:28,textAlign:'right' }}>{pct}%</span>
              </div>
            )
          })}
          <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.1)',paddingTop:8,marginTop:4,display:'flex',justifyContent:'space-between' }}>
            <span style={{ fontSize:11,color:'#AFA9EC' }}>{FESTIVAL_NAME} <span style={{ color:'#9FE1CB',fontWeight:700 }}>{festLabel()}</span></span>
            <span style={{ fontSize:11,color:'#AFA9EC' }}>평균 <span style={{ color:'#9FE1CB',fontWeight:700 }}>{oikosList.length?Math.round(oikosList.reduce((s,o)=>s+(o.day_in_challenge||1),0)/oikosList.length/30*100):0}%</span></span>
          </div>
        </div>
      )}
    </div>
  )

  // ── 목록 ──────────────────────────────────────────────────────
  const List = () => {
    const filtered = stageF==='전체' ? oikosList : oikosList.filter(o=>o.stage===stageF)
    return (
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
        <div style={{ background:navy,padding:'14px 20px 14px',flexShrink:0 }}>
          <div style={{ fontSize:18,fontWeight:700,color:'#fff',marginBottom:10 }}>나의 오이코스</div>
          <div style={{ display:'flex',gap:6,overflowX:'auto',paddingBottom:2 }}>
            {['전체',...STAGES].map(f=>{
              const cnt=f==='전체'?oikosList.length:oikosList.filter(o=>o.stage===f).length
              return <div key={f} onClick={()=>setStageF(f)} style={{ flexShrink:0,background:stageF===f?'#9FE1CB':'rgba(255,255,255,0.1)',borderRadius:20,padding:'5px 12px',fontSize:11,fontWeight:700,color:stageF===f?'#085041':'#AFA9EC',cursor:'pointer' }}>{f} {cnt}</div>
            })}
          </div>
        </div>
        <div style={{ flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:8 }}>
          {filtered.map((o,idx)=>{
            const bar=SM[o.stage]?.bar||'#7F77DD', da=getDA(o.day_in_challenge||1), streak=calcStreak(prayerLogs,o.id)
            return (
              <div key={o.id} style={{ background:'#fff',borderTop:'0.5px solid #d3d1c7',borderRight:'0.5px solid #d3d1c7',borderBottom:'0.5px solid #d3d1c7',borderLeft:'3px solid '+bar,borderRadius:'0 14px 14px 0',padding:'12px 14px',display:'flex',gap:10,alignItems:'center' }}>
                <Av name={o.name} ci={idx} size={42} />
                <div onClick={()=>openEdit(o, idx)} style={{ flex:1,minWidth:0,cursor:'pointer' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                    <span style={{ fontSize:13,fontWeight:700,color:navy }}>{o.name}</span>
                    <span style={{ fontSize:10,opacity:0.5 }}>✏️</span>
                    <span style={{ fontSize:10,color:'#888780',background:'#f1efe8',borderRadius:10,padding:'1px 6px' }}>{o.relation}</span>
                  </div>
                  <div style={{ fontSize:11,color:'#888780' }}>기도 {streak}일 · Day {o.day_in_challenge||1}</div>
                  <div style={{ display:'flex',alignItems:'center',gap:4,marginTop:3 }}>
                    <span style={{ fontSize:11 }}>{da.icon}</span>
                    <span style={{ fontSize:10,color:'#888780' }}>{da.title}</span>
                  </div>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end' }}>
                  <SPill stage={o.stage} />
                  <div style={{ display:'flex',gap:4 }}>
                    <div onClick={()=>openPrayer(o.id)} style={{ width:28,height:28,borderRadius:'50%',background:'#EEEDFE',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:13 }}>✨</div>
                    <div onClick={()=>openMsg(o)} style={{ width:28,height:28,borderRadius:'50%',background:'#FEE500',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:13 }}>💬</div>
                    <div onClick={()=>setDelTarget(o)} style={{ width:28,height:28,borderRadius:'50%',background:'#FFECEC',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:13 }}>🗑</div>
                  </div>
                </div>
              </div>
            )
          })}
          <div onClick={()=>setOverlay('add')} style={{ border:'0.5px dashed #B4B2A9',borderRadius:14,padding:14,display:'flex',alignItems:'center',justifyContent:'center',gap:6,cursor:'pointer' }}>
            <span style={{ fontSize:16,color:'#888780' }}>+</span>
            <span style={{ fontSize:12,color:'#888780',fontWeight:500 }}>오이코스 추가하기</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 현황 ──────────────────────────────────────────────────────
  const Stats = () => (
    <div style={{ flex:1,overflowY:'auto' }}>
      <div style={{ background:navy,padding:'14px 20px 20px' }}>
        <div style={{ fontSize:18,fontWeight:700,color:'#fff' }}>주간 현황</div>
        <div style={{ fontSize:12,color:'#AFA9EC',marginTop:2 }}>{FESTIVAL_NAME} {festLabel()}</div>
      </div>
      <div style={{ padding:'14px 16px',display:'flex',flexDirection:'column',gap:12 }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
          {[
            { num:totalStreak,        label:'연속 기도일', color:purple    },
            { num:oikosList.length,   label:'오이코스 수', color:'#0F6E56' },
            { num:prayedCount,        label:'오늘 기도',   color:'#BA7517' },
            { num:oikosList.filter(o=>o.stage==='초청준비').length, label:'초청 준비됨', color:'#D4537E' },
          ].map((s,i)=>(
            <div key={i} style={{ background:'#fff',border:'0.5px solid #d3d1c7',borderRadius:12,padding:12,textAlign:'center' }}>
              <div style={{ fontSize:28,fontWeight:700,color:s.color }}>{s.num}</div>
              <div style={{ fontSize:10,color:'#888780',marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'#fff',border:'0.5px solid #d3d1c7',borderRadius:14,padding:14 }}>
          <div style={{ fontSize:12,fontWeight:700,color:navy,marginBottom:10 }}>오이코스별 진행률</div>
          {oikosList.map(o=>{
            const pct=Math.round(((o.day_in_challenge||1)/30)*100), bar=SM[o.stage]?.bar||'#7F77DD'
            return (
              <div key={o.id} style={{ marginBottom:12 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <span style={{ fontSize:12,fontWeight:700,color:navy }}>{o.name}</span>
                    <SPill stage={o.stage} />
                  </div>
                  <div style={{ display:'flex',gap:4 }}>
                    {STAGES.map(s=>(
                      <div key={s} onClick={()=>handleStageChange(o.id,s)}
                        style={{ fontSize:9,padding:'2px 5px',borderRadius:6,background:o.stage===s?SM[s].bg:'#f1efe8',color:o.stage===s?SM[s].cl:'#888780',cursor:'pointer',fontWeight:o.stage===s?700:400 }}>
                        {s.slice(0,2)}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ height:6,background:'#f1efe8',borderRadius:3,overflow:'hidden' }}>
                  <div style={{ width:pct+'%',height:6,background:bar,borderRadius:3 }} />
                </div>
              </div>
            )
          })}
        </div>
        {/* 내 프로필 코드 확인 */}
        <div style={{ background:'#fff',border:'0.5px solid #d3d1c7',borderRadius:14,padding:14,display:'flex',alignItems:'center',gap:12 }}>
          <div style={{ width:42,height:42,borderRadius:12,background:'#EEEDFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>👤</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13,fontWeight:700,color:navy }}>{displaySub} {displayRole} {displayName}</div>
            <div style={{ fontSize:11,color:'#888780',marginTop:2 }}>내 코드 <span style={{ fontWeight:700,color:purple }}>{displayCode}</span> · 동명이인 구분용</div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── AI 기도문 오버레이 ─────────────────────────────────────────
  const PrayerOv = () => {
    const swipe = useSwipeBack(() => { setOverlay(null); setPState('select'); setPResult('') })
    return (
      <div style={{ position:'absolute',top:0,left:0,right:0,bottom:0,background:'#f7f5f0',zIndex:100,display:'flex',flexDirection:'column' }} {...swipe}>
        <div style={{ display:'flex',alignItems:'center',gap:10,padding:'14px 18px 10px',borderBottom:'0.5px solid #d3d1c7',flexShrink:0 }}>
          <Btn onClick={()=>{setOverlay(null);setPState('select');setPResult('')}} style={{ width:30,height:30,borderRadius:'50%',background:'#e8e5de',display:'flex',alignItems:'center',justifyContent:'center' }}>←</Btn>
          <span style={{ fontSize:15,fontWeight:700,color:navy,flex:1 }}>AI 기도문 생성</span>
          {pState==='result'&&<Btn onClick={()=>{setPState('select');setPResult('')}} style={{ fontSize:12,color:purple,background:'none' }}>다시 선택</Btn>}
        </div>
        {pState==='select'&&(
          <div style={{ flex:1,overflowY:'auto' }}>
            <div style={{ display:'flex',gap:12,padding:'14px 18px',overflowX:'auto' }}>
              {oikosList.map((o,i)=>{ const [bg,cl]=AVC[i%AVC.length], s=selId===o.id; return (
                <div key={o.id} onClick={()=>setSelId(o.id)} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer',flexShrink:0 }}>
                  <div style={{ width:48,height:48,borderRadius:'50%',background:bg,color:cl,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,border:'2px solid '+(s?purple:'transparent') }}>{o.name.slice(0,2)}</div>
                  <span style={{ fontSize:10,fontWeight:700,color:s?purple:'#444441' }}>{o.name.slice(0,3)}</span>
                </div>
              )})}
            </div>
            {selOikos&&(
              <div style={{ margin:'0 18px 14px',background:'#fff',border:'0.5px solid #d3d1c7',borderRadius:16,padding:14 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
                  <Av name={selOikos.name} ci={oikosList.indexOf(selOikos)} size={36} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:navy }}>{selOikos.name}</div>
                    <div style={{ fontSize:10,color:'#888780' }}>{selOikos.relation} · 기도 {calcStreak(prayerLogs,selOikos.id)}일째</div>
                  </div>
                  <SPill stage={selOikos.stage} />
                </div>
                {(selOikos.topics||[]).map((t,i)=>(
                  <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:6,background:'#f7f5f0',borderRadius:8,padding:'7px 10px',marginBottom:5 }}>
                    <div style={{ width:5,height:5,borderRadius:'50%',background:'#7F77DD',marginTop:5,flexShrink:0 }} />
                    <span style={{ fontSize:12,color:'#444441',lineHeight:1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding:'0 18px 14px' }}>
              <div style={{ fontSize:11,fontWeight:700,color:'#444441',marginBottom:8 }}>기도문 스타일</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6 }}>
                {PSTYLES.map(s=>(
                  <div key={s.id} onClick={()=>setPStyle(s.id)} style={{ background:pStyle===s.id?'#EEEDFE':'#fff',border:'0.5px solid '+(pStyle===s.id?'#7F77DD':'#d3d1c7'),borderRadius:10,padding:'9px 10px',cursor:'pointer' }}>
                    <div style={{ fontSize:12,fontWeight:700,color:pStyle===s.id?'#3C3489':navy,marginBottom:2 }}>{s.l}</div>
                    <div style={{ fontSize:10,color:'#888780' }}>{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'0 18px 20px' }}>
              <Btn onClick={genPrayer} style={{ width:'100%',height:48,background:purple,borderRadius:14,color:'#fff',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                ✨ 기도문 생성하기
              </Btn>
            </div>
          </div>
        )}
        {pState==='loading'&&(
          <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40 }}>
            <div style={{ width:80,height:80,borderRadius:'50%',background:'#EEEDFE',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20,fontSize:36 }}>✨</div>
            <div style={{ fontSize:17,fontWeight:700,color:navy,marginBottom:8,textAlign:'center',lineHeight:1.4 }}>{selOikos?.name}을(를) 위한<br />기도문을 만들고 있어요</div>
            <div style={{ fontSize:12,color:'#888780',textAlign:'center',lineHeight:1.7 }}>기도제목과 관계 단계를 분석해<br />맞춤 기도문을 작성 중이에요</div>
          </div>
        )}
        {pState==='result'&&(
          <div style={{ flex:1,overflowY:'auto',padding:'14px 18px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
              <div style={{ display:'flex',alignItems:'center',gap:4,background:'#EEEDFE',borderRadius:20,padding:'5px 10px' }}>
                <span style={{ fontSize:11,fontWeight:700,color:'#3C3489' }}>✨ AI 생성 완료</span>
              </div>
              <Btn onClick={()=>{navigator.clipboard?.writeText(pResult);showToast('복사됐어요')}} style={{ width:30,height:30,borderRadius:'50%',background:'#fff',border:'0.5px solid #d3d1c7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>📋</Btn>
            </div>
            <div style={{ background:'#fff',border:'0.5px solid #d3d1c7',borderRadius:16,padding:16,marginBottom:14 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12,paddingBottom:10,borderBottom:'0.5px solid #e8e5de' }}>
                {selOikos&&<Av name={selOikos.name} ci={oikosList.indexOf(selOikos)} size={32} />}
                <div><div style={{ fontSize:10,color:'#888780' }}>을 위한 기도</div><div style={{ fontSize:13,fontWeight:700,color:navy }}>{selOikos?.name}</div></div>
              </div>
              <div style={{ fontFamily:"'Noto Serif KR',serif",fontSize:13,color:'#2C2C2A',lineHeight:1.95,whiteSpace:'pre-wrap' }}>{pResult}</div>
            </div>
            <div style={{ background:'#fff',border:'0.5px solid #d3d1c7',borderRadius:16,padding:'13px 14px',marginBottom:20 }}>
              <div style={{ fontSize:12,fontWeight:700,color:navy,marginBottom:10 }}>기도 후, 바로 연결하기</div>
              {selOikos&&[
                { icon:'💬', bg:'#FEE500', name:'안부 메시지 선택', sub:'다양한 문구에서 고르기', fn:()=>openMsg(selOikos) },
                { icon:'☕', bg:'#E1F5EE', name:'기프티콘 보내기', sub:'카카오 선물하기 열기', fn:()=>openGift(selOikos) },
                { icon:'✉️', bg:'#FAECE7', name:'초청장 공유하기', sub:FESTIVAL_NAME+' 초대', fn:handleInviteShare },
              ].map((a,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:i<2?'0.5px solid #f1efe8':'none' }}>
                  <div style={{ width:32,height:32,borderRadius:9,background:a.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>{a.icon}</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:12,fontWeight:700,color:navy }}>{a.name}</div><div style={{ fontSize:10,color:'#888780' }}>{a.sub}</div></div>
                  <Btn onClick={a.fn} style={{ fontSize:11,fontWeight:700,borderRadius:20,padding:'5px 12px',background:a.bg,color:navy }}>이동</Btn>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 렌더 ──────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Noto Sans KR',sans-serif",background:'#f7f5f0',height:'100dvh',maxWidth:420,margin:'0 auto',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400;700&display=swap');
        *{box-sizing:border-box;}
        input:focus,textarea:focus{border-color:#534AB7!important;box-shadow:0 0 0 2px #EEEDFE;}
        ::-webkit-scrollbar{width:0;height:0;}
      `}</style>

      {dataLoading ? (
        <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ fontSize:13,color:'#888780' }}>불러오는 중...</div>
        </div>
      ) : (
        <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
          {tab==='home'  && <Home />}
          {tab==='list'  && <List />}
          {tab==='stats' && <Stats />}
        </div>
      )}

      {/* 하단 네비게이션 */}
      <div style={{ flexShrink:0,height:58,background:'#f7f5f0',borderTop:'0.5px solid #d3d1c7',display:'flex',alignItems:'center',justifyContent:'space-around' }}>
        {[
          { id:'home',  icon:'🏠', label:'홈' },
          { id:'list',  icon:'👥', label:'오이코스' },
          { id:'fab' },
          { id:'prayer',icon:'🙏', label:'기도' },
          { id:'stats', icon:'📊', label:'현황' },
        ].map(n => n.id==='fab' ? (
          <div key="fab" onClick={()=>setOverlay('add')} style={{ width:46,height:46,borderRadius:'50%',background:purple,display:'flex',alignItems:'center',justifyContent:'center',marginTop:-18,cursor:'pointer',fontSize:22,color:'#fff' }}>+</div>
        ) : (
          <div key={n.id} onClick={()=>n.id==='prayer'?openPrayer(oikosList[0]?.id):setTab(n.id)}
            style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',padding:'4px 8px',opacity:tab===n.id?1:0.4 }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <span style={{ fontSize:9,fontWeight:700,color:tab===n.id?purple:'#888780' }}>{n.label}</span>
          </div>
        ))}
      </div>

      {/* 오버레이 */}
      {overlay==='add' && (
        <AddOverlay userId={userId} onClose={()=>setOverlay(null)}
          onAdded={(name)=>{ loadData(); setTab('list'); showToast(name+'님이 등록되었어요 🙏') }} />
      )}
      {overlay==='prayer' && <PrayerOv />}
      {overlay==='message' && msgTarget && (
        <MessageSelectOverlay oikos={msgTarget} onClose={()=>{ setOverlay(null); setMsgTarget(null) }} />
      )}

      {editTarget && (
        <EditTopicsOverlay
          oikos={editTarget}
          onClose={()=>setEditTarget(null)}
          onSaved={()=>{ loadData(); showToast('기도제목이 수정됐어요 🙏') }}
        />
      )}

      {/* 삭제 확인 */}
      {deleteTarget && (
        <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'flex-end' }}>
          <div style={{ background:'#fff',width:'100%',borderRadius:'24px 24px 0 0',padding:'28px 20px 36px' }}>
            <div style={{ fontSize:16,fontWeight:700,color:navy,marginBottom:8 }}>{deleteTarget.name}님을 삭제하시겠어요?</div>
            <div style={{ fontSize:13,color:'#888780',marginBottom:24,lineHeight:1.6 }}>삭제된 오이코스와 기도 기록은<br />복구할 수 없어요.</div>
            <div style={{ display:'flex',gap:10 }}>
              <Btn onClick={()=>setDelTarget(null)} style={{ flex:1,height:48,background:'#f1efe8',borderRadius:12,fontWeight:700,fontSize:15,color:'#888780' }}>취소</Btn>
              <Btn onClick={handleDelete} style={{ flex:1,height:48,background:'#D85A30',borderRadius:12,fontWeight:700,fontSize:15,color:'#fff' }}>삭제</Btn>
            </div>
          </div>
   
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{ position:'absolute',bottom:72,left:'50%',transform:'translateX(-50%)',background:navy,color:'#fff',fontSize:13,fontWeight:500,padding:'10px 18px',borderRadius:20,whiteSpace:'nowrap',zIndex:200,maxWidth:'80%',textAlign:'center' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
