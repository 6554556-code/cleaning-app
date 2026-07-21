import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { saveSession } from '../session'

const TG_BOT = 'ebookee777_bot' // @ebookee777_bot, домен привязан в BotFather -> app.ebookee.app

const CSS = `
.eblogin-screen{position:fixed;inset:0;z-index:1000;overflow:auto;background:#FBFAF7;
  display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#161616}
.eblogin-brand{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:34px}
.eblogin-brand span{font-size:24px;font-weight:800;letter-spacing:-.6px}
.eblogin-card{width:100%;max-width:400px;background:#fff;border:1px solid #ECECEC;border-radius:22px;
  padding:30px 26px 26px;box-shadow:0 10px 40px -24px rgba(0,0,0,.25)}
.eblogin-h1{font-size:23px;font-weight:800;letter-spacing:-.4px;margin:0 0 6px}
.eblogin-lead{font-size:14px;color:#5A5A5A;line-height:1.5;margin:0 0 24px}
.eblogin-lead b{color:#161616;font-weight:700}
.eblogin-label{display:block;font-size:12.5px;font-weight:700;color:#5A5A5A;margin:0 0 8px;letter-spacing:.2px}
.eblogin-phone{display:flex;align-items:center;background:#F6F6F4;border:1.5px solid transparent;
  border-radius:14px;padding:0 14px;transition:border-color .15s,background .15s}
.eblogin-phone:focus-within{border-color:#FFC01E;background:#fff}
.eblogin-cc{font-size:17px;font-weight:600;color:#161616;padding-right:6px;position:relative;top:-2px}
.eblogin-phone input{flex:1;border:0;background:transparent;outline:0;font-size:17px;font-weight:600;
  letter-spacing:.5px;padding:15px 0;color:#161616;min-width:0}
.eblogin-otp{display:flex;gap:10px;justify-content:space-between;margin-bottom:6px}
.eblogin-otp input{width:100%;aspect-ratio:1/1;text-align:center;font-size:26px;font-weight:800;
  border:1.5px solid #ECECEC;background:#F6F6F4;border-radius:14px;outline:0;color:#161616;
  transition:border-color .12s,background .12s}
.eblogin-otp input:focus{border-color:#FFC01E;background:#fff}
.eblogin-btn{width:100%;margin-top:22px;padding:16px;font-size:16px;font-weight:800;background:#FFC01E;
  color:#161616;border:0;border-radius:14px;cursor:pointer;transition:transform .04s,background .15s}
.eblogin-btn:hover{background:#F0AE00}
.eblogin-btn:active{transform:translateY(1px)}
.eblogin-btn:disabled{opacity:.5;cursor:default;transform:none;background:#FFC01E}
.eblogin-sub{display:flex;justify-content:space-between;align-items:center;margin-top:18px;font-size:13px}
.eblogin-link{color:#5A5A5A;background:0;border:0;font-size:13px;font-weight:600;cursor:pointer;padding:4px 0}
.eblogin-link:hover{color:#161616}
.eblogin-timer{color:#5A5A5A;font-size:13px}
.eblogin-msg{margin-top:16px;font-size:13.5px;line-height:1.45;padding:11px 13px;border-radius:11px}
.eblogin-msg.err{background:#FCEBE7;color:#C0341D}
.eblogin-fine{margin:18px 4px 0;font-size:11.5px;color:#9A9A9A;text-align:center;line-height:1.5}
.eblogin-tg{display:flex;justify-content:center;min-height:46px;margin:20px 0 0}
.eblogin-tghint{margin:16px 0 0;font-size:12px;color:#9A9A9A;text-align:center;line-height:1.4}
.eblogin-or{display:flex;align-items:center;gap:12px;margin:20px 0 24px;color:#9A9A9A;font-size:12.5px;font-weight:600}
.eblogin-or::before,.eblogin-or::after{content:"";flex:1;height:1px;background:#ECECEC}
`

function fmt(v) {
  const d = v.replace(/\D/g, '').slice(0, 10)
  let o = d
  if (d.length > 3) o = d.slice(0, 3) + ' ' + d.slice(3)
  if (d.length > 6) o = d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6)
  if (d.length > 8) o = d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8)
  return { d, o }
}

