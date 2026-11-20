/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errMsg } from './api'
import type { AppData, Backup, CardType, Expense, ExpenseShare, Travel, TripSummary } from './types'

const ACTIVE_KEY = 'tn_active_trip'
const EMPTY_TRAVEL: Travel = { name: '우리 여행', place: '', start: '', end: '', currency: '원' }
const EMPTY: AppData = { travel: EMPTY_TRAVEL, persons: [], cards: [], recharges: [], expenses: [], shares: [] }

const toTravel = (t: any): Travel => ({
  name: t.name, place: t.place ?? '', start: t.start_date ?? '', end: t.end_date ?? '', currency: t.currency || '원',
})
const fromTravel = (t: Travel) => ({
  name: t.name.trim(), place: t.place.trim(), start_date: t.start || null, end_date: t.end || null, currency: t.currency.trim() || '원',
})

function toAppData(t: any): AppData {
  return {
    travel: toTravel(t),
    persons: t.persons.map((p: any) => ({ id: String(p.id), name: p.name })),
    cards: t.cards.map((c: any) => ({ id: String(c.id), name: c.name, ownerId: String(c.owner), type: c.card_type })),
    recharges: t.recharges.map((r: any) => ({
      id: String(r.id), personId: String(r.person), cardId: r.card ? String(r.card) : '', amount: Number(r.amount), date: r.recharged_at,
    })),
    expenses: t.expenses.map((e: any) => ({
      id: String(e.id), title: e.description, category: e.category, date: String(e.used_at).slice(0, 10),
      cardId: String(e.card), total: Number(e.total_amount),
    })),
    shares: t.expenses.flatMap((e: any) =>
      e.shares.map((s: any) => ({ expenseId: String(e.id), personId: String(s.person), amount: Number(s.amount) }))),
  }
}

const expenseBody = (e: Omit<Expense, 'id'>, shares: Omit<ExpenseShare, 'expenseId'>[]) => ({
  description: e.title, category: e.category, card: Number(e.cardId), total_amount: e.total,
  used_at: `${e.date}T12:00:00`, shares: shares.map(s => ({ person: Number(s.personId), amount: s.amount })),
})

export function useApiData() {
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [activeId, setActiveId] = useState('')
  const [data, setData] = useState<AppData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const wanted = useRef(localStorage.getItem(ACTIVE_KEY) ?? '')

  const refresh = useCallback(async (preferId?: string) => {
    let list: any[] = await api.get('/trips/')
    if (list.length === 0) list = [await api.post('/trips/', fromTravel(EMPTY_TRAVEL))]
    const want = preferId ?? wanted.current
    const id = list.some(t => String(t.id) === want) ? want : String(list[0].id)
    const detail = await api.get(`/trips/${id}/`)
    wanted.current = id
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* ignore */ }
    setTrips(list.map(t => ({ id: String(t.id), travel: toTravel(t) })))
    setActiveId(id)
    setData(toAppData(detail))
  }, [])

  const load = useCallback(() => {
    setLoading(true); setError('')
    refresh().catch(e => setError(errMsg(e))).finally(() => setLoading(false))
  }, [refresh])
  useEffect(load, [load])

  // 변경 요청 → 성공하면 서버 데이터를 다시 불러와 화면에 반영
  const act = async (fn: () => Promise<string | void>) => {
    try { const id = await fn(); await refresh(id || undefined) } catch (e) { alert(errMsg(e)) }
  }
  const T = () => `/trips/${activeId}`

  return {
    data, trips, activeId, loading, error, reload: load,
    backup: undefined as Backup | undefined,
    addTrip: (t: Travel) => act(async () => String((await api.post('/trips/', fromTravel(t))).id)),
    updateTrip: (id: string, t: Travel) => act(async () => { await api.patch(`/trips/${id}/`, fromTravel(t)) }),
    switchTrip: (id: string) => act(async () => id),
    removeTrip: (id: string) => act(async () => { await api.del(`/trips/${id}/`); return id === activeId ? '' : undefined }),

    addPerson: (name: string) => act(async () => { await api.post(`${T()}/persons/`, { name }) }),
    updatePerson: (id: string, name: string) => act(async () => { await api.patch(`${T()}/persons/${id}/`, { name }) }),
    removePerson: (id: string) => act(async () => { await api.del(`${T()}/persons/${id}/`) }),

    addCard: (name: string, ownerId: string, type: CardType) =>
      act(async () => { await api.post(`${T()}/cards/`, { name, owner: Number(ownerId), card_type: type }) }),
    updateCard: (id: string, name: string, ownerId: string, type: CardType) =>
      act(async () => { await api.patch(`${T()}/cards/${id}/`, { name, owner: Number(ownerId), card_type: type }) }),
    removeCard: (id: string) => act(async () => { await api.del(`${T()}/cards/${id}/`) }),

    addRecharge: (personId: string, cardId: string, amount: number, date: string) =>
      act(async () => {
        await api.post(`${T()}/recharges/`, { person: Number(personId), card: cardId ? Number(cardId) : null, amount, recharged_at: date })
      }),
    removeRecharge: (id: string) => act(async () => { await api.del(`${T()}/recharges/${id}/`) }),

    addExpense: (e: Omit<Expense, 'id'>, shares: Omit<ExpenseShare, 'expenseId'>[]) =>
      act(async () => { await api.post(`${T()}/expenses/`, expenseBody(e, shares)) }),
    updateExpense: (id: string, e: Omit<Expense, 'id'>, shares: Omit<ExpenseShare, 'expenseId'>[]) =>
      act(async () => { await api.patch(`${T()}/expenses/${id}/`, expenseBody(e, shares)) }),
    removeExpense: (id: string) => act(async () => { await api.del(`${T()}/expenses/${id}/`) }),
  }
}
