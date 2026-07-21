import ClientPage from './pages/ClientPage'
import ExecutorPage from './pages/ExecutorPage'
import MapPage from './pages/MapPage'
import RegisterExecutorPage from './pages/RegisterExecutorPage'
import ClientCabinetPage from './pages/ClientCabinetPage'
import ExecutorSettingsPage from './pages/ExecutorSettingsPage'
import { useEffect, useState } from 'react'
import { initTelegram, getTelegramUser, syncTelegramUsername } from './telegram'
import { supabase } from './supabase'
import { getSession } from './session'
import LoginPage from './pages/LoginPage'

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
        }).then(({ error }) => {
          // Включённый "сенсор": раньше ошибки молча проглатывались через .then(() => {}).
          // Если инсерт упал (RLS, constraint, сеть, что угодно) — увидим в DevTools.
          if (error) {
            console.error('[app_opens] INSERT failed:', error.message, error)
          } else {
            console.log('[app_opens] insert ok for tg_user_id:', user.id)
          }
        })
      } else {
        console.warn('[app_opens] no Telegram user — skip insert (открыто не из Telegram?)')
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
    const tgUser = getTelegramUser()
    const session = getSession()
    // Веб без Telegram и без сессии-исполнителя — сперва вход по Telegram
    if (!tgUser?.telegram_id && session?.role !== 'executor') {
      return <LoginPage title="Вход для исполнителей" role="executor" onSuccess={() => window.location.reload()} />
    }
    return <ExecutorSettingsPage />
  }
  if (clientMatch) {
    const tgUser = getTelegramUser()
    const session = getSession()
    // На вебе без Telegram и без сессии — сперва вход
    if (!tgUser?.telegram_id && !session?.id) {
      return <LoginPage title="Вход в кабинет" onSuccess={() => window.location.reload()} />
    }
    // Веб-клиент видит СВОЙ кабинет (id из сессии), а не любой из адреса —
    // иначе на открытом вебе можно подставить чужой ?client=…
    const clientId = (!tgUser?.telegram_id && session?.id) ? session.id : Number(clientMatch[1])
    return <ClientCabinetPage clientId={clientId} />
  }
  if (executorMatch) {
    const tgUser = getTelegramUser()
    const session = getSession()
    // Веб без Telegram и без сессии-исполнителя — вход только по Telegram
    if (!tgUser?.telegram_id && session?.role !== 'executor') {
      return <LoginPage title="Вход для исполнителей" role="executor" onSuccess={() => window.location.reload()} />
    }
    return <ExecutorPage executorId={Number(executorMatch[1])} />
  }

  if (isMap) {
    return <MapPage />
  }

  return <ClientPage />
}

export default App
