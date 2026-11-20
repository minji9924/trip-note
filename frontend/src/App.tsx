import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, clearSession, errMsg, hasToken } from './api'
import Auth from './Auth'
import { MODE, useAppData } from './store'
import { CARD_TYPES } from './types'
import type { AppData, CardType, Expense, Travel } from './types'
import { dot, fmt, md, today, toNum } from './utils'

type Tab = 'all' | 'cards' | 'people' | 'settings'
type SheetKind = null | 'expense' | 'card' | 'person' | 'recharge' | 'travel' | 'manageCards' | 'managePeople' | 'manageTrips' | 'members' | 'settle'
type Store = ReturnType<typeof useAppData>
interface Ctx { personId?: string; cardId?: string; expenseId?: string; itemId?: string; back?: SheetKind; ids?: string[] }
type Open = (k: SheetKind, ctx?: Ctx) => void

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const CATS = ['식비', '교통', '관광', '쇼핑', '숙박', '기타']
const ICON: Record<string, string> = { 식비: '🍽️', 교통: '🚇', 관광: '🏛️', 쇼핑: '🛍️', 숙박: '🏨', 기타: '🧾' }
const CARD_BG = [
  'linear-gradient(135deg,#2a3350,#12172b)', 'linear-gradient(135deg,#6cc7b5,#3e9c8e)',
  'linear-gradient(135deg,#5b7cff,#3347d6)', 'linear-gradient(135deg,#a98af2,#6a45c9)', 'linear-gradient(135deg,#ff9d7a,#e0603f)',
]
const AVATAR = [['#e6ecff', '#3b5bfa'], ['#ffe9e2', '#e0603f'], ['#dff5ec', '#1f9d6b'], ['#f0e8ff', '#7a4fd6']]

function Icon({ n }: { n: 'list' | 'card' | 'people' | 'gear' | 'plane' | 'plus' | 'chev' | 'back' }) {
  const paths = {
    list: <><path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z" /><path d="M10 8h4M10 12h4" /></>,
    card: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18" /></>,
    people: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 3-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><path d="M16 5.3a3 3 0 010 5.4M17.5 14.6c1.8.5 3 1.9 3.4 4" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
    plane: <path d="M21 3L3 10.5l7 2.5 2.5 7zM10 13l4-4" />,
    plus: <path d="M12 5v14M5 12h14" />,
    chev: <path d="M9 6l6 6-6 6" />,
    back: <path d="M15 6l-6 6 6 6" />,
  }
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[n]}</svg>
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="page">
      <div className="pbar">
        <button className="back" onClick={onClose} aria-label="뒤로"><Icon n="back" /></button>
        <h3>{title}</h3>
      </div>
      <div className="pbody">{children}</div>
    </div>
  )
}

interface Item { id: string; title: string; sub: string; badge?: string; onSwitch?: () => void; onEdit: () => void; onDelete: () => void }
function ManageSheet({ title, items, addLabel, onAdd, onClose }: { title: string; items: Item[]; addLabel: string; onAdd: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      {items.length === 0 && <div className="empty">등록된 항목이 없어요.</div>}
      {items.map(it => (
        <div className="mrow" key={it.id}>
          <div className="mid"><b>{it.title}{it.badge && <span className="cnt">{it.badge}</span>}</b><small>{it.sub}</small></div>
          {it.onSwitch && <button className="link edit" onClick={it.onSwitch}>선택</button>}
          <button className="link edit" onClick={it.onEdit}>수정</button>
          <button className="link" onClick={it.onDelete}>삭제</button>
        </div>
      ))}
      <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={onAdd}>{addLabel}</button>
    </Sheet>
  )
}

function Head({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <div className="head">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>
      {right}
    </div>
  )
}

