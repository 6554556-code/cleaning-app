import ClientPage from './pages/ClientPage'
import ExecutorPage from './pages/ExecutorPage'
import MapPage from './pages/MapPage'

function App() {
  const isExecutor = window.location.search.includes('executor=1')
  const isMap = window.location.search.includes('map=1')

  if (isExecutor) {
    return <ExecutorPage executorId={1} />
  }

  if (isMap) {
    return <MapPage />
  }

  return <ClientPage />
}

export default App