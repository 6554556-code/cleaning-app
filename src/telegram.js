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
  const username = user.username.toLowerCase()

  // 1. Обновляем username для существующего пользователя
  await supabase
    .from('users')
    .update({ telegram_username: username })
    .eq('telegram_id', user.telegram_id)

  // 2. Дозамыкание: ищем "предзаказы" по username и проставляем им client_id
  // (заказы, которые исполнитель создал вручную, указав @username клиента,
  // и который теперь впервые зашёл в приложение)
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', user.telegram_id)
    .maybeSingle()

  if (existingUser) {
    await supabase
      .from('orders')
      .update({ client_id: existingUser.id })
      .is('client_id', null)
      .eq('client_telegram_username', username)
  }
}