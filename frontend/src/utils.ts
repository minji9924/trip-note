export const uid = () => Math.random().toString(36).slice(2, 10)
export const today = () => new Date().toISOString().slice(0, 10)
export const fmt = (n: number, cur: string) =>
  /^[¥$€£₩]$/.test(cur) ? `${cur} ${n.toLocaleString('ko-KR')}` : `${n.toLocaleString('ko-KR')}${cur}`
export const dot = (d: string) => d.replace(/-/g, '.')
export const md = (d: string) => d.slice(5).replace('-', '.')
export const toNum = (s: string) => {
  if (s.trim() === '') return 0
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0
}
