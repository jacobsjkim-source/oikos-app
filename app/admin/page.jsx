'use client'
import { useState, useEffect } from 'react'
import { supabase, fetchProfile, fetchChurchOverview, fetchAllOikosByChurch } from '../../lib/supabase'

const navy = '#1a1a2e'
const purple = '#534AB7'
const SM = {
  관심없음: { bg:'#FAEEDA', cl:'#633806', bar:'#EF9F27' },
  호기심:   { bg:'#E1F5EE', cl:'#085041', bar:'#5DCAA5' },
  열린마음: { bg:'#EEEDFE', cl:'#3C3489', bar:'#7F77DD' },
  초청준비: { bg:'#FAECE7', cl:'#712B13', bar:'#F0997B' },
}

export default function AdminPage() {
  const [session, setSession]     = useState(null)
  const [profile, setProfile]     = useState(null)
  const [overview, setOverview]   = useState([])
  const [allOikos, setAllOikos]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('dashboard')
  const [selMember, setSelMember] = useState(null)
  const [authorized, setAuth]     = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setLoading(false); return }
      setSession(data.session)
      const { data: prof } = await fetchProfile(data.session.user.id)
      setProfile(prof)
      if (prof?.role === 'pastor' || prof?.role === 'admin') {
        setAuth(true)
        await loadData(prof.church_id)
      }
      setLoading(false)
    })
  }, [])

  const loadData = async (churchId) => {
    const [{ data: ov }, { data: oks }] = await Promise.all([
      fetchChurchOverview(churchId),
      fetchAllOikosByChurch(churchId),
    ])
    setOverview(ov || [])
    setAllOikos(oks || [])
  }

  if (loading) return <Spinner />
  if (!session)    return <NotAuth msg="로그인이 필요합니다." />
  if (!authorized) return <NotAuth msg="교역자 권한이 필요합니다. 관리자에게 문의하세요." />

  const totalOikos    = overview.reduce((s, m) => s + (m.oikos_count || 0), 0)
  const prayedToday   = overview.filter(m => m.prayed_today > 0).length
  const readyInvite   = overview.reduce((s, m) => s + (m.ready_to_invite || 0), 0)
  const openMinded    = overview.reduce((s, m) => s + (m.open_minded || 0), 0)

  const memberOikos = (memberId) => allOikos.filter(o => o.user_id === memberId)

  return (
    <div style={{ fontFamily:"'Noto Sans KR',sans-serif", background:'#f7f5f0', minHeight:'100vh', maxWidth:720, margin:'0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap'); *{box-sizing:border-box;} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#d3d1c7;border-radius:2px;}`}</style>

      {/* 헤더 */}
      <div style={{ background:navy, padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div style={{ fontSize:11, color:'#AFA9EC' }}>교역자 대시보드</div>
          <div style={{ fontSize:11, color:'#AFA9EC' }}>{profile?.display_name}</div>
        </div>
        <div style={{ fontSize:22, fontWeight:700, color:'#fff', marginBottom:16 }}>전도 현황 한눈에</div>
        {/* 핵심 지표 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
          {[
            { num:overview.length, label:'참여 성도',  color:'#9FE1CB' },
            { num:prayedToday,     label:'오늘 기도',  color:'#5DCAA5' },
            { num:totalOikos,      label:'총 오이코스', color:'#AFA9EC' },
            { num:readyInvite,     label:'초청 준비',  color:'#F0997B' },
          ].map((s,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.num}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:0, background:'#fff', borderBottom:'0.5px solid #d3d1c7' }}>
        {[
          { id:'dashboard', label:'대시보드' },
          { id:'members',   label:'성도별 현황' },
          { id:'oikos',     label:'전체 오이코스' },
          { id:'prayer',    label:'기도 현황' },
        ].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:'12px 4px', textAlign:'center', fontSize:12, fontWeight:700,
              color: tab===t.id ? purple : '#888780',
              borderBottom: tab===t.id ? `2px solid ${purple}` : '2px solid transparent',
              cursor:'pointer' }}>
            {t.label}
          </div>
        ))}
      </div>

      <div style={{ padding:'16px' }}>

        {/* ── 대시보드 ── */}
        {tab === 'dashboard' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* 전도 단계 분포 */}
            <div style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:14, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:navy, marginBottom:12 }}>전도 단계 분포</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {Object.entries(SM).map(([stage, m]) => {
                  const cnt = allOikos.filter(o => o.stage === stage).length
                  const pct = allOikos.length ? Math.round(cnt / allOikos.length * 100) : 0
                  return (
                    <div key={stage} style={{ background:m.bg, borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:m.cl, marginBottom:4 }}>{stage}</div>
                      <div style={{ fontSize:24, fontWeight:700, color:m.cl }}>{cnt}명</div>
                      <div style={{ height:4, background:'rgba(0,0,0,0.1)', borderRadius:2, marginTop:6, overflow:'hidden' }}>
                        <div style={{ width:pct+'%', height:4, background:m.bar, borderRadius:2 }} />
                      </div>
                      <div style={{ fontSize:10, color:m.cl, marginTop:3, opacity:0.7 }}>{pct}%</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 기도 활성도 */}
            <div style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:14, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:navy, marginBottom:12 }}>성도별 기도 활성도</div>
              {overview
                .sort((a,b) => (b.prayed_7days || 0) - (a.prayed_7days || 0))
                .map(m => {
                  const pct = Math.round(((m.prayed_7days||0) / Math.max((m.oikos_count||1) * 7, 1)) * 100)
                  return (
                    <div key={m.member_id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'#EEEDFE', color:'#3C3489', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
                        {m.member_name?.slice(0,2)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:navy }}>{m.member_name}</span>
                          <span style={{ fontSize:10, color: m.prayed_today > 0 ? '#0F6E56' : '#888780', fontWeight:700 }}>
                            {m.prayed_today > 0 ? '✓ 오늘 기도' : '미기도'}
                          </span>
                        </div>
                        <div style={{ height:5, background:'#f1efe8', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:Math.min(pct,100)+'%', height:5, background: pct > 70 ? '#5DCAA5' : pct > 40 ? '#7F77DD' : '#EF9F27', borderRadius:3 }} />
                        </div>
                      </div>
                      <span style={{ fontSize:10, color:'#888780', width:28, textAlign:'right' }}>
                        {m.oikos_count||0}명
                      </span>
                    </div>
                  )
                })}
            </div>

            {/* 주의 필요 */}
            <div style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:14, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:navy, marginBottom:12 }}>
                🔔 케어가 필요한 성도 <span style={{ fontSize:11, fontWeight:400, color:'#888780' }}>(이번 주 기도 0)</span>
              </div>
              {overview.filter(m => (m.prayed_7days || 0) === 0).length === 0 ? (
                <div style={{ fontSize:13, color:'#5DCAA5', fontWeight:700, textAlign:'center', padding:'8px 0' }}>
                  ✓ 모든 성도가 이번 주 기도했어요!
                </div>
              ) : overview.filter(m => (m.prayed_7days||0) === 0).map(m => (
                <div key={m.member_id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'0.5px solid #f1efe8' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#FAEEDA', color:'#633806', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>
                    {m.member_name?.slice(0,2)}
                  </div>
                  <span style={{ fontSize:12, color:navy, flex:1 }}>{m.member_name}</span>
                  <span style={{ fontSize:10, color:'#993C1D' }}>마지막 기도 {m.last_prayer_date ? new Date(m.last_prayer_date).toLocaleDateString('ko-KR') : '기록 없음'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 성도별 현황 ── */}
        {tab === 'members' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {overview.map(m => {
              const oks = memberOikos(m.member_id)
              const expanded = selMember === m.member_id
              return (
                <div key={m.member_id} style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:14, overflow:'hidden' }}>
                  <div onClick={() => setSelMember(expanded ? null : m.member_id)}
                    style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:'#EEEDFE', color:'#3C3489', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                      {m.member_name?.slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:navy }}>{m.member_name}</div>
                      <div style={{ fontSize:11, color:'#888780' }}>오이코스 {m.oikos_count||0}명 · 이번 주 기도 {m.prayed_7days||0}회</div>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {m.prayed_today > 0 && <span style={{ fontSize:10, background:'#E1F5EE', color:'#085041', padding:'2px 7px', borderRadius:8, fontWeight:700 }}>오늘 기도</span>}
                      {(m.ready_to_invite||0) > 0 && <span style={{ fontSize:10, background:'#FAECE7', color:'#712B13', padding:'2px 7px', borderRadius:8, fontWeight:700 }}>초청준비 {m.ready_to_invite}</span>}
                    </div>
                    <span style={{ fontSize:12, color:'#888780' }}>{expanded ? '▲' : '▼'}</span>
                  </div>
                  {expanded && oks.length > 0 && (
                    <div style={{ borderTop:'0.5px solid #f1efe8', padding:'8px 14px' }}>
                      {oks.map(o => {
                        const sm = SM[o.stage] || SM['관심없음']
                        return (
                          <div key={o.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'0.5px solid #f7f5f0' }}>
                            <div style={{ width:6, height:6, borderRadius:'50%', background:sm.bar, flexShrink:0 }} />
                            <span style={{ fontSize:12, color:navy, fontWeight:700, flex:1 }}>{o.name}</span>
                            <span style={{ fontSize:10, color:'#888780' }}>{o.relation}</span>
                            <span style={{ fontSize:10, fontWeight:700, background:sm.bg, color:sm.cl, padding:'1px 7px', borderRadius:8 }}>{o.stage}</span>
                            <span style={{ fontSize:10, color:'#888780' }}>Day {o.day_in_challenge||1}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── 전체 오이코스 ── */}
        {tab === 'oikos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ display:'flex', gap:8, marginBottom:4, overflowX:'auto', paddingBottom:2 }}>
              {['전체', '관심없음','호기심','열린마음','초청준비'].map(f => {
                const cnt = f==='전체' ? allOikos.length : allOikos.filter(o=>o.stage===f).length
                return <div key={f} style={{ flexShrink:0, background:SM[f]?.bg||'#f1efe8', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:700, color:SM[f]?.cl||'#444441', cursor:'pointer' }}>{f} {cnt}</div>
              })}
            </div>
            {allOikos.map(o => {
              const sm = SM[o.stage] || SM['관심없음']
              return (
                <div key={o.id} style={{ background:'#fff', borderLeft:`3px solid ${sm.bar}`, borderTop:'0.5px solid #d3d1c7', borderRight:'0.5px solid #d3d1c7', borderBottom:'0.5px solid #d3d1c7', borderRadius:'0 12px 12px 0', padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:navy }}>{o.name}</span>
                      <span style={{ fontSize:10, color:'#888780', background:'#f1efe8', borderRadius:8, padding:'1px 5px' }}>{o.relation}</span>
                    </div>
                    <div style={{ fontSize:10, color:'#888780' }}>{o.profiles?.display_name} · Day {o.day_in_challenge||1}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, background:sm.bg, color:sm.cl, padding:'2px 8px', borderRadius:10 }}>{o.stage}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 기도 현황 ── */}
        {tab === 'prayer' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'#fff', border:'0.5px solid #d3d1c7', borderRadius:14, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:navy, marginBottom:12 }}>교회 전체 기도 현황</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { num:prayedToday, label:`오늘 기도 (${overview.length}명 중)`, color:purple },
                  { num:overview.filter(m => (m.prayed_7days||0) >= 5).length, label:'이번 주 5일 이상', color:'#0F6E56' },
                  { num:overview.filter(m => (m.prayed_7days||0) === 0).length, label:'이번 주 미기도', color:'#D85A30' },
                ].map((s,i) => (
                  <div key={i} style={{ background:'#f7f5f0', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.num}</div>
                    <div style={{ fontSize:9, color:'#888780', marginTop:2, lineHeight:1.4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:navy, borderRadius:14, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:10 }}>전도 준비 현황 요약</div>
              <div style={{ fontSize:12, color:'#AFA9EC', lineHeight:1.9 }}>
                • 초청 준비 완료: <span style={{ color:'#9FE1CB', fontWeight:700 }}>{readyInvite}명</span><br/>
                • 열린 마음 단계: <span style={{ color:'#AFA9EC', fontWeight:700 }}>{openMinded}명</span><br/>
                • 전체 오이코스: <span style={{ color:'#AFA9EC', fontWeight:700 }}>{totalOikos}명</span><br/>
                • 참여 성도: <span style={{ color:'#AFA9EC', fontWeight:700 }}>{overview.length}명</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Spinner = () => (
  <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f7f5f0', fontFamily:"'Noto Sans KR',sans-serif" }}>
    <div style={{ fontSize:13, color:'#888780' }}>불러오는 중...</div>
  </div>
)
const NotAuth = ({ msg }) => (
  <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f7f5f0', fontFamily:"'Noto Sans KR',sans-serif" }}>
    <div style={{ textAlign:'center' }}><div style={{ fontSize:32, marginBottom:12 }}>🔒</div><div style={{ fontSize:14, color:'#444441' }}>{msg}</div></div>
  </div>
)
