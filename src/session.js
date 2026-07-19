// Слой сессии для веб-входа.
// Внутри Telegram личность берётся из SDK (getTelegramUser) — сюда не пишем.
// На вебе после входа по телефону кладём сюда строку users залогиненного человека.
import { getTelegramUser } from './telegram'

const KEY = 'ebookee_session'

export function saveSession(userRow) {
  try { localStorage.setItem(KEY, JSON.stringify(userRow)) } catch { /* приватный режим и т.п. */ }
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function clearSession() {
  try { localStorage.removeItem(KEY) } catch { /* no-op */ }
}

// Есть ли вообще личность прямо сейчас:
// - внутри Telegram: да, по SDK
// - на вебе: да, если есть сохранённая сессия
export function isAuthed() {
  return !!getTelegramUser()?.telegram_id || !!getSession()?.id
}
