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