/* ---------- 내역 목록 (날짜별 + 선택 합계) ---------- */
function ExpenseList({ s, rows, personId, onOpen }: { s: Store; rows: Expense[]; personId?: string; onOpen: Open }) {
  const d = s.data, cur = d.travel.currency
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const name = (id: string) => d.persons.find(p => p.id === id)?.name ?? '?'
  const amt = (e: Expense) => personId ? d.shares.find(x => x.expenseId === e.id && x.personId === personId)?.amount ?? 0 : e.total
  const picked = rows.filter(r => sel.has(r.id))
  const dates = [...new Set(rows.map(r => r.date))].sort().reverse()
  return (
    <>
      {rows.length === 0 && <div className="empty">표시할 사용 내역이 없어요.</div>}
      {dates.map(dt => (
        <div key={dt}>
          <div className="grp">{dot(dt)}</div>
          {rows.filter(r => r.date === dt).map(e => {
            const shares = d.shares.filter(x => x.expenseId === e.id)
            const on = sel.has(e.id)
            const act = (fn: () => void) => (ev: React.MouseEvent) => { ev.stopPropagation(); fn() }
            return (
              <div key={e.id} className={'row' + (on ? ' on' : '')} onClick={() => toggle(e.id)}>
                <span className={'cb' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>
                <span className="ic">{ICON[e.category] ?? ICON['기타']}</span>
                <div className="mid">
                  <b>{e.title}</b>
                  <small>{e.category} · {shares.map(x => name(x.personId)).join(', ')}</small>
                  <small className="br">
                    {shares.map(x => `${name(x.personId)} ${fmt(x.amount, cur)}`).join(' · ')}
                    <button className="link edit" onClick={act(() => onOpen('expense', { expenseId: e.id }))}>수정</button>
                    <button className="link" onClick={act(() => {
                      if (confirm(`"${e.title}" 내역을 삭제할까요?`)) { s.removeExpense(e.id); setSel(p => { const n = new Set(p); n.delete(e.id); return n }) }
                    })}>삭제</button>
                  </small>
                </div>
                <div className="rt"><b>-{fmt(amt(e), cur)}</b><small>{d.cards.find(c => c.id === e.cardId)?.name}</small></div>
              </div>
            )
          })}
        </div>
      ))}
      {picked.length > 0 && (
        <div className="selbar">
          <div><small>{picked.length}개 선택 · 합계</small><b>{fmt(sum(picked.map(amt)), cur)}</b></div>
          <div className="sbtns">
            <button onClick={() => setSel(new Set())}>해제</button>
            <button className="go" onClick={() => onOpen('settle', { ids: picked.map(r => r.id) })}>정산</button>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- 전체 내역 ---------- */
function AllScreen({ s, onOpen }: { s: Store; onOpen: Open }) {
  const d = s.data, cur = d.travel.currency
  const spent = sum(d.expenses.map(e => e.total)), charged = sum(d.recharges.map(r => r.amount))
  const pct = charged > 0 ? Math.min(100, (spent / charged) * 100) : 0
  const rows = [...d.expenses].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <Head eyebrow="ALL EXPENSES" title="전체 사용 내역"
        right={<button className="fab" aria-label="사용 내역 등록" onClick={() => onOpen('expense')}><Icon n="plus" /></button>} />
      <div className="hero">
        <small>지금까지 사용한 금액</small>
        <div className="big">{fmt(spent, cur)}</div>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
        <div className="hrow"><span>총 충전 {fmt(charged, cur)}</span><b>잔여 {fmt(charged - spent, cur)}</b></div>
      </div>
      <h2>전체 내역</h2>
      <div className="hint">내역을 선택하면 합계를 확인할 수 있어요</div>
      <ExpenseList s={s} rows={rows} onOpen={onOpen} />
    </>
  )
}

/* ---------- 카드별 ---------- */
function CardsScreen({ s, onOpen }: { s: Store; onOpen: Open }) {
  const d = s.data, cur = d.travel.currency
  const [cid, setCid] = useState('')
  const card = d.cards.find(c => c.id === cid) ?? d.cards[0]
  const pname = (id: string) => d.persons.find(p => p.id === id)?.name ?? '?'
  const ex = card ? d.expenses.filter(e => e.cardId === card.id) : []
  const rc = card ? d.recharges.filter(r => r.cardId === card.id) : []
  const used = sum(ex.map(e => e.total)), charged = sum(rc.map(r => r.amount))
  return (
    <>
      <Head eyebrow="BY CARD" title="카드별 사용 내역"
        right={<button className="pill" onClick={() => onOpen('manageCards')}><Icon n="gear" />카드 설정</button>} />
      {!card && <div className="empty">카드 설정에서 여행에 쓸 카드를 추가해 보세요.</div>}
      <div className="rail">
        {d.cards.map((c, i) => (
          <button key={c.id} className={'ctile' + (card?.id === c.id ? ' on' : '')} style={{ background: CARD_BG[i % CARD_BG.length] }} onClick={() => setCid(c.id)}>
            <span className="gold" /><span className="cn">{c.name}</span>
            <b>{fmt(sum(d.expenses.filter(e => e.cardId === c.id).map(e => e.total)), cur)}</b>
            <small>{c.type} · {pname(c.ownerId)}</small>
          </button>
        ))}
      </div>
      {card && (
        <>
          <div className="sumcard">
            <div className="srow"><div><small>선택 카드 사용액</small><div className="sbig">{fmt(used, cur)}</div></div><span className="cnt">{ex.length}건</span></div>
            <div className="box2"><div><small>충전 금액</small><b>{fmt(charged, cur)}</b></div><div className="soft"><small>잔액</small><b>{fmt(charged - used, cur)}</b></div></div>
            {[...rc].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
              <div className="kv" key={r.id}>
                <span>{md(r.date)} · {pname(r.personId)} 충전 <button className="link" onClick={() => { if (confirm('이 충전 내역을 삭제할까요?')) s.removeRecharge(r.id) }}>삭제</button></span>
                <b>{fmt(r.amount, cur)}</b>
              </div>
            ))}
            <button className="btn small ghost" style={{ marginTop: 10 }} onClick={() => onOpen('recharge', { cardId: card.id })}>+ 충전 추가</button>
          </div>
          <ExpenseList key={card.id} s={s} rows={[...ex].sort((a, b) => b.date.localeCompare(a.date))} onOpen={onOpen} />
        </>
      )}
    </>
  )
}

/* ---------- 인원별 ---------- */
function PeopleScreen({ s, onOpen }: { s: Store; onOpen: Open }) {
  const d = s.data, cur = d.travel.currency
  const [pid, setPid] = useState('')
  const idx = Math.max(0, d.persons.findIndex(p => p.id === pid))
  const person = d.persons[idx]
  const used = (id: string) => sum(d.shares.filter(x => x.personId === id).map(x => x.amount))
  const rc = person ? d.recharges.filter(r => r.personId === person.id) : []
  const charged = sum(rc.map(r => r.amount))
  const rows = person
    ? d.expenses.filter(e => d.shares.some(x => x.expenseId === e.id && x.personId === person.id)).sort((a, b) => b.date.localeCompare(a.date))
    : []
  const av = (i: number) => AVATAR[i % AVATAR.length]
  return (
    <>
      <Head eyebrow="BY MEMBER" title="인원별 사용 내역"
        right={<button className="pill" onClick={() => onOpen('managePeople')}><Icon n="gear" />인원 설정</button>} />
      {!person && <div className="empty">인원 설정에서 여행에 참여하는 인원을 추가해 보세요.</div>}
      <div className="peeps">
        {d.persons.map((p, i) => (
          <button key={p.id} className={'peep' + (person?.id === p.id ? ' on' : '')} onClick={() => setPid(p.id)}>
            <span className="av" style={{ background: av(i)[0], color: av(i)[1] }}>{p.name.slice(0, 1)}</span>
            <b>{p.name}</b><small>{fmt(used(p.id), cur)}</small>
          </button>
        ))}
      </div>
      {person && (
        <>
          <div className="sumcard">
            <div className="srow">
              <div className="who"><span className="av" style={{ background: av(idx)[0], color: av(idx)[1] }}>{person.name.slice(0, 1)}</span>
                <div><b>{person.name}</b><small>총 충전 {fmt(charged, cur)}</small></div></div>
              <div className="sbig">{fmt(used(person.id), cur)}</div>
            </div>
            <div className="box2"><div><small>사용 금액</small><b>{fmt(used(person.id), cur)}</b></div><div className="soft"><small>남은 금액</small><b>{fmt(charged - used(person.id), cur)}</b></div></div>
            {[...rc].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
              <div className="kv" key={r.id}>
                <span>{md(r.date)} · {d.cards.find(c => c.id === r.cardId)?.name ?? '카드 미지정'} 충전 <button className="link" onClick={() => { if (confirm('이 충전 내역을 삭제할까요?')) s.removeRecharge(r.id) }}>삭제</button></span>
                <b>{fmt(r.amount, cur)}</b>
              </div>
            ))}
            <button className="btn small ghost" style={{ marginTop: 10 }} onClick={() => onOpen('recharge', { personId: person.id })}>+ 충전 추가</button>
          </div>
          <ExpenseList key={person.id} s={s} rows={rows} personId={person.id} onOpen={onOpen} />
        </>
      )}
    </>
  )
}

