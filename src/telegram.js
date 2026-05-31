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
  if (!user || !user.telegram_id) return

  const username = user.username ? user.username.toLowerCase() : null

  // 1. Проверяем — есть ли юзер с таким telegram_id
  // Берём всех юзеров с этим telegram_id и выбираем самого первого (минимальный id).
  // Устойчиво к дублям: maybeSingle() падал, когда строк было больше одной,
  // из-за чего код думал "юзера нет" и плодил новую запись при каждом входе.
  const { data: existingRows } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', user.telegram_id)
    .order('id', { ascending: true })
  const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null

  let userId

  if (existing) {
    // Юзер есть — обновляем username (на случай если поменялся)
    userId = existing.id
    if (username) {
      await supabase
        .from('users')
        .update({ telegram_username: username })
        .eq('id', userId)
    }
  } else {
    // Юзера нет — создаём новую запись (роль client).
    // upsert с onConflict: если параллельный запрос успел создать такого же
    // (telegram_id + role) — не падаем на уникальном индексе, а берём существующего.
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени'
    const { data: created } = await supabase
      .from('users')
      .upsert([{
        full_name: fullName,
        telegram_id: user.telegram_id,
        telegram_username: username,
        role: 'client'
      }], { onConflict: 'telegram_id,role' })
      .select('id')
      .single()
    userId = created?.id
  }

  // 2. Дозамыкание — работает и для нового, и для существующего
  if (userId && username) {
    await supabase
      .from('orders')
      .update({ client_id: userId })
      .is('client_id', null)
      .eq('client_telegram_username', username)
  }
}