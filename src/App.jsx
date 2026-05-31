import ClientPage from './pages/ClientPage'
import ExecutorPage from './pages/ExecutorPage'
import MapPage from './pages/MapPage'
import RegisterExecutorPage from './pages/RegisterExecutorPage'
import ClientCabinetPage from './pages/ClientCabinetPage'
import ExecutorSettingsPage from './pages/ExecutorSettingsPage'
import { useEffect } from 'react'
import { initTelegram, getTelegramUser, syncTelegramUsername, ensureAuthSession } from './telegram'
function App() {
  useEffect(() => {
    initTelegram()
    // Анонимный вход — нужен для загрузки фото в Storage (даёт роль authenticated)
    ensureAuthSession()
    // Синхронизируем username Telegram с базой (автоматически, если юзер из Telegram)
    syncTelegramUsername()
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