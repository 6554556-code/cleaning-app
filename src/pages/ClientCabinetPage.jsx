import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import ReviewModal from "../components/ReviewModal.jsx";
import { canLeaveReview } from "../reviewsUtils.js";
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
  const [tab, setTab] = useState(() => localStorage.getItem('clientCabinetTab') || 'future')
// Отзывы клиента: { order_id: review_object }
const [reviewsByOrder, setReviewsByOrder] = useState({})
// Какой заказ сейчас открыт в модалке отзыва (или null)
const [reviewModalOrder, setReviewModalOrder] = useState(null)
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
  // 4. Грузим все отзывы клиента — группируем по executor_id (один отзыв на исполнителя)
  const { data: reviewsData } = await supabase
  .from('reviews')
  .select('id, order_id, executor_id, rating, comment, on_time')
  .eq('client_id', clientId)
  const reviewsMap = {}
  ;(reviewsData || []).forEach(r => {
  reviewsMap[r.executor_id] = r
  })
  setReviewsByOrder(reviewsMap)
    setOrders(ordersWithNames)
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [clientId])
  function normalizePhone(raw) {
    if (!raw) return null
    let p = raw.replace(/[^\d+]/g, '')      // убираем всё кроме цифр и +
    if (p.startsWith('+')) return p          // уже международный — не трогаем
    if (p.length === 11 && p.startsWith('8')) return '+7' + p.slice(1)
    if (p.length === 11 && p.startsWith('7')) return '+' + p
    return p                                 // иностранные/прочие — как есть
  }
  function copyPhone(raw) {
    const phone = normalizePhone(raw)
    if (!phone) return
    navigator.clipboard?.writeText(phone)
    alert('Номер скопирован: ' + phone)
  }
  function callPhone(raw) {
    const phone = normalizePhone(raw)
    if (!phone) {
      alert('У этого исполнителя не указан телефон')
      return
    }
    window.location.href = 'tel:' + phone
  }
  async function cancelOrder(orderId) {
    if (!confirm('Отменить эту бронь?')) return

    // 1. Меняем статус заказа + помечаем кем отменён
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', cancelled_by: 'client' })
      .eq('id', orderId)

    if (error) {
      alert('Ошибка отмены: ' + error.message)
      return
    }

    // 2. Освобождаем время у исполнителя: чистим авто-блоки (буфер и дорогу)
    await supabase
      .from('blocks')
      .delete()
      .eq('order_id', orderId)
      .in('type', ['auto_travel', 'auto_buffer'])

    loadOrders()
  }

  // Разделение по времени окончания заказа, статус не влияет.
  // Если время окончания заказа в будущем — Будущие, иначе — Прошедшие.
  function getOrderEndTime(o) {
    if (!o.scheduled_at) return 0
    return new Date(o.scheduled_at).getTime() + (o.total_duration || 60) * 60000
  }
  const now = Date.now()
  const futureOrders = orders.filter(o => getOrderEndTime(o) >= now)
  const pastOrders = orders.filter(o => getOrderEndTime(o) < now)

  const shown = tab === 'future' ? futureOrders : pastOrders

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
          onClick={() => { setTab('future'); localStorage.setItem('clientCabinetTab', 'future') }}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
            border: tab === 'future' ? '2px solid #2481cc' : '2px solid #f0f0f0',
            background: tab === 'future' ? '#f0f7ff' : 'white',
            color: tab === 'future' ? '#2481cc' : '#888', fontWeight: 'bold'
          }}
        >
          Будущие ({futureOrders.length})
        </button>
        <button
          onClick={() => { setTab('past'); localStorage.setItem('clientCabinetTab', 'past') }}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
            border: tab === 'past' ? '2px solid #2481cc' : '2px solid #f0f0f0',
            background: tab === 'past' ? '#f0f7ff' : 'white',
            color: tab === 'past' ? '#2481cc' : '#888', fontWeight: 'bold'
          }}
        >
          Прошедшие ({pastOrders.length})
        </button>
      </div>

      {/* Список заказов */}
      {shown.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          {tab === 'future' ? 'Активных заказов нет' : 'История пуста'}
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
            <div style={{ textAlign: 'right' }}>
  <div style={{ fontSize: '10px', color: '#bbb', marginBottom: '2px' }}>#{order.id}</div>
  <span style={{ fontSize: '12px' }}>{STATUS_LABELS[order.status] || order.status}</span>
</div>
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
         

            {/* Кнопка "Опаздываю" — только в окне (за 2 часа до — +15 мин после начала) */}
            {tab === 'future' && (
              <DelayWidget order={order} onSaved={loadOrders} />
            )}

            {/* Личная заметка клиента к заказу (видит только сам клиент) */}
            {tab === 'future' && (
              <ClientNoteField order={order} onSaved={loadOrders} />
            )}

            {/* Кнопки связи с исполнителем — только для активных заказов */}
            {tab === 'future' && (order.executorTelegram || order.executorPhone) && (
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
                  <button
                    onClick={() => callPhone(order.executorPhone)}
                    style={{
                      flex: 1, padding: '8px', textAlign: 'center',
                      background: '#f0f0f0', color: 'black', border: 'none',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
                    }}
                  >
                    📞 Позвонить
                  </button>
                )}
              </div>
            )}

            {order.executorPhone && (
              <div
                onClick={() => copyPhone(order.executorPhone)}
                style={{
                  marginTop: '6px', textAlign: 'center', fontSize: '12px',
                  color: '#888', cursor: 'pointer'
                }}
              >
                📋 {normalizePhone(order.executorPhone)} (нажми, чтобы скопировать)
              </div>
            )}

            {/* Кнопка отмены — только для активных */}
            {tab === 'future' && (
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

            {/* Отзыв — только на вкладке "Прошедшие" */}
            {tab === 'past' && (() => {
              const existingReview = reviewsByOrder[order.executor_id]
              const check = canLeaveReview(order)
              if (existingReview) {
                // Уже есть отзыв — показываем его кратко + кнопку редактировать
                return (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#f9f9f9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '16px', color: '#ffc107', marginBottom: '4px' }}>
                      {'★'.repeat(existingReview.rating)}{'☆'.repeat(5 - existingReview.rating)}
                    </div>
                    {existingReview.order_id !== order.id && (
                      <p style={{ margin: '2px 0', fontSize: '11px', color: '#888' }}>
                        Отзыв оставлен по заказу от {(() => {
                          const otherOrder = orders.find(o => o.id === existingReview.order_id)
                          return otherOrder?.scheduled_at
                            ? new Date(otherOrder.scheduled_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                            : 'другой даты'
                        })()}
                      </p>
                    )}
                    {existingReview.comment && (
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#444' }}>{existingReview.comment}</p>
                    )}
                    <button
                      onClick={() => setReviewModalOrder(order)}
                      style={{
                        marginTop: '4px', padding: '6px 12px',
                        background: 'white', color: '#2481cc', border: '1px solid #2481cc',
                        borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                      }}
                    >
                      Редактировать
                    </button>
                  </div>
                )
              }
              if (check.allowed) {
                // Можно оставить — показываем кнопку
                return (
                  <button
                    onClick={() => setReviewModalOrder(order)}
                    style={{
                      marginTop: '8px', width: '100%', padding: '8px',
                      background: '#2481cc', color: 'white', border: 'none',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
                    }}
                  >
                    ⭐ Оставить отзыв
                  </button>
                )
              }
              // Нельзя оставить (ручной заказ, не подтверждён и т.п.) — не показываем ничего
              return null
            })()}
          </div>
        ))
      )}

      {/* Модалка отзыва */}
      {reviewModalOrder && (
        <ReviewModal
          order={reviewModalOrder}
          existingReview={reviewsByOrder[reviewModalOrder.executor_id] || null}
          onClose={() => setReviewModalOrder(null)}
          onSaved={loadOrders}
        />
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
// Считает контекст опоздания для исполнителя:
// — следующий заказ исполнителя после текущего
// — буфер, который можно сократить
// Возвращает готовый текст вида "Следующий заказ через 45 мин, есть 15 мин буфера — успеете"
async function buildDelayContext(order, delayMinutes) {
  const scheduledMs = new Date(order.scheduled_at).getTime()
  const durationMin = order.total_duration || 60
  // Конец текущего заказа БЕЗ учёта опоздания (буфер/дорога после)
  const currentEndMs = scheduledMs + durationMin * 60 * 1000
  // Конец текущего заказа С учётом опоздания клиента
  const delayedEndMs = currentEndMs + delayMinutes * 60 * 1000
  // Конец сегодняшнего дня (для проверки "до конца дня свободно")
  const endOfDayMs = new Date(order.scheduled_at)
  endOfDayMs.setHours(23, 59, 59, 999)

  // Ищем ближайший следующий заказ исполнителя
  const { data: nextOrders } = await supabase
    .from('orders')
    .select('id, scheduled_at, total_duration')
    .eq('executor_id', order.executor_id)
    .neq('status', 'cancelled')
    .neq('is_deleted', true)
    .neq('id', order.id)
    .gte('scheduled_at', new Date(currentEndMs).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)

  const nextOrder = nextOrders && nextOrders[0]

  // Ищем буферный блок (auto_buffer) после текущего заказа
  const { data: bufferBlocks } = await supabase
    .from('blocks')
    .select('start_at, duration')
    .eq('executor_id', order.executor_id)
    .eq('order_id', order.id)
    .eq('type', 'auto_buffer')
    .limit(1)

  const buffer = bufferBlocks && bufferBlocks[0]
  const bufferMin = buffer ? (buffer.duration || 0) : 0

  // Если нет следующего заказа — до конца дня свободно
  if (!nextOrder) {
    return `🟢 До конца дня других заказов нет — успеете без спешки.`
  }

  // Проверяем, в этот же день ли следующий заказ
  const currentDay = new Date(order.scheduled_at).toDateString()
  const nextDay = new Date(nextOrder.scheduled_at).toDateString()
  if (currentDay !== nextDay) {
    return `🟢 Сегодня других заказов нет — успеете без спешки.`
  }

  // Есть следующий в этот же день — считаем "запас"
  const nextStartMs = new Date(nextOrder.scheduled_at).getTime()
  const gapMin = Math.floor((nextStartMs - delayedEndMs) / 60000)

  // Сценарии:
  if (gapMin >= 30) {
    return `✅ После заказа ещё ${gapMin} мин — кофе, перекур, что хотите.`
  }
  if (gapMin >= 0 && bufferMin > 0) {
    return `⚠️ Времени мало — ${gapMin} мин. Можно пожертвовать перерывом ☕ (${bufferMin} мин) и не суетиться.`
  }
  if (gapMin >= 0) {
    return `⚠️ Следующий через ${gapMin} мин — придётся подсуетиться.`
  }
  // Опоздание перекрывает начало следующего заказа
  return `🚨 С опозданием заказ перекрывает следующий на ${Math.abs(gapMin)} мин. Срочно свяжитесь со следующим клиентом.`
}
// Кнопка "Опаздываю" — для клиента, чтобы предупредить исполнителя
function DelayWidget({ order, onSaved }) {
  const [saving, setSaving] = useState(false)

  // Определяем, в окне ли мы (за 2 часа до начала — до scheduled_at +15 мин)
  const scheduledMs = new Date(order.scheduled_at).getTime()
  const nowMs = Date.now()
  const inWindow = nowMs >= scheduledMs - 2 * 60 * 60 * 1000 && nowMs <= scheduledMs + 15 * 60 * 1000

  // Если статус терминальный — не показываем
  if (order.status === 'done' || order.status === 'cancelled') return null

  // Если уже нажимали — показываем уведомление о выбранном опоздании
  if (order.client_delay_minutes) {
    const newTimeMs = scheduledMs + order.client_delay_minutes * 60 * 1000
    const newTimeStr = new Date(newTimeMs).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return (
      <div style={{
        marginTop: '8px', padding: '10px',
        background: '#fff8ed', borderLeft: '3px solid #f5a623',
        borderRadius: '4px', fontSize: '13px', color: '#666',
        lineHeight: '1.4'
      }}>
        ✅ Специалист оповещён об опоздании на {order.client_delay_minutes} мин.
        <br />
        Примерное время встречи: <b>{newTimeStr}</b>
      </div>
    )
  }

  // Если не в окне — ничего не показываем
  if (!inWindow) return null

  // В окне и ещё не нажимали — три кнопки опоздания
  async function setDelay(mins) {
    setSaving(true)
    
    // Считаем "контекст опоздания" — что будет с следующим заказом
    const contextText = await buildDelayContext(order, mins)
    
    const { error } = await supabase
      .from('orders')
      .update({ 
        client_delay_minutes: mins,
        delay_context_text: contextText
      })
      .eq('id', order.id)
    setSaving(false)
    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }
    onSaved()
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Опаздываете?</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[5, 10, 15, 30].map(m => (
          <button
            key={m}
            onClick={() => setDelay(m)}
            disabled={saving}
            style={{
              flex: 1, padding: '8px 4px',
              background: 'white', color: '#f5a623',
              border: '1px solid #f5a623', borderRadius: '6px',
              cursor: saving ? 'wait' : 'pointer', fontSize: '13px'
            }}
          >
            +{m} мин
          </button>
        ))}
      </div>
    </div>
  )
}
export default ClientCabinetPage