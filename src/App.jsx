import ClientPage from './pages/ClientPage'
import ExecutorPage from './pages/ExecutorPage'

function App() {
  const isExecutor = window.location.search.includes('executor=1')
  
  if (isExecutor) {
    return <ExecutorPage executorId={1} />
  }
  
  return <ClientPage />
}

export default App