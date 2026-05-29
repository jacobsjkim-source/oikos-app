'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabase, signInAnon, signOut,
  fetchOikos, createOikos, updateOikos,
  fetchPrayerLogs, logPrayer, logAction,
  fetchProfile, saveProfile,
  calcStreak, calcTotalStreak, prayedToday,
  savePushSub, subscribeOikos,
} from '../lib/supabase'

// ── 상수 ──────────────────────────────────────────────────────
const STAGES = ['관심없음','호기심','열린마음','초청준비']
const SM = {
  관심없음:{ bg:'#FAEEDA', cl:'#633806', bar:'#EF9F27' },
  호기심:  { bg:'#E1F5EE', cl:'#085041', bar:'#5DCAA5' },
  열린마음:{ bg:'#EEEDFE', cl:'#3C3489', bar:'#7F77DD' },
  초청준비:{ bg:'#FAECE7', cl:'#712B13', bar:'#F0997B' },
}
const RELS = ['가족','친구','직장동료','이웃','학교','기타']
const AVC  = [['#EEEDFE','#3C3489'],['#E1F5EE','#085041'],['#FAEEDA','#633806'],
               ['#FBEAF0','#72243E'],['#EAF3DE','#27500A'],['#FAECE7','#712B13']]
const PSTYLES = [
  { id:'short',  l:'짧은 묵상기도', d:'1~2분 · 핵심만' },
  { id:'deep',   l:'깊은 중보기도', d:'5분 · 풍성한 간구' },
  { id:'thanks', l:'감사와 찬양',   d:'은혜로 시작' },
  { id:'verse',  l:'성경 구절 포함', d:'말씀으로 묶기' },
]
const DAY_ACTIONS = [
  { until:3,  title:'짧은 안부 보내기',    icon:'💬', msg:'안녕하세요! 잘 지내시죠? 😊' },
  { until:7,  title:'커피 기프티콘 보내기', icon:'☕', msg:'작은 선물 드려요, 커피 한 잔 하세요 ☕' },
  { until:14, title:'함께 식사 약속',       icon:'🍽', msg:'요즘 어떻게 지내세요? 같이 밥 한 번 해요 😊' },
  { until:21, title:'간증 영상 공유',       icon:'🎬', msg:'좋은 영상 하나 봤는데 보내드려도 될까요?' },
  { until:30, title:'전도축제 초청',         icon:'✉️', msg:'저희 교회 행사에 함께하실 수 있으세요? 🙏' },
]
const getDA = (day) => DAY_ACTIONS.find(a => day <= a.until) || DAY_ACTIONS[4]

// 교회 구조
const CHURCH = {
  교구: {
    icon: '⛪',
    desc: '1~12교구',
    groups: Array.from({length:12}, (_,i) => `${i+1}교구`),
    roles: ['장로','권사','집사','성도'],
  },
  청년교구: {
    icon: '🙌',
    desc: '1~3청년교구',
    groups: ['1청년교구','2청년교구','3청년교구'],
    roles: null,
  },
  교육부: {
    icon: '📚',
    desc: '영아부~고등부',
    groups: ['영아부','유아부','유치부','유년부','초등부','소년부','중등부','고등부'],
    roles: null,
  },
}

const navy = '#1a1a2e', purple = '#534AB7'

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

// ── 한글 IME 지원 ──────────────────────────────────────────────
function KrInput({ value, onChange, style={}, ...p }) {
  const c = useRef(false)
  return <input value={value}
    onCompositionStart={()=>{ c.current=true }}
    onCompositionEnd={(e)=>{ c.current=false; onChange(e.target.value) }}
    onChange={(e)=>{ if(!c.current) onChange(e.target.value) }}
    style={style} {...p} />
}
function KrTextarea({ value, onChange, style={}, ...p }) {
  const c = useRef(false)
  return <textarea value={value}
    onCompositionStart={()=>{ c.current=true }}
    onCompositionEnd={(e)=>{ c.current=false; onChange(e.target.value) }}
    onChange={(e)=>{ if(!c.current) onChange(e.target.value) }}
    style={style} {...p} />
}

