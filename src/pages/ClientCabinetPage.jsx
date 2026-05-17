import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Статусы и их подписи
const STATUS_LABELS = {
  new: '🟡 Новая',
  confirmed_by_executor: '🔵 Подтверждена исполнителем',
  awaiting_client_confirmation: '🟠 Ждёт вашего подтверждения',
  confirmed_by_client: '🟢 Подтверждена вами',
  in_progress: '🟣 В работе',
  done: '✅ Выполнена',
  cancelled: '🔴 Отменена',
}

function ClientCabinetPage({ clientId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')

  async function loadOrders() {
    setLoading(true)

    // 1. Грузим заказы клиента
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', clientId)
      .neq('is_deleted', true)
      .order('scheduled_at', { ascending: false })

    if (error) {
      console.log('Ошибка загрузки:', error)
      setLoading(false)
      return
    }

    // 2. Грузим исполнителей, чтобы показать их имена
    const executorIds = [...new Set((ordersData || []).map(o => o.executor_id).filter(Boolean))]
    let executorsMap = {}
    if (executorIds.length > 0) {
      const { data: execData } = await supabase
        .from('executors')
        .select('id, users(full_name)')
        .in('id', executorIds)
      ;(execData || []).forEach(e => {
        executorsMap[e.id] = e.users?.full_name || 'Исполнитель'
      })
    }

    // 3. Прикрепляем имя исполнителя к каждому заказу
    const ordersWithNames = (ordersData || []).map(o => ({
      ...o,
      executorName: executorsMap[o.executor_id] || 'Исполнитель'
    }))

    setOrders(ordersWithNames)
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [clientId])

  async function cancelOrder(orderId) {
    if (!confirm('Отменить эту бронь?')) return
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
    if (error) {
      alert('Ошибка отмены: ' + error.message)
      return
    }
    loadOrders()
  }

  // Активные — всё кроме done и cancelled
  const activeOrders = orders.filter(o => o.status !== 'done' && o.status !== 'cancelled')
  // История — done и cancelled
  const historyOrders = orders.filter(o => o.status === 'done' || o.status === 'cancelled')

  const shown = tab === 'active' ? activeOrders : historyOrders

  if (loading) {
    return <div style={{ padding: '16px', textAlign: 'center' }}>Загрузка...</div>
  }

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>Мои заказы</h2>

      {/* Табы */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setTab('active')}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
            border: tab === 'active' ? '2px solid #2481cc' : '2px solid #f0f0f0',
            background: tab === 'active' ? '#f0f7ff' : 'white',
            color: tab === 'active' ? '#2481cc' : '#888', fontWeight: 'bold'
          }}
        >
          Активные ({activeOrders.length})
        </button>
        <button
          onClick={() => setTab('history')}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
            border: tab === 'history' ? '2px solid #2481cc' : '2px solid #f0f0f0',
            background: tab === 'history' ? '#f0f7ff' : 'white',
            color: tab === 'history' ? '#2481cc' : '#888', fontWeight: 'bold'
          }}
        >
          История ({historyOrders.length})
        </button>
      </div>

      {/* Список заказов */}
      {shown.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          {tab === 'active' ? 'Активных заказов нет' : 'История пуста'}
        </p>
      ) : (
        shown.map(order => (
          <div key={order.id} style={{
            background: 'white', borderRadius: '12px', padding: '16px',
            marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>{order.executorName}</h4>
              <span style={{ fontSize: '12px' }}>{STATUS_LABELS[order.status] || order.status}</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>🧹 {order.cleaning_type || '—'}</p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>
              📅 {order.scheduled_at ? new Date(order.scheduled_at).toLocaleString('ru-RU') : '—'}
            </p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>💰 {order.total_price || '—'} ₽</p>

            {/* Кнопка отмены — только для активных */}
            {tab === 'active' && (
              <button
                onClick={() => cancelOrder(order.id)}
                style={{
                  marginTop: '8px', width: '100%', padding: '8px',
                  background: 'white', color: '#ef4444', border: '1px solid #ef4444',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
                }}
              >
                Отменить бронь
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default ClientCabinetPage