// Вызов Edge Function через клиент (он сам идёт через прокси /supabase и ставит ключ).
// При не-2xx ответ нашей функции лежит в error.context — достаём оттуда {ok,error}.
async function invoke(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error && error.context && typeof error.context.json === 'function') {
    try { return await error.context.json() } catch { return { ok: false, error: 'server' } }
  }
  return data || { ok: false, error: 'server' }
}

export default function LoginPage({ onSuccess, onBack, title = 'Вход по телефону', role = 'client' }) {
  const [step, setStep] = useState('phone')
  const [raw, setRaw] = useState('')
  const [display, setDisplay] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [left, setLeft] = useState(0)
  const cells = useRef([])
  const timer = useRef(null)
  const tgBox = useRef(null)

  useEffect(() => () => clearInterval(timer.current), [])

  // Telegram Login Widget: рисуется только на домене, привязанном в BotFather.
  // Поэтому вне app.ebookee.app скрипт не вставляем — телефон остаётся рабочим.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hostname !== 'app.ebookee.app') return
    const box = tgBox.current
    if (!box) return
    window.onTelegramAuth = (user) => onTgAuth(user)
    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-widget.js?22'
    s.async = true
    s.setAttribute('data-telegram-login', TG_BOT)
    s.setAttribute('data-size', 'large')
    s.setAttribute('data-radius', '12')
    s.setAttribute('data-request-access', 'write')
    s.setAttribute('data-onauth', 'onTelegramAuth(user)')
    box.appendChild(s)
    return () => { box.innerHTML = ''; try { delete window.onTelegramAuth } catch (_) {} }
  }, [])

  async function onTgAuth(user) {
    setBusy(true); setErr('')
    const r = await invoke('verify-tg', user)
    if (r.ok) {
      if (role === 'executor') {
        const exec = (r.profiles || []).find(p => p.role === 'executor')
        if (exec) { saveSession(exec); onSuccess?.(exec); return }
        // Новый работник — как в мини-аппе: запоминаем личность (с ником из виджета) и ведём на регистрацию
        const base = r.user || {}
        saveSession({ ...base, telegram_username: base.telegram_username || (user.username ? user.username.toLowerCase() : null) })
        window.location.href = '?register=executor'
        return
      }
      saveSession(r.user); onSuccess?.(r.user); return
    }
    setBusy(false)
    setErr(role === 'executor'
      ? 'Не удалось войти через Telegram.'
      : 'Не удалось войти через Telegram. Попробуйте по номеру.')
  }

  function onPhone(e) {
    const { d, o } = fmt(e.target.value)
    setRaw(d); setDisplay(o); setErr('')
  }

  function startTimer() {
    setLeft(60)
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      setLeft(v => { if (v <= 1) { clearInterval(timer.current); return 0 } return v - 1 })
    }, 1000)
  }

  async function sendCode() {
    if (raw.length !== 10) { setErr('Введите номер полностью.'); return }
    setBusy(true); setErr('')
    const r = await invoke('send-code', { phone: '7' + raw })
    setBusy(false)
    if (r.ok) { setStep('code'); startTimer(); setTimeout(() => cells.current[0]?.focus(), 50) }
    else if (r.error === 'too_soon') setErr('Код уже отправлен. Подождите минуту.')
    else if (r.error === 'too_many' || r.error === 'service_busy') setErr('Слишком много запросов. Попробуйте позже.')
    else setErr('Не удалось отправить код. Попробуйте ещё раз.')
  }

  async function verify() {
    const code = cells.current.map(c => c?.value || '').join('')
    if (code.length !== 4) return
    setBusy(true); setErr('')
    const r = await invoke('verify-code', { phone: '7' + raw, code })
    if (r.ok) { saveSession(r.user); onSuccess?.(r.user); return }
    setBusy(false)
    setErr(
      r.error === 'wrong_code' ? 'Неверный код.' :
      r.error === 'expired' ? 'Код истёк. Запросите новый.' :
      r.error === 'too_many_attempts' ? 'Много попыток. Запросите новый код.' :
      'Не получилось войти. Попробуйте ещё раз.'
    )
    cells.current.forEach(c => { if (c) c.value = '' })
    cells.current[0]?.focus()
  }

  function onCell(i, e) {
    const v = e.target.value.replace(/\D/g, '')
    e.target.value = v.slice(-1)
    setErr('')
    if (v && i < 3) cells.current[i + 1]?.focus()
    if (cells.current.every(c => c?.value)) verify()
  }
  function onCellKey(i, e) {
    if (e.key === 'Backspace' && !e.target.value && i > 0) {
      cells.current[i - 1]?.focus()
      if (cells.current[i - 1]) cells.current[i - 1].value = ''
    }
  }
  function onPaste(e) {
    e.preventDefault()
    const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4)
    d.split('').forEach((n, k) => { if (cells.current[k]) cells.current[k].value = n })
    if (d.length === 4) verify()
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="eblogin-screen">
        <div className="eblogin-brand">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path d="M15 2C9.5 2 5 6.4 5 11.8c0 6.9 8.3 14.7 9.3 15.6.4.4 1 .4 1.4 0 1-.9 9.3-8.7 9.3-15.6C25 6.4 20.5 2 15 2z" fill="#161616" />
            <circle cx="15" cy="11.8" r="4.6" fill="#FFC01E" />
          </svg>
          <span>Ebookee</span>
        </div>

        {step === 'phone' && (
          <div className="eblogin-card">
            <h1 className="eblogin-h1">{title}</h1>
            {typeof window !== 'undefined' && window.location.hostname === 'app.ebookee.app'
              ? <div className="eblogin-tg" ref={tgBox} />
              : <div className="eblogin-tghint">Вход через Telegram доступен на app.ebookee.app</div>}
            {role !== 'executor' && (<>
              <div className="eblogin-or">или по номеру телефона</div>
              <p className="eblogin-lead">Введите номер — пришлём код в SMS. Пароль не нужен.</p>
              <label className="eblogin-label">Номер телефона</label>
              <div className="eblogin-phone">
                <span className="eblogin-cc">+7</span>
                <input value={display} onChange={onPhone} type="tel" inputMode="numeric"
                  placeholder="900 000-00-00" maxLength={15} autoComplete="tel"
                  onKeyDown={e => { if (e.key === 'Enter') sendCode() }} />
              </div>
              <button className="eblogin-btn" onClick={sendCode} disabled={busy}>
                {busy ? 'Отправляю…' : 'Получить код'}
              </button>
            </>)}
            {err && <div className="eblogin-msg err">{err}</div>}
            {onBack && <button className="eblogin-link" style={{ marginTop: 14 }} onClick={onBack}>← Назад</button>}
            <p className="eblogin-fine">Продолжая, вы соглашаетесь с условиями сервиса и политикой обработки данных.</p>
          </div>
        )}

        {step === 'code' && (
          <div className="eblogin-card">
            <h1 className="eblogin-h1">Введите код</h1>
            <p className="eblogin-lead">Отправили на <b>+7 {display}</b></p>
            <div className="eblogin-otp" onPaste={onPaste}>
              {[0, 1, 2, 3].map(i => (
                <input key={i} ref={el => (cells.current[i] = el)} type="tel" inputMode="numeric"
                  maxLength={1} onChange={e => onCell(i, e)} onKeyDown={e => onCellKey(i, e)} />
              ))}
            </div>
            {err && <div className="eblogin-msg err">{err}</div>}
            <button className="eblogin-btn" onClick={verify} disabled={busy}>
              {busy ? 'Проверяю…' : 'Войти'}
            </button>
            <div className="eblogin-sub">
              <button className="eblogin-link" onClick={() => { setStep('phone'); setErr(''); clearInterval(timer.current) }}>← Изменить номер</button>
              <span className="eblogin-timer">
                {left > 0
                  ? `Повторить через 0:${String(left).padStart(2, '0')}`
                  : <button className="eblogin-link" style={{ color: '#161616' }} onClick={sendCode}>Отправить заново</button>}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
