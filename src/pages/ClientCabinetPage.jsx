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
        .select('id, address, users(full_name, phone, telegram_username)')
        .in('id', executorIds)
      ;(execData || []).forEach(e => {
        executorsMap[e.id] = {
          name: e.users?.full_name || 'Исполнитель',
          address: e.address || '',
          phone: e.users?.phone || '',
          telegram_username: e.users?.telegram_username || ''
        }
      })
    }

    // 3. Прикрепляем данные исполнителя к каждому заказу
    const ordersWithNames = (ordersData || []).map(o => ({
      ...o,
      executorName: executorsMap[o.executor_id]?.name || 'Исполнитель',
      executorAddress: executorsMap[o.executor_id]?.address || '',
      executorPhone: executorsMap[o.executor_id]?.phone || '',
      executorTelegram: executorsMap[o.executor_id]?.telegram_username || ''
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
      <a href="/" style={{ display: 'inline-block', marginBottom: '8px', fontSize: '14px', color: '#2481cc', textDecoration: 'none' }}>
        🏠 На главную
      </a>
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>Мои заказы</h2>

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
            <h4 style={{ margin: 0 }}>
              {order.location_type === 'incall' ? '🏠 ' : order.location_type === 'outcall' ? '🚗 ' : ''}
              {order.executorName}
            </h4>
              <span style={{ fontSize: '12px' }}>{STATUS_LABELS[order.status] || order.status}</span>
            </div>
            {/* Адрес поездки — крупно, если incall. Берём снимок с момента брони,
                а если его нет (старый заказ до миграции) — fallback на текущий адрес исполнителя. */}
            {order.location_type === 'incall' && (order.incall_address || order.executorAddress) && (
              <p style={{ margin: '4px 0 8px', fontSize: '15px', fontWeight: 'bold', color: '#2481cc' }}>
                📍 {order.incall_address || order.executorAddress}
              </p>
            )}
            <p style={{ margin: '4px 0', fontSize: '14px' }}>🧹 {order.cleaning_type || '—'}</p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>
              📅 {order.scheduled_at ? new Date(order.scheduled_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—'} · ⏱ {order.total_duration || '—'} мин
            </p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>💰 {order.total_price || '—'} ₽</p>

            {/* Служебная инфа: для кого + когда оформлен */}
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#999', lineHeight: '1.4' }}>
              {(order.client_name || order.client_phone || order.address) && (
                <>
                  <div>Заказ оформлен на:</div>
                  {order.client_name && <div>👤 {order.client_name}</div>}
                  {order.client_phone && <div>📞 {order.client_phone}</div>}
                  {order.address && <div>📍 {order.address}</div>}
                </>
              )}
              {order.created_at && (
                <div style={{ marginTop: '4px' }}>
                  🕐 Создан: {new Date(order.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            {/* Личная заметка клиента к заказу (видит только сам клиент) */}
            {tab === 'active' && (
              <ClientNoteField order={order} onSaved={loadOrders} />
            )}

            {/* Кнопки связи с исполнителем — только для активных заказов */}
            {tab === 'active' && (order.executorTelegram || order.executorPhone) && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {order.executorTelegram && (
                    <a 
                    href={`https://t.me/${order.executorTelegram}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1, padding: '8px', textAlign: 'center',
                      background: '#2481cc', color: 'white',
                      borderRadius: '8px', textDecoration: 'none', fontSize: '13px'
                    }}
                  >
                    💬 Написать
                  </a>
                )}
                {order.executorPhone && (
                  <a
                    href={`tel:${order.executorPhone}`}
                    style={{
                      flex: 1, padding: '8px', textAlign: 'center',
                      background: '#f0f0f0', color: 'black',
                      borderRadius: '8px', textDecoration: 'none', fontSize: '13px'
                    }}
                  >
                    📞 Позвонить
                  </a>
                )}
              </div>
            )}

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

// Личная заметка клиента к заказу (видит только сам клиент)
function ClientNoteField({ order, onSaved }) {
  const [note, setNote] = useState(order.client_note || '')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const hasNote = !!order.client_note

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('orders')
      .update({ client_note: note.trim() || null })
      .eq('id', order.id)
    setSaving(false)
    if (error) {
      alert('Ошибка сохранения заметки: ' + error.message)
      return
    }
    setExpanded(false)
    onSaved()
  }

  // Если заметка свёрнута — показываем либо саму заметку курсивом, либо кнопку "Добавить"
  if (!expanded) {
    return (
      <div style={{ marginTop: '8px' }}>
        {hasNote ? (
          <div
            onClick={() => setExpanded(true)}
            style={{
              padding: '8px 10px',
              background: '#fffbe6',
              borderLeft: '3px solid #f5a623',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#666',
              cursor: 'pointer',
              fontStyle: 'italic',
              lineHeight: '1.4'
            }}
          >
            📝 {order.client_note}
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 0'
            }}
          >
            + Добавить заметку
          </button>
        )}
      </div>
    )
  }

  // Развёрнутый режим — textarea + кнопки
  return (
    <div style={{ marginTop: '8px' }}>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Заметка для себя: что купить, что напомнить..."
        style={{
          width: '100%',
          minHeight: '60px',
          padding: '8px',
          borderRadius: '6px',
          border: '1px solid #ddd',
          fontSize: '13px',
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box'
        }}
      />
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            flex: 1, padding: '6px', fontSize: '12px',
            background: '#2481cc', color: 'white', border: 'none',
            borderRadius: '6px', cursor: saving ? 'wait' : 'pointer'
          }}
        >
          {saving ? 'Сохраняю...' : '💾 Сохранить'}
        </button>
        <button
          onClick={() => { setNote(order.client_note || ''); setExpanded(false) }}
          style={{
            flex: 1, padding: '6px', fontSize: '12px',
            background: 'white', color: '#666', border: '1px solid #ddd',
            borderRadius: '6px', cursor: 'pointer'
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

export default ClientCabinetPage