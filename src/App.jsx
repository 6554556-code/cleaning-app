import ClientPage from './pages/ClientPage'
import ExecutorPage from './pages/ExecutorPage'
import MapPage from './pages/MapPage'
import RegisterExecutorPage from './pages/RegisterExecutorPage'
import ClientCabinetPage from './pages/ClientCabinetPage'
import ExecutorSettingsPage from './pages/ExecutorSettingsPage'
import { useEffect } from 'react'
import { initTelegram, getTelegramUser, syncTelegramUsername } from './telegram'
import { supabase } from './supabase'
function App() {
  useEffect(() => {
    initTelegram()
    // Синхронизируем username Telegram с базой (автоматически, если юзер из Telegram)
    syncTelegramUsername()
    // Логируем открытие приложения
    setTimeout(() => {
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user
      supabase.from('app_opens').insert({
        tg_user_id: user?.id ?? null,
        username: user?.username ?? null,
      })
    }, 500)
  }, [])
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