import { useState } from 'react'
import { errMsg, login, register } from './api'

export default function Auth({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setBusy(true); setErr('')
    try {
      if (mode === 'register') {
        if (pw.length < 8) throw new Error('비밀번호는 8자 이상이어야 해요.')
        if (pw !== pw2) throw new Error('비밀번호가 일치하지 않아요.')
        await register(email, pw)
      } else await login(email, pw)
      onDone()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <div className="eyebrow">TRIP NOTE</div>
      <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>
      <p className="sub2 dim">여행 가계부를 함께 기록해 보세요.</p>
      <form onSubmit={submit}>
        <label className="f">이메일
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="f">비밀번호
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pw} onChange={e => setPw(e.target.value)} required /></label>
        {mode === 'register' && (
          <label className="f">비밀번호 확인
            <input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required /></label>
        )}
        {err && <div className="check bad">{err}</div>}
        <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
          {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
        </button>
      </form>
      <button className="btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>
        {mode === 'login' ? '계정이 없어요 · 회원가입' : '이미 계정이 있어요 · 로그인'}
      </button>
    </div>
  )
}
