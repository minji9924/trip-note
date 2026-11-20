export type CardType = '체크카드' | '신용카드' | '트래블카드' | '현금'
export const CARD_TYPES: CardType[] = ['체크카드', '신용카드', '트래블카드', '현금']

export interface Travel { name: string; place: string; start: string; end: string; currency: string }
export interface Person { id: string; name: string }
export interface Card { id: string; name: string; ownerId: string; type: CardType }
export interface Recharge { id: string; personId: string; cardId: string; amount: number; date: string }
export interface Expense { id: string; category: string; title: string; date: string; cardId: string; total: number }
export interface ExpenseShare { expenseId: string; personId: string; amount: number }

export interface TripSummary { id: string; travel: Travel }
export interface Backup { export: () => string; import: (text: string) => void }

export interface AppData {
  travel: Travel
  persons: Person[]
  cards: Card[]
  recharges: Recharge[]
  expenses: Expense[]
  shares: ExpenseShare[]
}