/* ---------- 설정 ---------- */
function SettingsScreen({ s, onOpen, range, email, onLogout }: { s: Store; onOpen: Open; range: string; email: string; onLogout: () => void }) {
  const d = s.data
  const items: [string, string, string, SheetKind][] = [
    ['plane', '여행 관리', `${s.trips.length}개의 여행`, 'manageTrips'],
    ['card', '카드 관리', `${d.cards.length}개의 카드`, 'manageCards'],
    ['people', '인원 관리', `${d.persons.length}명의 여행 인원`, 'managePeople'],
    ['people', '여행 멤버', '같이 기록할 사용자 초대', 'members'],
  ]
  return (
    <>
      <Head eyebrow="TRIP SETTINGS" title="설정" />
      <div className="dark">
        <span className="badge">진행 중</span>
        <div className="eyebrow light">ACTIVE TRIP</div>
        <h1>{d.travel.name}</h1>
        <div className="sub2">{d.travel.place || '여행지 미정'}</div>
        <div className="dline">{range || '기간 미정'}</div>
      </div>
      <div className="menu">
        {items.filter(i => MODE === 'api' || i[3] !== 'members').map(([ic, t, sub, k]) => (
          <button key={t} onClick={() => onOpen(k)}>
            <span className="ic"><Icon n={ic as 'plane'} /></span>
            <div className="mid"><b>{t}</b><small>{sub}</small></div><Icon n="chev" />
          </button>
        ))}
      </div>
      {MODE === 'api' ? (
        <div className="menu">
          <button onClick={onLogout}>
            <div className="mid"><b>로그아웃</b><small>{email}</small></div><Icon n="chev" />
          </button>
        </div>
      ) : <DataMenu s={s} />}
    </>
  )
}

