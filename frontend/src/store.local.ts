import { useEffect, useState } from 'react'
import type { AppData, Backup, CardType, Expense, ExpenseShare, Travel } from './types'
import { uid } from './utils'

type Trip = AppData & { id: string }
interface Root { activeId: string; trips: Trip[] }

const KEY = 'travel-ledger-v2'
const emptyTravel: Travel = { name: '우리 여행', place: '', start: '', end: '', currency: '원' }
const blank = (travel: Partial<Travel> = {}): Trip => ({
  id: uid(), travel: { ...emptyTravel, ...travel }, persons: [], cards: [], recharges: [], expenses: [], shares: [],
})

function normalize(p: Partial<Trip>): Trip {
  const b = blank()
  return {
    ...b, ...p, id: p.id ?? b.id,
    travel: { ...emptyTravel, ...p.travel },
    expenses: (p.expenses ?? []).map(e => ({ ...e, category: e.category || '기타' })),
    recharges: (p.recharges ?? []).map(r => ({ ...r, cardId: r.cardId ?? '' })),
  }
}

function load(): Root {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const r = JSON.parse(raw)
      const trips: Trip[] = (r.trips ?? []).map(normalize)
      if (trips.length) return { activeId: trips.some(t => t.id === r.activeId) ? r.activeId : trips[0].id, trips }
    }
  } catch { /* ignore */ }
  const t = blank()
  return { activeId: t.id, trips: [t] }
}

/** 서버 없이 이 기기(브라우저 저장소)에만 저장하는 버전 */
export function useLocalData() {
  const [root, setRoot] = useState<Root>(load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(root)) } catch { /* ignore */ }
  }, [root])

  const upd = (f: (t: Trip) => Trip) =>
    setRoot(r => ({ ...r, trips: r.trips.map(t => (t.id === r.activeId ? f(t) : t)) }))
  const data = root.trips.find(t => t.id === root.activeId) ?? root.trips[0]

  const backup: Backup = {
    export: () => JSON.stringify({ app: 'trip-note', version: 1, root }, null, 2),
    import: text => {
      const j = JSON.parse(text)
      const src = j.root ?? j
      if (!Array.isArray(src.trips) || src.trips.length === 0) throw new Error('올바른 백업 파일이 아니에요.')
      const trips: Trip[] = src.trips.map(normalize)
      setRoot({ activeId: trips.some(t => t.id === src.activeId) ? src.activeId : trips[0].id, trips })
    },
  }

  return {
    data, activeId: root.activeId, loading: false, error: '', reload: () => {}, backup,
    trips: root.trips.map(t => ({ id: t.id, travel: t.travel })),
    addTrip: (travel: Travel) => setRoot(r => { const t = blank(travel); return { activeId: t.id, trips: [...r.trips, t] } }),
    updateTrip: (id: string, travel: Travel) =>
      setRoot(r => ({ ...r, trips: r.trips.map(t => (t.id === id ? { ...t, travel } : t)) })),
    switchTrip: (id: string) => setRoot(r => ({ ...r, activeId: id })),
    removeTrip: (id: string) => setRoot(r => {
      const trips = r.trips.filter(t => t.id !== id)
      return trips.length ? { activeId: r.activeId === id ? trips[0].id : r.activeId, trips } : r
    }),
    addPerson: (name: string) => upd(d => ({ ...d, persons: [...d.persons, { id: uid(), name }] })),
    updatePerson: (id: string, name: string) =>
      upd(d => ({ ...d, persons: d.persons.map(p => (p.id === id ? { ...p, name } : p)) })),
    removePerson: (id: string) => upd(d => ({ ...d, persons: d.persons.filter(p => p.id !== id) })),
    addCard: (name: string, ownerId: string, type: CardType) =>
      upd(d => ({ ...d, cards: [...d.cards, { id: uid(), name, ownerId, type }] })),
    updateCard: (id: string, name: string, ownerId: string, type: CardType) =>
      upd(d => ({ ...d, cards: d.cards.map(c => (c.id === id ? { ...c, name, ownerId, type } : c)) })),
    removeCard: (id: string) => upd(d => ({ ...d, cards: d.cards.filter(c => c.id !== id) })),
    addRecharge: (personId: string, cardId: string, amount: number, date: string) =>
      upd(d => ({ ...d, recharges: [...d.recharges, { id: uid(), personId, cardId, amount, date }] })),
    removeRecharge: (id: string) => upd(d => ({ ...d, recharges: d.recharges.filter(r => r.id !== id) })),
    addExpense: (e: Omit<Expense, 'id'>, shares: Omit<ExpenseShare, 'expenseId'>[]) =>
      upd(d => {
        const id = uid()
        return { ...d, expenses: [...d.expenses, { ...e, id }], shares: [...d.shares, ...shares.map(s => ({ ...s, expenseId: id }))] }
      }),
    updateExpense: (id: string, e: Omit<Expense, 'id'>, shares: Omit<ExpenseShare, 'expenseId'>[]) =>
      upd(d => ({
        ...d,
        expenses: d.expenses.map(x => (x.id === id ? { ...e, id } : x)),
        shares: [...d.shares.filter(x => x.expenseId !== id), ...shares.map(x => ({ ...x, expenseId: id }))],
      })),
    removeExpense: (id: string) =>
      upd(d => ({ ...d, expenses: d.expenses.filter(e => e.id !== id), shares: d.shares.filter(s => s.expenseId !== id) })),
  }
}