// ══════════════════════════════════════════════════════════════
export default function Page() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session)
        const { data: prof } = await fetchProfile(data.session.user.id)
        setProfile(prof)
      }
      setLoading(false)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange(async (_, s) => {
      setSession(s)
      if (s) {
        const { data: prof } = await fetchProfile(s.user.id)
        setProfile(prof)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <Center>불러오는 중...</Center>

  // 세션은 있지만 이름 미등록 → 프로필 설정
  const needsProfile = session && (!profile?.display_name || !profile?.church_group)

  if (!session || needsProfile) return (
    <RegisterScreen
      session={session}
      onDone={async (s, prof) => { setSession(s); setProfile(prof) }}
    />
  )

  return <OikosApp session={session} profile={profile} setProfile={setProfile} />
}

const Center = ({ children }) => (
  <div style={{ height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f7f5f0',fontFamily:"'Noto Sans KR',sans-serif",fontSize:14,color:'#888780' }}>{children}</div>
)

// ══════════════════════════════════════════════════════════════
// 교회 등록 화면
// ══════════════════════════════════════════════════════════════
function RegisterScreen({ session, onDone }) {
  const [step, setStep]       = useState(1)       // 1: 교구 선택, 2: 상세, 3: 완료
  const [dept, setDept]       = useState('')       // 교구/청년교구/교육부
  const [group, setGroup]     = useState('')       // 1교구, 영아부...
  const [name, setName]       = useState('')
  const [role, setRole]       = useState('성도')  // 직분
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')

  const deptInfo = CHURCH[dept] || null

  const handleComplete = async () => {
    if (!name.trim() || !group) return
    setLoading(true)

    // 세션 없으면 익명 로그인
    let s = session
    if (!s) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) { setMsg('오류가 발생했습니다.'); setLoading(false); return }
      s = data.session
    }

    // 프로필 저장
    const profileData = {
      display_name: name.trim(),
      church_dept:  dept,
      church_group: group,
      church_role:  dept === '교구' ? role : null,
    }
    await saveProfile(s.user.id, profileData)
    onDone(s, { ...profileData, id: s.user.id })
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:navy, fontFamily:"'Noto Sans KR',sans-serif", display:'flex', flexDirection:'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap'); *{box-sizing:border-box;} input::placeholder{color:rgba(255,255,255,0.35);}`}</style>

      {/* 헤더 */}
      <div style={{ padding:'40px 24px 24px', textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:700, color:'#fff', marginBottom:4 }}>오이코스 전도 프로그램</div>
        <div style={{ fontSize:13, color:'#AFA9EC' }}>소중한 한 영혼을 위한 30일 기도 여정</div>
      </div>

      {/* 진행 표시 */}
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:28 }}>
        {[1,2].map(i => (
          <div key={i} style={{ width: step > i ? 32 : step === i ? 32 : 8, height:8, borderRadius:4, background: step >= i ? '#9FE1CB' : 'rgba(255,255,255,0.15)', transition:'all 0.3s' }} />
        ))}
      </div>

      <div style={{ flex:1, padding:'0 24px 40px', display:'flex', flexDirection:'column' }}>

        {/* STEP 1: 교구 선택 */}
        {step === 1 && (
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:6 }}>어디 소속이세요?</div>
            <div style={{ fontSize:13, color:'#AFA9EC', marginBottom:24 }}>해당하는 곳을 선택해주세요</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.entries(CHURCH).map(([key, val]) => (
                <div key={key} onClick={() => { setDept(key); setGroup(''); setStep(2) }}
                  style={{ background:'rgba(255,255,255,0.08)', border:`1.5px solid ${dept===key?'#9FE1CB':'rgba(255,255,255,0.15)'}`, borderRadius:16, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.15s' }}>
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

        {/* STEP 2: 상세 선택 */}
        {step === 2 && deptInfo && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <Btn onClick={() => { setStep(1); setGroup('') }}
                style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:16 }}>←</Btn>
              <div style={{ fontSize:18, fontWeight:700, color:'#fff' }}>{dept} 등록</div>
            </div>

            {/* 그룹 선택 */}
            <div style={{ fontSize:12, fontWeight:700, color:'#AFA9EC', marginBottom:10 }}>
              {dept === '교구' ? '교구 선택' : dept === '청년교구' ? '청년교구 선택' : '부서 선택'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns: dept === '교구' ? 'repeat(4,1fr)' : 'repeat(3,1fr)', gap:6, marginBottom:20 }}>
              {deptInfo.groups.map(g => (
                <div key={g} onClick={() => setGroup(g)}
                  style={{ background: group===g ? '#9FE1CB' : 'rgba(255,255,255,0.08)', border:`1px solid ${group===g?'#9FE1CB':'rgba(255,255,255,0.15)'}`, borderRadius:10, padding:'10px 4px', fontSize:12, fontWeight:group===g?700:400, color:group===g?navy:'#fff', textAlign:'center', cursor:'pointer' }}>
                  {g}
                </div>
              ))}
            </div>

            {/* 직분 선택 (교구만) */}
            {dept === '교구' && (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:'#AFA9EC', marginBottom:10 }}>직분</div>
                <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
                  {deptInfo.roles.map(r => (
                    <div key={r} onClick={() => setRole(r)}
                      style={{ background: role===r ? '#9FE1CB' : 'rgba(255,255,255,0.08)', border:`1px solid ${role===r?'#9FE1CB':'rgba(255,255,255,0.15)'}`, borderRadius:20, padding:'8px 16px', fontSize:13, fontWeight:role===r?700:400, color:role===r?navy:'#fff', cursor:'pointer' }}>
                      {r}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 이름 입력 */}
            <div style={{ fontSize:12, fontWeight:700, color:'#AFA9EC', marginBottom:10 }}>이름</div>
            <KrInput value={name} onChange={setName} placeholder="홍길동"
              style={{ width:'100%', height:50, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:12, padding:'0 16px', fontSize:16, fontFamily:'inherit', outline:'none', color:'#fff', marginBottom:24 }} />

            {msg && <div style={{ fontSize:12, color:'#F0997B', marginBottom:12 }}>{msg}</div>}

            <Btn onClick={handleComplete}
              style={{ width:'100%', height:52, background: (name.trim()&&group) ? '#9FE1CB' : 'rgba(255,255,255,0.15)', borderRadius:14, fontSize:16, fontWeight:700, color: (name.trim()&&group) ? navy : 'rgba(255,255,255,0.3)', cursor:(name.trim()&&group)?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading ? '등록 중...' : `${group||'그룹 선택 후'} ${name||'이름 입력 후'} 시작하기 →`}
            </Btn>

            {name.trim() && group && (
              <div style={{ marginTop:14, padding:'12px 16px', background:'rgba(255,255,255,0.06)', borderRadius:12, fontSize:12, color:'#AFA9EC', textAlign:'center', lineHeight:1.8 }}>
                <span style={{ color:'#9FE1CB', fontWeight:700 }}>{group}</span> {dept==='교구'?role:''} <span style={{ color:'#fff', fontWeight:700 }}>{name}</span>님으로 등록돼요
              </div>
            )}
          </div>
        )}

        {/* 하단 로고 */}
        <div style={{ marginTop:'auto', paddingTop:40, textAlign:'center' }}>
          <img src="/logo.png" alt="하남교회" style={{ width:180, opacity:0.8 }} />
        </div>

      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 메인 앱
// ══════════════════════════════════════════════════════════════
function OikosApp({ session, profile, setProfile }) {
  const userId = session.user.id
  const [tab, setTab]         = useState('home')
  const [oikosList, setOikos] = useState([])
  const [prayerLogs, setLogs] = useState([])
  const [dataLoading, setDL]  = useState(true)
  const [overlay, setOverlay] = useState(null)
  const [selId, setSelId]     = useState(null)
  const [pState, setPState]   = useState('select')
  const [pStyle, setPStyle]   = useState('short')
  const [pResult, setPResult] = useState('')
  const [addStep, setAddStep] = useState(1)
  const [stageF, setStageF]   = useState('전체')
  const [toast, setToast]     = useState('')
  const [form, setForm]       = useState({ name:'', phone:'', rel:'친구', stage:'호기심', topics:'', notes:'' })

  const displayName = profile?.display_name || '성도'
  const displaySub  = [profile?.church_group, profile?.church_role].filter(Boolean).join(' ')

  const loadData = useCallback(async () => {
    setDL(true)
    const [{ data:oks }, { data:logs }] = await Promise.all([
      fetchOikos(userId), fetchPrayerLogs(userId, 60),
    ])
    setOikos(oks||[]); setLogs(logs||[])
    if ((oks||[]).length > 0 && !selId) setSelId(oks[0].id)
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

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2400) }
  const openPrayer = (id) => { setSelId(id); setPState('select'); setPResult(''); setOverlay('prayer') }
  const closeOverlay = () => {
    setOverlay(null); setAddStep(1)
    setForm({ name:'', phone:'', rel:'친구', stage:'호기심', topics:'', notes:'' })
  }

  const sendKakao = (oikos, msg) => {
    navigator.clipboard?.writeText(msg).catch(()=>{})
    const isM = /Android|iPhone|iPad/i.test(navigator.userAgent)
    if (isM) window.location.href = 'kakaotalk://launch'
    showToast('📋 메시지 복사됐어요! 카카오톡에 붙여넣어 보내세요')
    logAction(userId, oikos.id, 'message', msg)
  }
  const openGift = (oikos) => {
    window.open('https://gift.kakao.com', '_blank')
    logAction(userId, oikos.id, 'gift')
    showToast('카카오 선물하기로 연결됐어요')
  }
  const handlePrayed = async (id) => {
    await logPrayer(userId, id); await loadData(); showToast('기도 완료! 🙏')
  }
  const handleAddOikos = async () => {
    if (!form.name.trim()) return
    const { error } = await createOikos({
      user_id:userId, name:form.name, phone:form.phone, relation:form.rel,
      stage:form.stage, topics:form.topics.split('\n').filter(t=>t.trim()), notes:form.notes,
    })
    if (error) { showToast('저장 실패. 다시 시도해주세요.'); return }
    await loadData(); closeOverlay(); setTab('list')
    showToast(`${form.name}님이 등록되었어요 🙏`)
  }
  const handleStageChange = async (id, s) => {
    await updateOikos(id, { stage:s }); await loadData()
    showToast(`'${s}'로 변경됐어요`)
  }
  const genPrayer = async () => {
    if (!selOikos) return
    setPState('loading')
    const styleMap = { short:'짧고 간결한 1~2분 묵상기도', deep:'깊고 풍성한 5분 중보기도', thanks:'감사와 찬양으로 시작하는 기도', verse:'성경 구절을 인용하는 기도' }
    try {
      const res = await fetch('/api/prayer', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ prompt:
`다음 사람을 위한 한국 교회 성도의 기도문을 써주세요.
이름: ${selOikos.name} / 관계: ${selOikos.relation} / 전도 단계: ${selOikos.stage}
기도제목: ${(selOikos.topics||[]).join(', ')}
${selOikos.notes ? '메모: '+selOikos.notes : ''}
스타일: ${styleMap[pStyle]}
조건: "하늘에 계신 아버지 하나님"으로 시작, "예수님의 이름으로 기도합니다 아멘"으로 마무리, 이름 친근하게 부르기, 200~300자, 기도문만 출력` }),
      })
      const { text } = await res.json()
      setPResult(text); setPState('result')
    } catch { setPResult('오류가 발생했습니다. 다시 시도해주세요.'); setPState('result') }
  }

  // ── 홈 ────────────────────────────────────────────────────────
  const Home = () => (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div style={{ background:navy, padding:'16px 20px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div>
            <div style={{ fontSize:12, color:'#AFA9EC', marginBottom:2 }}>{displaySub}</div>
            <div style={{ fontSize:19, fontWeight:700, color:'#fff', lineHeight:1.35 }}>
              <span style={{ color:'#9FE1CB' }}>{displayName}</span>님,<br />오늘도 기도해요 🙏
            </div>
          </div>
          <Btn onClick={signOut} style={{ background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'5px 12px', fontSize:11, color:'#AFA9EC' }}>로그아웃</Btn>
        </div>
        <div style={{ display:'flex', gap:8, margin:'12px 0' }}>
          {[{ icon:'🔥', label:'연속 기도', val:`${totalStreak}일` }, { icon:'🙏', label:'오늘 기도', val:`${prayedCount}/${oikosList.length}` }].map((c,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'5px 10px' }}>
              <span style={{ fontSize:13 }}>{c.icon}</span>
              <span style={{ fontSize:12, color:'#fff' }}>{c.label}</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#9FE1CB' }}>{c.val}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {['월','화','수','목','금','토','주'].map((d,i) => {
            const date=new Date(), dow=date.getDay(), diff=i-(dow===0?6:dow-1)
            date.setDate(date.getDate()+diff)
            const ds=date.toISOString().split('T')[0], td=new Date().toISOString().split('T')[0]
            const done=prayerLogs.some(l=>l.prayed_at===ds), isT=ds===td
            return (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{d}</span>
                <div style={{ width:26, height:26, borderRadius:'50%', background:done?'#5DCAA5':isT?purple:'rgba(255,255,255,0.08)', border:isT&&!done?'2px solid #9FE1CB':'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff' }}>
                  {done?'✓':isT?'★':''}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {todayOikos ? (
        <>
          <div style={{ padding:'14px 16px 0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#444441', marginBottom:8 }}>오늘의 기도 대상</div>
            <div style={{ background:purple, borderRadius:16, padding:14, display:'flex', gap:12, alignItems:'center' }}>
              <Av name={todayOikos.name} ci={0} size={50} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{todayOikos.name}</div>
                <div style={{ fontSize:11, color:'#AFA9EC', marginTop:2, lineHeight:1.5 }}>{(todayOikos.topics||[]).slice(0,2).join(' · ')}</div>
              </div>
              <Btn onClick={()=>handlePrayed(todayOikos.id)}
                style={{ background:prayedToday(prayerLogs,todayOikos.id)?'#5DCAA5':'#9FE1CB', borderRadius:20, padding:'7px 11px', fontSize:11, fontWeight:700, color:'#085041', whiteSpace:'nowrap' }}>
                {prayedToday(prayerLogs,todayOikos.id)?'기도 완료 ✓':'기도했어요'}
              </Btn>
            </div>
          </div>
          <div style={{ padding:'14px 16px 0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#444441', marginBottom:8 }}>원클릭 액션</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { icon:'✨', label:'AI 기도문',  desc:'맞춤 기도문 생성',   bg:'#EEEDFE', ic:purple,    fn:()=>openPrayer(todayOikos.id) },
                { icon:'💬', label:'메시지 복사', desc:'카카오에 붙여넣기',  bg:'#FEE500', ic:navy,      fn:()=>sendKakao(todayOikos, getDA(todayOikos.day_in_challenge||1).msg) },
                { icon:'☕', label:'기프티콘',   desc:'카카오 선물하기',     bg:'#E1F5EE', ic:'#0F6E56', fn:()=>openGift(todayOikos) },
                { icon:'✉️', label:'초청장 복사', desc:'초청 메시지 복사',   bg:'#FAECE7', ic:'#993C1D', fn:()=>sendKakao(todayOikos,'저희 교회 전도축제에 함께하실 수 있으세요? 🙏') },
              ].map((a,i) => (
                <div key={i} onClick={a.fn} style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:14, padding:'13px 12px', cursor:'pointer' }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:a.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8, fontSize:18 }}>{a.icon}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:navy, marginBottom:2 }}>{a.label}</div>
                  <div style={{ fontSize:10, color:'#888780' }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ margin:'14px 16px 0' }}>
            {(() => { const da=getDA(todayOikos.day_in_challenge||1); return (
              <div style={{ background:'#fff', border:`1.5px solid ${SM[todayOikos.stage]?.bar||'#7F77DD'}`, borderRadius:14, padding:14, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:SM[todayOikos.stage]?.bg||'#EEEDFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{da.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:navy, marginBottom:2 }}>{da.title}</div>
                  <div style={{ fontSize:11, color:'#888780' }}>Day {todayOikos.day_in_challenge||1} · {todayOikos.name}님에게 딱 좋은 타이밍</div>
                </div>
                <Btn onClick={()=>sendKakao(todayOikos, da.msg)} style={{ background:purple, borderRadius:10, padding:'7px 12px', fontSize:11, fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>복사</Btn>
              </div>
            )})()}
          </div>
        </>
      ) : (
        <div style={{ padding:'48px 20px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🙏</div>
          <div style={{ fontSize:16, fontWeight:700, color:navy, marginBottom:8 }}>오이코스를 등록해보세요</div>
          <div style={{ fontSize:13, color:'#888780', lineHeight:1.6 }}>아래 + 버튼으로 첫 번째 오이코스를 추가해요</div>
        </div>
      )}

      {oikosList.length > 0 && (
        <div style={{ margin:'14px 16px 16px', background:navy, borderRadius:16, padding:'14px 16px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:10 }}>4주 챌린지 진행</div>
          {oikosList.map(o => {
            const pct=Math.round(((o.day_in_challenge||1)/30)*100)
            return (
              <div key={o.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:7 }}>
                <span style={{ fontSize:11, color:'#AFA9EC', width:36, flexShrink:0 }}>{o.name.slice(0,2)}</span>
                <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:pct+'%', height:6, background:SM[o.stage]?.bar||'#7F77DD', borderRadius:3 }} />
                </div>
                <span style={{ fontSize:10, color:'#9FE1CB', fontWeight:700, width:28, textAlign:'right' }}>{pct}%</span>
              </div>
            )
          })}
          <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.1)', paddingTop:8, marginTop:4, display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:'#AFA9EC' }}>전도축제까지 <span style={{ color:'#9FE1CB', fontWeight:700 }}>D-18</span></span>
            <span style={{ fontSize:11, color:'#AFA9EC' }}>평균 <span style={{ color:'#9FE1CB', fontWeight:700 }}>{oikosList.length?Math.round(oikosList.reduce((s,o)=>s+(o.day_in_challenge||1),0)/oikosList.length/30*100):0}%</span></span>
          </div>
        </div>
      )}
    </div>
  )

  // ── 목록 ──────────────────────────────────────────────────────
  const List = () => {
    const filtered = stageF==='전체' ? oikosList : oikosList.filter(o=>o.stage===stageF)
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ background:navy, padding:'14px 20px 14px', flexShrink:0 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:10 }}>나의 오이코스</div>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
            {['전체',...STAGES].map(f => {
              const cnt=f==='전체'?oikosList.length:oikosList.filter(o=>o.stage===f).length
              return <div key={f} onClick={()=>setStageF(f)} style={{ flexShrink:0, background:stageF===f?'#9FE1CB':'rgba(255,255,255,0.1)', borderRadius:20, padding:'5px 12px', fontSize:11, fontWeight:700, color:stageF===f?'#085041':'#AFA9EC', cursor:'pointer' }}>{f} {cnt}</div>
            })}
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map((o,idx) => {
            const bar=SM[o.stage]?.bar||'#7F77DD', da=getDA(o.day_in_challenge||1), streak=calcStreak(prayerLogs,o.id)
            return (
              <div key={o.id} style={{ background:'#fff', borderTop:'0.5px solid #d3d1c7', borderRight:'0.5px solid #d3d1c7', borderBottom:'0.5px solid #d3d1c7', borderLeft:`3px solid ${bar}`, borderRadius:'0 14px 14px 0', padding:'12px 14px', display:'flex', gap:10, alignItems:'center' }}>
                <Av name={o.name} ci={idx} size={42} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:navy }}>{o.name}</span>
                    <span style={{ fontSize:10, color:'#888780', background:'#f1efe8', borderRadius:10, padding:'1px 6px' }}>{o.relation}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#888780' }}>기도 {streak}일 · Day {o.day_in_challenge||1}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                    <span style={{ fontSize:11 }}>{da.icon}</span>
                    <span style={{ fontSize:10, color:'#888780' }}>{da.title}</span>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                  <SPill stage={o.stage} />
                  <div style={{ display:'flex', gap:4 }}>
                    <div onClick={()=>openPrayer(o.id)} style={{ width:28, height:28, borderRadius:'50%', background:'#EEEDFE', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:13 }}>✨</div>
                    <div onClick={()=>sendKakao(o, da.msg)} style={{ width:28, height:28, borderRadius:'50%', background:'#FEE500', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:13 }}>💬</div>
                  </div>
                </div>
              </div>
            )
          })}
          <div onClick={()=>setOverlay('add')} style={{ border:'0.5px dashed #B4B2A9', borderRadius:14, padding:14, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer' }}>
            <span style={{ fontSize:16, color:'#888780' }}>+</span>
            <span style={{ fontSize:12, color:'#888780', fontWeight:500 }}>오이코스 추가하기</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 현황 ──────────────────────────────────────────────────────
  const Stats = () => (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div style={{ background:navy, padding:'14px 20px 20px' }}>
        <div style={{ fontSize:18, fontWeight:700, color:'#fff' }}>주간 현황</div>
        <div style={{ fontSize:12, color:'#AFA9EC', marginTop:2 }}>{displaySub} {displayName}님</div>
      </div>
      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { num:totalStreak, label:'연속 기도일', color:purple },
            { num:oikosList.length, label:'오이코스 수', color:'#0F6E56' },
            { num:prayedCount, label:'오늘 기도', color:'#BA7517' },
            { num:oikosList.filter(o=>o.stage==='초청준비').length, label:'초청 준비됨', color:'#D4537E' },
          ].map((s,i) => (
            <div key={i} style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:12, padding:12, textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.num}</div>
              <div style={{ fontSize:10, color:'#888780', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:14, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:navy, marginBottom:10 }}>오이코스별 진행률</div>
          {oikosList.map(o => {
            const pct=Math.round(((o.day_in_challenge||1)/30)*100), bar=SM[o.stage]?.bar||'#7F77DD'
            return (
              <div key={o.id} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:navy }}>{o.name}</span>
                    <SPill stage={o.stage} />
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    {STAGES.map(s => (
                      <div key={s} onClick={()=>handleStageChange(o.id,s)}
                        style={{ fontSize:9, padding:'2px 5px', borderRadius:6, background:o.stage===s?SM[s].bg:'#f1efe8', color:o.stage===s?SM[s].cl:'#888780', cursor:'pointer', fontWeight:o.stage===s?700:400 }}>
                        {s.slice(0,2)}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ height:6, background:'#f1efe8', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:pct+'%', height:6, background:bar, borderRadius:3 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ── 오이코스 등록 오버레이 ─────────────────────────────────────
  const AddOv = () => (
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'#f7f5f0', zIndex:100, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px 10px', borderBottom:'0.5px solid #d3d1c7', flexShrink:0 }}>
        <Btn onClick={closeOverlay} style={{ width:30, height:30, borderRadius:'50%', background:'#e8e5de', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</Btn>
        <span style={{ fontSize:15, fontWeight:700, color:navy, flex:1 }}>오이코스 등록</span>
        <span style={{ fontSize:12, color:'#888780' }}>{addStep} / 2</span>
      </div>
      <div style={{ height:3, background:'#e8e5de', flexShrink:0 }}>
        <div style={{ height:3, width:(addStep/2*100)+'%', background:purple, transition:'width 0.3s' }} />
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'20px 18px' }}>
        {addStep===1 ? (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:purple, letterSpacing:'0.06em', marginBottom:4 }}>STEP 1</div>
            <div style={{ fontSize:20, fontWeight:700, color:navy, lineHeight:1.35, marginBottom:4 }}>누구를 위해<br />기도하나요?</div>
            <div style={{ fontSize:13, color:'#888780', marginBottom:20 }}>기본 정보를 입력해주세요</div>
            {[{ label:'이름', req:true, key:'name', ph:'홍길동' }, { label:'연락처', req:false, key:'phone', ph:'010-0000-0000' }].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#444441', marginBottom:5 }}>{f.label} {f.req&&<span style={{ color:'#D85A30' }}>*</span>}</div>
                <KrInput value={form[f.key]} onChange={v=>setForm(p=>({...p,[f.key]:v}))} placeholder={f.ph}
                  style={{ width:'100%', height:42, background:'#fff', border:'0.5px solid #B4B2A9', borderRadius:10, padding:'0 12px', fontSize:14, fontFamily:'inherit', outline:'none', color:navy }} />
              </div>
            ))}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#444441', marginBottom:8 }}>관계</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7 }}>
                {RELS.map(r => (
                  <div key={r} onClick={()=>setForm(p=>({...p,rel:r}))}
                    style={{ background:form.rel===r?'#EEEDFE':'#fff', border:`0.5px solid ${form.rel===r?'#7F77DD':'#d3d1c7'}`, borderRadius:20, padding:'8px 4px', fontSize:12, fontWeight:form.rel===r?700:400, color:form.rel===r?'#3C3489':'#5F5E5A', textAlign:'center', cursor:'pointer' }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
            <Btn onClick={()=>form.name.trim()&&setAddStep(2)}
              style={{ width:'100%', height:48, background:form.name.trim()?navy:'#d3d1c7', borderRadius:14, color:'#fff', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
              다음 단계 →
            </Btn>
          </>
        ) : (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:purple, letterSpacing:'0.06em', marginBottom:4 }}>STEP 2</div>
            <div style={{ fontSize:20, fontWeight:700, color:navy, lineHeight:1.35, marginBottom:4 }}>기도제목과<br />관계 단계를</div>
            <div style={{ fontSize:13, color:'#888780', marginBottom:20 }}>AI 기도문 생성에 활용됩니다</div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#444441', marginBottom:5 }}>기도제목</div>
              <KrTextarea value={form.topics} onChange={v=>setForm(p=>({...p,topics:v}))}
                placeholder={'복음에 마음이 열리도록\n직장 스트레스가 줄어들도록'}
                style={{ width:'100%', height:80, background:'#fff', border:'0.5px solid #B4B2A9', borderRadius:10, padding:'10px 12px', fontSize:13, fontFamily:'inherit', outline:'none', resize:'none', lineHeight:1.6, color:navy }} />
              <div style={{ fontSize:10, color:'#888780', marginTop:3 }}>한 줄에 하나씩 입력하세요</div>
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#444441', marginBottom:8 }}>현재 관계 단계</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {STAGES.map((s,i) => {
                  const m=SM[s], descs=['교회나 복음에 관심 없는 상태','교회나 기독교에 호기심을 보임','마음을 열고 대화가 가능한 상태','전도축제 초청 받아들일 준비됨']
                  return (
                    <div key={s} onClick={()=>setForm(p=>({...p,stage:s}))}
                      style={{ display:'flex', alignItems:'center', gap:10, background:form.stage===s?m.bg:'#fff', border:`0.5px solid ${form.stage===s?m.bar:'#d3d1c7'}`, borderRadius:10, padding:'10px 12px', cursor:'pointer' }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:form.stage===s?m.bar:'#d3d1c7', flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:form.stage===s?m.cl:navy }}>{s}</div>
                        <div style={{ fontSize:10, color:'#888780' }}>{descs[i]}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <Btn onClick={handleAddOikos}
              style={{ width:'100%', height:48, background:purple, borderRadius:14, color:'#fff', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
              등록 완료 ✓
            </Btn>
          </>
        )}
      </div>
    </div>
  )

  // ── AI 기도문 오버레이 ─────────────────────────────────────────
  const PrayerOv = () => (
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'#f7f5f0', zIndex:100, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px 10px', borderBottom:'0.5px solid #d3d1c7', flexShrink:0 }}>
        <Btn onClick={()=>{setOverlay(null);setPState('select');setPResult('')}} style={{ width:30, height:30, borderRadius:'50%', background:'#e8e5de', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</Btn>
        <span style={{ fontSize:15, fontWeight:700, color:navy, flex:1 }}>AI 기도문 생성</span>
        {pState==='result'&&<Btn onClick={()=>{setPState('select');setPResult('')}} style={{ fontSize:12, color:purple, background:'none' }}>다시 선택</Btn>}
      </div>
      {pState==='select'&&(
        <div style={{ flex:1, overflowY:'auto' }}>
          <div style={{ display:'flex', gap:12, padding:'14px 18px', overflowX:'auto' }}>
            {oikosList.map((o,i)=>{ const [bg,cl]=AVC[i%AVC.length], s=selId===o.id; return (
              <div key={o.id} onClick={()=>setSelId(o.id)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', flexShrink:0 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:bg, color:cl, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, border:`2px solid ${s?purple:'transparent'}` }}>{o.name.slice(0,2)}</div>
                <span style={{ fontSize:10, fontWeight:700, color:s?purple:'#444441' }}>{o.name.slice(0,3)}</span>
              </div>
            )})}
          </div>
          {selOikos&&(
            <div style={{ margin:'0 18px 14px', background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:16, padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <Av name={selOikos.name} ci={oikosList.indexOf(selOikos)} size={36} />
                <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:700, color:navy }}>{selOikos.name}</div><div style={{ fontSize:10, color:'#888780' }}>{selOikos.relation}</div></div>
                <SPill stage={selOikos.stage} />
              </div>
              {(selOikos.topics||[]).map((t,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, background:'#f7f5f0', borderRadius:8, padding:'7px 10px', marginBottom:5 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:'#7F77DD', marginTop:5, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#444441', lineHeight:1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding:'0 18px 14px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#444441', marginBottom:8 }}>기도문 스타일</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {PSTYLES.map(s=>(
                <div key={s.id} onClick={()=>setPStyle(s.id)} style={{ background:pStyle===s.id?'#EEEDFE':'#fff', border:`0.5px solid ${pStyle===s.id?'#7F77DD':'#d3d1c7'}`, borderRadius:10, padding:'9px 10px', cursor:'pointer' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:pStyle===s.id?'#3C3489':navy, marginBottom:2 }}>{s.l}</div>
                  <div style={{ fontSize:10, color:'#888780' }}>{s.d}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding:'0 18px 20px' }}>
            <Btn onClick={genPrayer} style={{ width:'100%', height:48, background:purple, borderRadius:14, color:'#fff', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>✨ 기도문 생성하기</Btn>
          </div>
        </div>
      )}
      {pState==='loading'&&(
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
          <div style={{ width:80, height:80, borderRadius:'50%', background:'#EEEDFE', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, fontSize:36 }}>✨</div>
          <div style={{ fontSize:17, fontWeight:700, color:navy, marginBottom:8, textAlign:'center', lineHeight:1.4 }}>{selOikos?.name}을(를) 위한<br />기도문을 만들고 있어요</div>
          <div style={{ fontSize:12, color:'#888780', textAlign:'center', lineHeight:1.7 }}>기도제목과 관계 단계를 분석해<br />맞춤 기도문을 작성 중이에요</div>
        </div>
      )}
      {pState==='result'&&(
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, background:'#EEEDFE', borderRadius:20, padding:'5px 10px' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#3C3489' }}>✨ AI 생성 완료</span>
            </div>
            <Btn onClick={()=>{navigator.clipboard?.writeText(pResult);showToast('복사됐어요')}} style={{ width:30, height:30, borderRadius:'50%', background:'#fff', border:'0.5px solid #d3d1c7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📋</Btn>
          </div>
          <div style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:16, padding:16, marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:10, borderBottom:'0.5px solid #e8e5de' }}>
              {selOikos&&<Av name={selOikos.name} ci={oikosList.indexOf(selOikos)} size={32} />}
              <div><div style={{ fontSize:10, color:'#888780' }}>을 위한 기도</div><div style={{ fontSize:13, fontWeight:700, color:navy }}>{selOikos?.name}</div></div>
            </div>
            <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:13, color:'#2C2C2A', lineHeight:1.95, whiteSpace:'pre-wrap' }}>{pResult}</div>
          </div>
          <div style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:16, padding:'13px 14px', marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:navy, marginBottom:10 }}>기도 후, 바로 연결하기</div>
            {selOikos&&[
              { icon:'💬', bg:'#FEE500', name:'안부 메시지 복사', sub:'카카오에 붙여넣어 보내세요', fn:()=>sendKakao(selOikos, getDA(selOikos.day_in_challenge||1).msg) },
              { icon:'☕', bg:'#E1F5EE', name:'기프티콘 보내기', sub:'카카오 선물하기 열기', fn:()=>openGift(selOikos) },
              { icon:'✉️', bg:'#FAECE7', name:'초청장 메시지 복사', sub:'D-18 · 지금이 좋은 때예요', fn:()=>sendKakao(selOikos,'저희 교회 전도축제에 함께하실 수 있으세요? 🙏') },
            ].map((a,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:i<2?'0.5px solid #f1efe8':'none' }}>
                <div style={{ width:32, height:32, borderRadius:9, background:a.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{a.icon}</div>
                <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:700, color:navy }}>{a.name}</div><div style={{ fontSize:10, color:'#888780' }}>{a.sub}</div></div>
                <Btn onClick={a.fn} style={{ fontSize:11, fontWeight:700, borderRadius:20, padding:'5px 12px', background:a.bg, color:navy }}>복사</Btn>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ fontFamily:"'Noto Sans KR',sans-serif", background:'#f7f5f0', height:'100dvh', maxWidth:420, margin:'0 auto', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400;700&display=swap');
        *{box-sizing:border-box;} input:focus,textarea:focus{border-color:#534AB7!important;box-shadow:0 0 0 2px #EEEDFE;}
        ::-webkit-scrollbar{width:0;height:0;}
      `}</style>
      {dataLoading ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:13, color:'#888780' }}>불러오는 중...</div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {tab==='home'  && <Home />}
          {tab==='list'  && <List />}
          {tab==='stats' && <Stats />}
        </div>
      )}
      <div style={{ flexShrink:0, height:58, background:'#f7f5f0', borderTop:'0.5px solid #d3d1c7', display:'flex', alignItems:'center', justifyContent:'space-around' }}>
        {[
          { id:'home',  icon:'🏠', label:'홈' },
          { id:'list',  icon:'👥', label:'오이코스' },
          { id:'fab' },
          { id:'prayer',icon:'🙏', label:'기도' },
          { id:'stats', icon:'📊', label:'현황' },
        ].map(n => n.id==='fab' ? (
          <div key="fab" onClick={()=>setOverlay('add')} style={{ width:46, height:46, borderRadius:'50%', background:purple, display:'flex', alignItems:'center', justifyContent:'center', marginTop:-18, cursor:'pointer', fontSize:22, color:'#fff' }}>+</div>
        ) : (
          <div key={n.id} onClick={()=>n.id==='prayer'?openPrayer(oikosList[0]?.id):setTab(n.id)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, cursor:'pointer', padding:'4px 8px', opacity:tab===n.id?1:0.4 }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <span style={{ fontSize:9, fontWeight:700, color:tab===n.id?purple:'#888780' }}>{n.label}</span>
          </div>
        ))}
      </div>
      {overlay==='add'    && <AddOv />}
      {overlay==='prayer' && <PrayerOv />}
      {toast && (
        <div style={{ position:'absolute', bottom:72, left:'50%', transform:'translateX(-50%)', background:navy, color:'#fff', fontSize:13, fontWeight:500, padding:'10px 18px', borderRadius:20, whiteSpace:'nowrap', zIndex:200, maxWidth:'80%', textAlign:'center' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