async function shareOrCopy(title: string, text: string) {
  try { if (navigator.share) { await navigator.share({ title, text }); return } }
  catch (e) { if (e instanceof Error && e.name === 'AbortError') return }
  try { await navigator.clipboard.writeText(text); alert('클립보드에 복사했어요.') } catch { prompt('복사해서 사용하세요', text) }
}

/** 선택한 내역의 인원별 / 카드별 정산 */
function SettlePage({ s, ids }: { s: Store; ids: string[] }) {
  const d = s.data, cur = d.travel.currency
  const ex = d.expenses.filter(e => ids.includes(e.id))
  const shares = d.shares.filter(x => ids.includes(x.expenseId))
  const cardOf = (eid: string) => d.expenses.find(e => e.id === eid)?.cardId
  const ownerName = (id: string) => d.persons.find(p => p.id === id)?.name ?? '?'
  const total = sum(ex.map(e => e.total))
  const byPerson = d.persons.map((p, i) => {
    const mine = shares.filter(x => x.personId === p.id)
    return {
      p, i, total: sum(mine.map(x => x.amount)),
      cards: d.cards.map(c => ({ c, v: sum(mine.filter(x => cardOf(x.expenseId) === c.id).map(x => x.amount)) })).filter(r => r.v > 0),
    }
  }).filter(r => r.total > 0)
  const byCard = d.cards.map(c => {
    const cs = shares.filter(x => cardOf(x.expenseId) === c.id)
    const cx = ex.filter(e => e.cardId === c.id)
    return {
      c, n: cx.length, total: sum(cx.map(e => e.total)),
      people: d.persons.map(p => ({ p, v: sum(cs.filter(x => x.personId === p.id).map(x => x.amount)) })).filter(r => r.v > 0),
    }
  }).filter(r => r.total > 0)
  const text = [
    `[${d.travel.name}] 정산 (${ex.length}건 · ${fmt(total, cur)})`, '', '■ 인원별',
    ...byPerson.map(r => `${r.p.name} ${fmt(r.total, cur)} (${r.cards.map(x => `${x.c.name} ${fmt(x.v, cur)}`).join(' / ')})`),
    '', '■ 카드별',
    ...byCard.map(r => `${r.c.name}(${ownerName(r.c.ownerId)}) ${fmt(r.total, cur)} (${r.people.map(x => `${x.p.name} ${fmt(x.v, cur)}`).join(' / ')})`),
  ].join('\n')
  if (ex.length === 0) return <div className="empty">정산할 내역이 없어요.</div>
  return (
    <>
      <div className="hero" style={{ marginTop: 12 }}>
        <small>선택한 내역 합계 · {ex.length}건</small>
        <div className="big" style={{ marginBottom: 0 }}>{fmt(total, cur)}</div>
      </div>
      <h2>인원별 금액</h2>
      {byPerson.map(r => (
        <div className="sumcard" key={r.p.id} style={{ marginBottom: 8 }}>
          <div className="srow">
            <div className="who"><span className="av" style={{ background: AVATAR[r.i % AVATAR.length][0], color: AVATAR[r.i % AVATAR.length][1], marginBottom: 0 }}>{r.p.name.slice(0, 1)}</span><b>{r.p.name}</b></div>
            <div className="sbig">{fmt(r.total, cur)}</div>
          </div>
          {r.cards.map(x => <div className="kv" key={x.c.id}><span>{x.c.name}</span><b>{fmt(x.v, cur)}</b></div>)}
        </div>
      ))}
      <h2>카드별 금액</h2>
      {byCard.map(r => (
        <div className="sumcard" key={r.c.id} style={{ marginBottom: 8 }}>
          <div className="srow">
            <div><b>{r.c.name}</b><small>{r.c.type} · {ownerName(r.c.ownerId)} · {r.n}건</small></div>
            <div className="sbig">{fmt(r.total, cur)}</div>
          </div>
          {r.people.map(x => <div className="kv" key={x.p.id}><span>{x.p.name} 부담</span><b>{fmt(x.v, cur)}</b></div>)}
        </div>
      ))}
      <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => shareOrCopy(`${d.travel.name} 정산`, text)}>정산 결과 공유</button>
    </>
  )
}

