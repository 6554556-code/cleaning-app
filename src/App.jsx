import ClientPage from './pages/ClientPage'
import ExecutorPage from './pages/ExecutorPage'
import MapPage from './pages/MapPage'
import RegisterExecutorPage from './pages/RegisterExecutorPage'
import ClientCabinetPage from './pages/ClientCabinetPage'
function App() {
  const isExecutor = window.location.search.includes('executor=1')
  const isMap = window.location.search.includes('map=1')
  const isRegister = window.location.search.includes('register=executor')
  const clientMatch = window.location.search.match(/client=(\d+)/)
  if (isRegister) {
    return <RegisterExecutorPage />
  }
  if (clientMatch) {
    return <ClientCabinetPage clientId={Number(clientMatch[1])} />
  }
  if (isExecutor) {
    return <ExecutorPage executorId={1} />
  }

  if (isMap) {
    return <MapPage />
  }

  return <ClientPage />
}

export default App