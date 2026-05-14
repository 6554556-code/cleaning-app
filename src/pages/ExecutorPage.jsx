import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function ExecutorPage({ executorId }) {
  const [orders, setOrders] = useState([])
  const [executor, setExecutor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('orders')

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      const { data: executorData } = await supabase
        .from('executors')
        .select('*, users(full_name)')
        .eq('id', executorId)
        .single()

      setExecutor(executorData)

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, client:client_id(full_name, phone)')
        .eq('executor_id', executorId)
        .order('scheduled_at', { ascending: true })

      setOrders(ordersData || [])
      setLoading(false)
    }
    loadData()
  }, [executorId])
  function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getStatusLabel(status) {
    const statuses = {
      new: { label: 'Новая', color: '#f5a623', bg: '#fff8ed' },
      in_progress: { label: 'В работе', color: '#2481cc', bg: '#e8f4fd' },
      done: { label: 'Выполнена', color: '#16a34a', bg: '#f0fdf4' },
      cancelled: { label: 'Отменена', color: '#dc2626', bg: '#fef2f2' },
    }
    return statuses[status] || { label: status, color: '#666', bg: '#f0f0f0' }
  }

  if (loading) return <p style={{ padding: '20px' }}>Загружаем данные...</p>

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>

      {/* Профиль */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 4px' }}>{executor?.users?.full_name}</h2>
        <p style={{ margin: '0', color: '#666' }}>⭐ {executor?.rating} · 📦 {executor?.orders_count} заказов</p>
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'orders', label: '📋 Заявки' },
          { id: 'schedule', label: '📅 Расписание' },
          { id: 'earnings', label: '💰 Заработок' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === tab.id ? '#2481cc' : '#f0f0f0',
              color: activeTab === tab.id ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Заявки */}
      {activeTab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center' }}>Заявок пока нет</p>
          ) : (
            orders.map(order => {
              const status = getStatusLabel(order.status)
              return (
                <div key={order.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>{order.client?.full_name}</h4>
                    <span style={{
                      background: status.bg,
                      color: status.color,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '13px'
                    }}>{status.label}</span>
                  </div>
                  <p style={{ margin: '8px 0 4px', fontSize: '14px' }}>📍 {order.address}</p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>📅 {formatDate(order.scheduled_at)}</p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>📞 {order.client?.phone}</p>
<p style={{ margin: '4px 0', fontSize: '14px' }}>💬 {order.comment || 'Без комментария'}</p>
<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
  <a href={`tel:${order.client?.phone}`} style={{
    flex: 1,
    padding: '8px',
    background: '#f0f0f0',
    color: 'black',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'center',
    textDecoration: 'none'
  }}>📞 Позвонить</a>
</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    {order.status === 'new' && (
                      <button
                        onClick={async () => {
                          await supabase.from('orders').update({ status: 'in_progress' }).eq('id', order.id)
                          setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'in_progress' } : o))
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: '#2481cc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ✅ Принять
                      </button>
                    )}
                    {order.status === 'in_progress' && (
                      <button
                        onClick={async () => {
                          await supabase.from('orders').update({ status: 'done' }).eq('id', order.id)
                          setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'done' } : o))
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: '#16a34a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        🏁 Завершить
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Расписание */}
      {activeTab === 'schedule' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#666', textAlign: 'center' }}>Расписание — скоро 🚀</p>
        </div>
      )}

      {/* Заработок */}
      {activeTab === 'earnings' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#666', textAlign: 'center' }}>Статистика заработка — скоро 🚀</p>
        </div>
      )}

    </div>
  )
}

export default ExecutorPage