function summaryText(d: AppData) {
  const cur = d.travel.currency
  const spent = sum(d.expenses.map(e => e.total)), charged = sum(d.recharges.map(r => r.amount))
  const lines = [`[${d.travel.name}] 정산 요약`, `총 충전 ${fmt(charged, cur)} · 총 사용 ${fmt(spent, cur)} · 잔액 ${fmt(charged - spent, cur)}`, '', '■ 인원별']
  d.persons.forEach(p => {
    const c = sum(d.recharges.filter(r => r.personId === p.id).map(r => r.amount))
    const u = sum(d.shares.filter(x => x.personId === p.id).map(x => x.amount))
    lines.push(`${p.name}: 충전 ${fmt(c, cur)} / 사용 ${fmt(u, cur)} / 남음 ${fmt(c - u, cur)}`)
  })
  lines.push('', '■ 카드별')
  d.cards.forEach(c => {
    const ch = sum(d.recharges.filter(r => r.cardId === c.id).map(r => r.amount))
    const u = sum(d.expenses.filter(e => e.cardId === c.id).map(e => e.total))
    lines.push(`${c.name}: 충전 ${fmt(ch, cur)} / 사용 ${fmt(u, cur)} / 잔액 ${fmt(ch - u, cur)}`)
  })
  return lines.join('\n')
}

