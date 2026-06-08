import ClientPage from './pages/ClientPage'
import ExecutorPage from './pages/ExecutorPage'
import MapPage from './pages/MapPage'
import RegisterExecutorPage from './pages/RegisterExecutorPage'
import ClientCabinetPage from './pages/ClientCabinetPage'
import ExecutorSettingsPage from './pages/ExecutorSettingsPage'
import { useEffect, useState } from 'react'
import { initTelegram, getTelegramUser, syncTelegramUsername } from './telegram'
import { supabase } from './supabase'

function App() {
  // 'checking' пока ждём ответа БД, 'blocked' если в blocked_users, 'ok' во всех остальных случаях
  const [blockStatus, setBlockStatus] = useState('checking')

  useEffect(() => {
    initTelegram()
    // Синхронизируем username Telegram с базой (автоматически, если юзер из Telegram)
    syncTelegramUsername()
    // Логируем открытие приложения
    setTimeout(() => {
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user
      if (user) {
        supabase.from('app_opens').insert({
          tg_user_id: user.id,
          username: user.username ?? null,
        }).then(() => {})
      }
    }, 500)

    // Проверка блокировки по telegram_id
    const tgUser = getTelegramUser()
    const tgId = tgUser?.telegram_id
    if (!tgId) {
      // Открыто не из Telegram (нет telegram_id) — пропускаем
      setBlockStatus('ok')
      return
    }
    supabase
      .from('blocked_users')
      .select('telegram_id')
      .eq('telegram_id', tgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // Ошибка запроса — пропускаем юзера (fail-safe: лучше пропустить заблокированного, чем отрезать всех)
          console.error('Block check failed:', error)
          setBlockStatus('ok')
          return
        }
        setBlockStatus(data ? 'blocked' : 'ok')
      })
  }, [])

  // Пока идёт проверка — не рендерим ничего (мгновение)
  if (blockStatus === 'checking') {
    return null
  }

  // Заблокированному показываем маскировочный экран «технических работ»
  if (blockStatus === 'blocked') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        background: '#fafafa'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚙️</div>
        <h2 style={{ margin: '0 0 12px', fontSize: '20px', color: '#333' }}>
          Приложение временно недоступно
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#888', maxWidth: '300px', lineHeight: '1.5' }}>
          Попробуйте обновить страницу или зайти позже.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            background: '#2481cc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🔄 Перезагрузить
        </button>
      </div>
    )
  }

  // Дальше — обычный роутинг
  const executorMatch = window.location.search.match(/executor=(\d+)/)
  const isMap = window.location.search.includes('map=1')
  const isRegister = window.location.search.includes('register=executor')
  const isSettings = window.location.search.includes('settings=1')
  const clientMatch = window.location.search.match(/client=(\d+)/)
  if (isRegister) {
    return <RegisterExecutorPage />
  }
  if (isSettings) {
    return <ExecutorSettingsPage />
  }
  if (clientMatch) {
    return <ClientCabinetPage clientId={Number(clientMatch[1])} />
  }
  if (executorMatch) {
    return <ExecutorPage executorId={Number(executorMatch[1])} />
  }

  if (isMap) {
    return <MapPage />
  }

  return <ClientPage />
}

export default App
