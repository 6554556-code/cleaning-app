// Получаем объект Telegram WebApp
const tg = window.Telegram?.WebApp

// Сообщаем Telegram, что приложение готово, и разворачиваем на весь экран
export function initTelegram() {
  if (tg) {
    tg.ready()
    tg.expand()
  }
}

// Возвращает данные текущего пользователя Telegram
// Если приложение открыто НЕ в Telegram (например на localhost) — вернёт null
export function getTelegramUser() {
  const user = tg?.initDataUnsafe?.user
  if (!user) return null
  return {
    telegram_id: user.id,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || ''
  }
}
// Синхронизирует username Telegram с базой данных.
// Вызывается один раз при старте приложения, если юзер открыл его в Telegram.
import { supabase } from './supabase'

export async function syncTelegramUsername() {
  const user = getTelegramUser()
  if (!user || !user.telegram_id || !user.username) return
  
  // Обновляем username для существующего пользователя
  // (если его нет в БД — ничего не произойдёт, это нормально)
  await supabase
    .from('users')
    .update({ telegram_username: user.username })
    .eq('telegram_id', user.telegram_id)
}