function DataMenu({ s }: { s: Store }) {
  const file = useRef<HTMLInputElement>(null)
  const aborted = (e: unknown) => e instanceof Error && e.name === 'AbortError'
  const shareText = () => shareOrCopy(s.data.travel.name, summaryText(s.data))
  const exportBackup = async () => {
    const name = `trip-note-backup-${today()}.json`
    const f = new File([s.backup!.export()], name, { type: 'application/json' })
    try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: name }); return } } catch (e) { if (aborted(e)) return }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  }
  const importBackup = async (f?: File) => {
    if (!f || !confirm('백업 파일로 현재 데이터를 모두 교체할까요?')) return
    try { s.backup!.import(await f.text()); alert('백업을 가져왔어요.') } catch (e) { alert(errMsg(e)) }
  }
  const rows: [string, string, () => void][] = [
    ['정산 요약 공유', '인원별, 카드별 요약을 메신저로 보내요', shareText],
    ['백업 내보내기', '데이터를 파일로 저장해요 (가끔 해 두세요)', exportBackup],
    ['백업 가져오기', '저장한 파일로 복원해요', () => file.current?.click()],
  ]
  return (
    <>
      <div className="menu">
        {rows.map(([t, sub, fn]) => (
          <button key={t} onClick={fn}><div className="mid"><b>{t}</b><small>{sub}</small></div><Icon n="chev" /></button>
        ))}
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => { importBackup(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <div className="hint" style={{ marginTop: 10 }}>데이터는 이 기기에만 저장돼요. 기기를 바꾸거나 앱을 지우기 전에 백업을 내보내 주세요.</div>
    </>
  )
}

interface Member { id: number; email: string; role: string }
function MembersForm({ tripId }: { tripId: string }) {
  const [list, setList] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const load = () => api.get<Member[]>(`/trips/${tripId}/members/`).then(setList).catch(e => setErr(errMsg(e)))
  useEffect(() => { load() }, [tripId])
  const invite = async () => {
    try { setList(await api.post<Member[]>(`/trips/${tripId}/members/`, { email: email.trim().toLowerCase() })); setEmail(''); setErr('') }
    catch (e) { setErr(errMsg(e)) }
  }
  return (
    <>
      <div className="hint" style={{ marginTop: 8 }}>멤버는 이 여행의 모든 데이터를 함께 보고 기록할 수 있어요. 초대는 여행을 만든 사람만 할 수 있어요.</div>
      {list.map(m => (
        <div className="mrow" key={m.id}><div className="mid"><b>{m.email}</b></div><span className="cnt">{m.role === 'owner' ? '만든 사람' : '멤버'}</span></div>
      ))}
      <label className="f">이메일로 초대<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="가입된 이메일 주소" /></label>
      {err && <div className="check bad">{err}</div>}
      <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={!email.trim()} onClick={invite}>멤버 추가</button>
    </>
  )
}

/* ---------- 폼 ---------- */
function PersonForm({ s, editId, done }: { s: Store; editId?: string; done: () => void }) {
  const [name, setName] = useState(s.data.persons.find(p => p.id === editId)?.name ?? '')
  return (
    <>
      <label className="f">이름<input value={name} onChange={e => setName(e.target.value)} placeholder="예: 민수" autoFocus /></label>
      <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={!name.trim()}
        onClick={() => { if (editId) s.updatePerson(editId, name.trim()); else s.addPerson(name.trim()); done() }}>{editId ? '수정 저장' : '인원 추가'}</button>
    </>
  )
}

function CardForm({ s, editId, done }: { s: Store; editId?: string; done: () => void }) {
  const d = s.data
  const c0 = d.cards.find(c => c.id === editId)
  const [name, setName] = useState(c0?.name ?? '')
  const [ownerId, setOwnerId] = useState(c0?.ownerId ?? d.persons[0]?.id ?? '')
  const [type, setType] = useState<CardType>(c0?.type ?? '트래블카드')
  return (
    <>
      <label className="f">카드 이름<input value={name} onChange={e => setName(e.target.value)} placeholder="예: 트래블월렛" autoFocus /></label>
      <label className="f">카드 소유자
        <select value={ownerId} onChange={e => setOwnerId(e.target.value)}>
          {d.persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
      <label className="f">카드 종류
        <select value={type} onChange={e => setType(e.target.value as CardType)}>
          {CARD_TYPES.map(t => <option key={t}>{t}</option>)}
        </select></label>
      <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={!name.trim() || !ownerId}
        onClick={() => { if (editId) s.updateCard(editId, name.trim(), ownerId, type); else s.addCard(name.trim(), ownerId, type); done() }}>{editId ? '수정 저장' : '카드 추가'}</button>
    </>
  )
}

function RechargeForm({ s, personId: p0, cardId: c0, done }: { s: Store; personId?: string; cardId?: string; done: () => void }) {
  const d = s.data
  const [personId, setPersonId] = useState(p0 ?? d.persons[0]?.id ?? '')
  const [cardId, setCardId] = useState(c0 ?? d.cards[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  return (
    <>
      <label className="f">충전할 카드
        <select value={cardId} onChange={e => setCardId(e.target.value)}>
          {d.cards.map(c => <option key={c.id} value={c.id}>{c.name} ({d.persons.find(p => p.id === c.ownerId)?.name})</option>)}
        </select></label>
      <label className="f">충전한 사람
        <select value={personId} onChange={e => setPersonId(e.target.value)}>
          {d.persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
      <label className="f">충전 금액 ({d.travel.currency})
        <input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus /></label>
      <label className="f">날짜<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={toNum(amount) <= 0 || !cardId}
        onClick={() => { s.addRecharge(personId, cardId, toNum(amount), date); done() }}>충전 기록 저장</button>
    </>
  )
}

function ExpenseForm({ s, editId, done }: { s: Store; editId?: string; done: () => void }) {
  const d = s.data, cur = d.travel.currency
  const ex = d.expenses.find(e => e.id === editId)
  const [title, setTitle] = useState(ex?.title ?? '')
  const [total, setTotal] = useState(ex ? String(ex.total) : '')
  const [cardId, setCardId] = useState(ex?.cardId ?? d.cards[0]?.id ?? '')
  const [date, setDate] = useState(ex?.date ?? today())
  const [category, setCategory] = useState(ex?.category ?? '식비')
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(d.shares.filter(x => x.expenseId === editId).map(x => [x.personId, String(x.amount)])))
  const t = toNum(total)
  const assigned = sum(d.persons.map(p => toNum(shares[p.id] ?? '')))
  const diff = t - assigned
  const valid = title.trim() !== '' && t > 0 && cardId !== '' && diff === 0
  const split = () => {
    const ids = d.persons.filter(p => (shares[p.id] ?? '') !== '').map(p => p.id)
    const targets = ids.length ? ids : d.persons.map(p => p.id)
    const base = Math.floor(t / targets.length)
    const next: Record<string, string> = {}
    targets.forEach((id, i) => { next[id] = String(base + (i === 0 ? t - base * targets.length : 0)) })
    setShares(next)
  }
  const save = () => {
    const e = { title: title.trim(), category, date, cardId, total: t }
    const sh = d.persons.filter(p => toNum(shares[p.id] ?? '') > 0).map(p => ({ personId: p.id, amount: toNum(shares[p.id]) }))
    if (editId) s.updateExpense(editId, e, sh)
    else s.addExpense(e, sh)
    done()
  }
  const owner = d.persons.find(p => p.id === d.cards.find(c => c.id === cardId)?.ownerId)?.name
  return (
    <>
      <label className="f">사용 장소 / 내용<input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 디즈니랜드 저녁 식사" autoFocus /></label>
      <label className="f">카테고리
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select></label>
      <label className="f">사용 금액 ({cur})<input inputMode="numeric" value={total} onChange={e => setTotal(e.target.value)} placeholder="0" /></label>
      <label className="f">결제 카드
        <select value={cardId} onChange={e => setCardId(e.target.value)}>
          {d.cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      {owner && <div className="sub" style={{ marginTop: 4 }}>카드 소유자: {owner}</div>}
      <label className="f">날짜<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <h2>실제 비용 부담 인원</h2>
      {d.persons.map(p => (
        <div className="sharerow" key={p.id}>
          <span>{p.name}</span>
          <input inputMode="numeric" placeholder="0" value={shares[p.id] ?? ''} onChange={e => setShares({ ...shares, [p.id]: e.target.value })} />
        </div>
      ))}
      <button className="btn ghost small" style={{ marginTop: 10 }} onClick={split} disabled={t <= 0}>균등 분할</button>
      <div className={'check ' + (diff === 0 && t > 0 ? 'ok' : 'bad')}>
        <span>부담 합계 {fmt(assigned, cur)}</span>
        <b>{diff === 0 && t > 0 ? '결제 금액과 일치' : diff > 0 ? `${fmt(diff, cur)} 부족` : `${fmt(-diff, cur)} 초과`}</b>
      </div>
      <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={!valid} onClick={save}>{editId ? '수정 저장' : '사용 내역 저장'}</button>
    </>
  )
}

function TravelForm({ s, tripId, done }: { s: Store; tripId?: string; done: () => void }) {
  const [t, setT] = useState<Travel>(s.trips.find(x => x.id === tripId)?.travel ?? { name: '', place: '', start: '', end: '', currency: s.data.travel.currency })
  return (
    <>
      <label className="f">여행명<input value={t.name} onChange={e => setT({ ...t, name: e.target.value })} /></label>
      <label className="f">여행지<input value={t.place} onChange={e => setT({ ...t, place: e.target.value })} placeholder="예: 프랑스 파리" /></label>
      <label className="f">통화 기호<input value={t.currency} onChange={e => setT({ ...t, currency: e.target.value })} placeholder="원, ¥, $, €" /></label>
      <label className="f">시작일<input type="date" value={t.start} onChange={e => setT({ ...t, start: e.target.value })} /></label>
      <label className="f">종료일<input type="date" value={t.end} onChange={e => setT({ ...t, end: e.target.value })} /></label>
      <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={!t.name.trim()} onClick={() => { if (tripId) s.updateTrip(tripId, t); else s.addTrip(t); done() }}>{tripId ? '수정 저장' : '여행 추가'}</button>
    </>
  )
}

/* ---------- App ---------- */
const rangeOf = (t: Travel) => (t.start ? `${dot(t.start)}${t.end ? ' – ' + dot(t.end) : ''}` : '')

function Main({ onLogout }: { onLogout: () => void }) {
  const s = useAppData()
  const [email, setEmail] = useState('')
  useEffect(() => { if (MODE === 'api') api.get('/auth/me/').then(m => setEmail(m.email)).catch(() => {}) }, [])
  const d = s.data, t = d.travel
  const [tab, setTab] = useState<Tab>('all')
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [ctx, setCtx] = useState<Ctx>({})

  const open: Open = (k, c = {}) => {
    if (k === 'card' && d.persons.length === 0) return alert('먼저 인원 관리에서 인원을 추가해 주세요.')
    if ((k === 'recharge' || k === 'expense') && (d.persons.length === 0 || d.cards.length === 0))
      return alert('먼저 인원과 카드를 추가해 주세요.')
    setCtx(c)
    setSheet(k)
  }
  const close = () => setSheet(ctx.back ?? null)
  const closeAll = () => setSheet(null)
  const pn = (id: string) => d.persons.find(p => p.id === id)?.name ?? '?'

  const delPerson = (id: string) => {
    const p = d.persons.find(x => x.id === id)!
    if (d.cards.some(c => c.ownerId === id) || d.recharges.some(r => r.personId === id) || d.shares.some(x => x.personId === id))
      return alert('카드 소유, 충전, 사용 내역에 사용 중인 인원은 삭제할 수 없어요.\n관련 항목을 먼저 정리해 주세요.')
    if (confirm(`"${p.name}" 인원을 삭제할까요?`)) s.removePerson(id)
  }
  const delCard = (id: string) => {
    const c = d.cards.find(x => x.id === id)!
    if (d.expenses.some(e => e.cardId === id) || d.recharges.some(r => r.cardId === id))
      return alert('충전 또는 사용 내역이 있는 카드는 삭제할 수 없어요.\n관련 내역을 먼저 정리해 주세요.')
    if (confirm(`"${c.name}" 카드를 삭제할까요?`)) s.removeCard(id)
  }
  const delTrip = (id: string) => {
    if (s.trips.length <= 1) return alert('여행은 최소 1개가 필요해요.')
    const x = s.trips.find(v => v.id === id)!
    if (confirm(`"${x.travel.name}" 여행과 모든 카드, 인원, 내역이 삭제돼요. 계속할까요?`)) s.removeTrip(id)
  }

  const tabs: [Tab, string, 'list' | 'card' | 'people' | 'gear'][] = [
    ['all', '전체 내역', 'list'], ['cards', '카드별', 'card'], ['people', '인원별', 'people'], ['settings', '설정', 'gear'],
  ]
  if (s.loading) return <div className="app"><div className="empty">불러오는 중…</div></div>
  if (s.error) return (
    <div className="app"><div className="empty">{s.error}</div>
      <button className="btn" style={{ width: '100%' }} onClick={s.reload}>다시 시도</button></div>
  )
  return (
    <div className="app">
      <button className="trip" onClick={() => open('travel', { itemId: s.activeId })}>
        <span className="ic"><Icon n="plane" /></span>
        <div className="mid"><b>{t.name}</b><small>{[t.place, rangeOf(t)].filter(Boolean).join(' · ') || '여행 정보를 입력해 주세요'}</small></div>
        <Icon n="chev" />
      </button>
      {tab === 'all' && <AllScreen s={s} onOpen={open} />}
      {tab === 'cards' && <CardsScreen s={s} onOpen={open} />}
      {tab === 'people' && <PeopleScreen s={s} onOpen={open} />}
      {tab === 'settings' && <SettingsScreen s={s} onOpen={open} range={rangeOf(t)} email={email} onLogout={onLogout} />}

      <nav className="tabs"><div>
        {tabs.map(([k, label, ic]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon n={ic} />{label}</button>
        ))}
      </div></nav>

      {sheet === 'manageTrips' && (
        <ManageSheet title="여행 관리" addLabel="+ 여행 추가" onClose={closeAll} onAdd={() => open('travel', { back: 'manageTrips' })}
          items={s.trips.map(x => ({
            id: x.id, title: x.travel.name, sub: [x.travel.place, rangeOf(x.travel)].filter(Boolean).join(' · ') || '여행지, 기간 미정',
            badge: x.id === s.activeId ? '사용 중' : undefined,
            onSwitch: x.id === s.activeId ? undefined : () => s.switchTrip(x.id),
            onEdit: () => open('travel', { itemId: x.id, back: 'manageTrips' }), onDelete: () => delTrip(x.id),
          }))} />
      )}
      {sheet === 'manageCards' && (
        <ManageSheet title="카드 관리" addLabel="+ 카드 추가" onClose={closeAll} onAdd={() => open('card', { back: 'manageCards' })}
          items={d.cards.map(c => ({
            id: c.id, title: c.name, sub: `${c.type} · ${pn(c.ownerId)}`,
            onEdit: () => open('card', { itemId: c.id, back: 'manageCards' }), onDelete: () => delCard(c.id),
          }))} />
      )}
      {sheet === 'managePeople' && (
        <ManageSheet title="인원 관리" addLabel="+ 인원 추가" onClose={closeAll} onAdd={() => open('person', { back: 'managePeople' })}
          items={d.persons.map(p => ({
            id: p.id, title: p.name, sub: `사용 ${fmt(sum(d.shares.filter(x => x.personId === p.id).map(x => x.amount)), t.currency)}`,
            onEdit: () => open('person', { itemId: p.id, back: 'managePeople' }), onDelete: () => delPerson(p.id),
          }))} />
      )}

      {sheet === 'settle' && <Sheet title="정산" onClose={close}><SettlePage s={s} ids={ctx.ids ?? []} /></Sheet>}
      {sheet === 'members' && <Sheet title="여행 멤버" onClose={closeAll}><MembersForm tripId={s.activeId} /></Sheet>}
      {sheet === 'expense' && <Sheet title={ctx.expenseId ? '사용 내역 수정' : '사용 내역 등록'} onClose={close}><ExpenseForm s={s} editId={ctx.expenseId} done={close} /></Sheet>}
      {sheet === 'card' && <Sheet title={ctx.itemId ? '카드 수정' : '카드 추가'} onClose={close}><CardForm s={s} editId={ctx.itemId} done={close} /></Sheet>}
      {sheet === 'person' && <Sheet title={ctx.itemId ? '인원 수정' : '인원 추가'} onClose={close}><PersonForm s={s} editId={ctx.itemId} done={close} /></Sheet>}
      {sheet === 'recharge' && <Sheet title="충전 추가" onClose={close}><RechargeForm s={s} personId={ctx.personId} cardId={ctx.cardId} done={close} /></Sheet>}
      {sheet === 'travel' && <Sheet title={ctx.itemId ? '여행 수정' : '여행 추가'} onClose={close}><TravelForm s={s} tripId={ctx.itemId} done={close} /></Sheet>}
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(MODE === 'local' || hasToken())
  useEffect(() => {
    const out = () => setAuthed(false)
    window.addEventListener('tn-logout', out)
    return () => window.removeEventListener('tn-logout', out)
  }, [])
  return authed ? <Main onLogout={clearSession} /> : <Auth onDone={() => setAuthed(true)} />
}
