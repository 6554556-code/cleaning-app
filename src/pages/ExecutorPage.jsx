import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import AddOrderPage from './AddOrderPage'
// Цвета статусов
const STATUS_COLORS = {
  new: '#fbbf24',
  confirmed_by_executor: '#3b82f6',
  awaiting_client_confirmation: '#f97316',
  confirmed_by_client: '#22c55e',
  in_progress: '#a855f7',
  done: '#16a34a',
  cancelled: '#ef4444',
}

const STATUS_LABELS = {
  new: 'Новая',
  confirmed_by_executor: 'Подтверждено вами',
  awaiting_client_confirmation: 'Ждём клиента',
  confirmed_by_client: 'Подтверждено клиентом',
  in_progress: 'В работе',
  done: 'Выполнено',
  cancelled: 'Отменено',
}
function BlockDetailsModal({ block, onClose, onSaved }) {
  const [reason, setReason] = useState(block.reason || '')
  const [duration, setDuration] = useState(block.duration)
  const [startTime, setStartTime] = useState(
    new Date(block.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  )
  const [saving, setSaving] = useState(false)

  
  async function save() {
    setSaving(true)
    const [h, m] = startTime.split(':').map(Number)
    const newStart = new Date(block.start_at)
    newStart.setHours(h, m, 0, 0)

    const { error } = await supabase
      .from('blocks')
      .update({ reason, duration, start_at: newStart.toISOString() })
      .eq('id', block.id)
    setSaving(false)
    if (error) {
      alert('Ошибка сохранения')
      return
    }
    onSaved()
  }

  async function deleteBlock() {
    if (!confirm('Удалить эту блокировку?')) return
    setSaving(true)
    await supabase.from('blocks').delete().eq('id', block.id)
    onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '400px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>
            {block.type === 'auto_travel' ? '🚗 Дорога' : block.type === 'auto_buffer' ? '☕ Авто-буфер' : '☕ Блокировка'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <p style={{ marginTop: '12px', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>Время начала</p>
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }} />

        <p style={{ marginTop: '12px', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>Длительность (мин)</p>
        <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }} />

        <p style={{ marginTop: '12px', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>Причина / комментарий</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Например: обед, прием у врача" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', minHeight: '60px', boxSizing: 'border-box', resize: 'vertical' }} />

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={deleteBlock} disabled={saving} style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>Удалить</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '12px', background: '#2481cc', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
function OrderDetailsModal({ order, onClose, onSaved }) {
  const [status, setStatus] = useState(order.status)
  const [comment, setComment] = useState(order.executor_comment || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('orders')
      .update({ status, executor_comment: comment })
      .eq('id', order.id)
    setSaving(false)
    if (error) {
      alert('Ошибка сохранения: ' + error.message)
      return
    }
    onSaved()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '400px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Заказ #{order.id}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Клиент:</b> {order.client?.full_name || order.name || '—'}</p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Телефон:</b> {order.client?.phone || order.phone || '—'}</p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Услуга:</b> {order.cleaning_type || '—'}</p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Время:</b> {new Date(order.scheduled_at).toLocaleString('ru-RU')}</p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Длительность:</b> {order.total_duration || '—'} мин</p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Цена:</b> {order.total_price || '—'} ₽</p>
        {order.address && <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Адрес:</b> {order.address}</p>}
        {order.comment && <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}><b>От клиента:</b> {order.comment}</p>}

        <p style={{ marginTop: '16px', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>Статус</p>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <p style={{ marginTop: '12px', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>Комментарий исполнителя</p>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Например: клиент опаздывает на 15 мин" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', minHeight: '60px', boxSizing: 'border-box', resize: 'vertical' }} />

        <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: '12px', padding: '12px', background: '#2481cc', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
// Модалка создания перерыва
function BreakModal({ executor, day, onClose, onSaved }) {
  const [time, setTime] = useState('13:00')
  const [duration, setDuration] = useState(60)
  const [reason, setReason] = useState('Перерыв')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    // Собираем дату + время в один момент
    const [h, m] = time.split(':').map(Number)
    const startAt = new Date(day)
    startAt.setHours(h, m, 0, 0)

    const { error } = await supabase.from('blocks').insert({
      executor_id: executor.id,
      start_at: startAt.toISOString(),
      duration: Number(duration),
      reason: reason,
      type: 'manual'
    })

    setSaving(false)
    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      onSaved()
    }
  }

  const dateLabel = day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '320px' }}
      >
        <h3 style={{ margin: '0 0 4px' }}>☕ Новый перерыв</h3>
        <p style={{ margin: '0 0 16px', color: '#666', fontSize: '13px' }}>{dateLabel}</p>

        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Время начала</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Длительность (минут)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Причина</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', border: '1px solid #ddd', background: 'white', borderRadius: '6px', cursor: 'pointer' }}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, padding: '10px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
          >
            {saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
function ScheduleView({ executor, orders, blocks, onReload, onCreateOrder }) {
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [expandedBefore, setExpandedBefore] = useState(false)
  const [expandedAfter, setExpandedAfter] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [clickMenu, setClickMenu] = useState(null)
  const [breakDay, setBreakDay] = useState(null)
  if (!executor) return null

  // Парсим время работы
  const [workStartH, workStartM] = executor.work_start.split(':').map(Number)
  const [workEndH, workEndM] = executor.work_end.split(':').map(Number)
  const workStartMin = workStartH * 60 + workStartM
  const workEndMin = workEndH * 60 + workEndM
  const viewStartMin = expandedBefore ? 0 : workStartMin
  const viewEndMin = expandedAfter ? 24 * 60 : workEndMin
  const totalMinutes = viewEndMin - viewStartMin

  // Высота 1 минуты в пикселях
  const PX_PER_MIN = 1.2

  // Начало 3-дневного окна
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(today.getDate() + weekOffset * 3)

  const days = [0, 1, 2].map(i => {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    return d
  })

  function formatDay(d) {
    const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    return `${labels[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  function getOrdersForDay(date) {
    return orders.filter(o => {
      if (!o.scheduled_at) return false
      const d = new Date(o.scheduled_at)
      return d.toDateString() === date.toDateString()
    })
  }
  function getBlocksForDay(date) {
    return blocks.filter(b => {
      if (!b.start_at) return false
      const d = new Date(b.start_at)
      return d.toDateString() === date.toDateString()
    })
  }
  // Время на дороге и буфер
  const travelTime = executor.travel_time || 0
  const bufferTime = executor.buffer_time || 0

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      {/* Переключатель недель */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <button onClick={() => setWeekOffset(weekOffset - 1)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>← Назад</button>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {formatDay(days[0])} — {formatDay(days[2])}
        </span>
        <button onClick={() => setWeekOffset(weekOffset + 1)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Вперёд →</button>
      </div>

      {/* Стрелка "раньше" */}
      {workStartMin > 0 && (
        <button
          onClick={() => setExpandedBefore(!expandedBefore)}
          style={{ width: '100%', padding: '4px', background: '#f9fafb', border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#888', marginBottom: '4px' }}
        >
          {expandedBefore ? '▼ Скрыть ранние часы' : '▲ Показать ранние часы'}
        </button>
      )}

      {/* Сетка */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {/* Колонка времени */}
        <div style={{ width: '40px', flexShrink: 0 }}>
          <div style={{ height: '28px' }}></div>
          {Array.from({ length: Math.ceil(totalMinutes / 60) + 1 }).map((_, i) => {
            const hour = Math.floor((viewStartMin + i * 60) / 60) % 24
            return (
              <div key={i} style={{ height: `${60 * PX_PER_MIN}px`, fontSize: '11px', color: '#888', textAlign: 'right', paddingRight: '4px' }}>
                {String(hour).padStart(2, '0')}:00
              </div>
            )
          })}
        </div>

        {/* Колонки дней */}
        {days.map((day, i) => {
          const dayOrders = getOrdersForDay(day)
          const dayBlocks = getBlocksForDay(day)
          const now = new Date()
          const isToday = day.toDateString() === now.toDateString()
          const nowMin = now.getHours() * 60 + now.getMinutes()
          const nowTop = (nowMin - viewStartMin) * PX_PER_MIN
          const showNow = isToday && nowMin >= workStartMin && nowMin <= workEndMin
          return (
            <div key={i} style={{ flex: 1, position: 'relative' }}>
              <div style={{ height: '28px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>
                {formatDay(day)}
              </div>
              <div 
  onClick={(e) => {
    if (e.target !== e.currentTarget) return
    setClickMenu({ x: e.clientX, y: e.clientY, day })
  }}
  style={{ position: 'relative', height: `${totalMinutes * PX_PER_MIN}px`, background: '#fafafa', borderRadius: '4px', cursor: 'pointer' }}
>
                {/* Линии часов */}
                {Array.from({ length: Math.ceil(totalMinutes / 60) }).map((_, h) => (
                  <div key={h} style={{ position: 'absolute', top: `${h * 60 * PX_PER_MIN}px`, left: 0, right: 0, height: '1px', background: '#eee' }}></div>
                ))}
                {/* Линия "сейчас" */}
                {showNow && (
                  <div style={{ position: 'absolute', top: `${nowTop}px`, left: 0, right: 0, height: '2px', background: '#ef4444', zIndex: 5 }}>
                    <div style={{ position: 'absolute', left: '-4px', top: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                  </div>
                )}
{/* Блоки (перерывы, дорога) */}
{dayBlocks.map(block => {
                  const blockDate = new Date(block.start_at)
                  const blockMin = blockDate.getHours() * 60 + blockDate.getMinutes()
                  const blockTop = (blockMin - viewStartMin) * PX_PER_MIN
                  return (
                    <div
                      key={`block-${block.id}`}
                      onClick={() => setSelectedBlock(block)}
                      style={{
                        position: 'absolute',
                        top: `${blockTop}px`,
                        left: '2px',
                        right: '2px',
                        height: `${block.duration * PX_PER_MIN}px`,
                        background: 'repeating-linear-gradient(45deg, #ddd, #ddd 4px, #eee 4px, #eee 8px)',
                        borderRadius: '4px',
                        fontSize: '9px',
                        color: '#666',
                        textAlign: 'center',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px'
                      }}
                      title={block.reason}
                    >
                      {block.type === 'auto_travel' ? '🚗' : '☕'} {block.reason && <span style={{ marginLeft: 4 }}>{block.reason.slice(0, 12)}</span>}
                    </div>
                  )
                })}
                {/* Заказы */}
                {dayOrders.map(order => {
                  const orderDate = new Date(order.scheduled_at)
                  const orderMin = orderDate.getHours() * 60 + orderDate.getMinutes()
                  const top = (orderMin - viewStartMin) * PX_PER_MIN
                  const duration = order.total_duration || 60
                  const isOutcall = order.location_type === 'outcall'
                  const travelBefore = isOutcall ? travelTime : 0
                  const color = STATUS_COLORS[order.status] || '#888'

                  const isCancelled = order.status === 'cancelled'
                  // Считаем сдвиг для отменённых на одно время, чтобы не наслаивались
                  let cancelOffset = 0
                  if (isCancelled) {
                    cancelOffset = dayOrders.filter(o =>
                      o.status === 'cancelled' &&
                      o.id < order.id &&
                      new Date(o.scheduled_at).getTime() === orderDate.getTime()
                    ).length
                  }                  return (
                    <div key={order.id}>
                      {isCancelled ? (
                        /* Отменённый — маленький значок в уголке */
                        <div
                          onClick={() => setSelectedOrder(order)}
                          style={{ position: 'absolute', top: `${top}px`, left: '2px', width: '20px', height: '20px', background: 'white', border: '1.5px solid #ef4444', borderRadius: '4px', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}
                          title="Отменённый заказ"
                        >
                          ✕
                        </div>
                      ) : (
                        /* Обычный заказ */
                        <div
                          onClick={() => setSelectedOrder(order)}
                          style={{ position: 'absolute', top: `${top}px`, left: '2px', right: '2px', height: `${duration * PX_PER_MIN}px`, background: color, borderRadius: '4px', padding: '2px 4px', fontSize: '10px', color: 'white', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title={STATUS_LABELS[order.status]}
                        >
                          <div style={{ width: '100%' }}>
                            <div style={{ fontWeight: 'bold' }}>{order.client?.full_name || order.name || 'Клиент'}</div>
                            <div style={{ fontSize: '9px', opacity: 0.9 }}>{orderDate.getHours()}:{String(orderDate.getMinutes()).padStart(2, '0')}{order.total_price ? ` · ${order.total_price}₽` : ''}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {/* Модалка создания перерыва */}
      {breakDay && (
        <BreakModal
          executor={executor}
          day={breakDay}
          onClose={() => setBreakDay(null)}
          onSaved={() => { setBreakDay(null); onReload() }}
        />
      )}
       {/* Меню выбора при клике на пустую клетку */}
       {clickMenu && (
        <>
          <div
            onClick={() => setClickMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          />
          <div style={{
            position: 'fixed',
            top: `${clickMenu.y}px`,
            left: `${clickMenu.x}px`,
            zIndex: 101,
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => { setClickMenu(null); onCreateOrder() }}
              style={{ display: 'block', width: '100%', padding: '12px 20px', border: 'none', background: 'white', cursor: 'pointer', fontSize: '14px', textAlign: 'left', whiteSpace: 'nowrap' }}
            >
              📝 Создать заказ
            </button>
            <button
              onClick={() => { setBreakDay(clickMenu.day); setClickMenu(null) }}
              style={{ display: 'block', width: '100%', padding: '12px 20px', border: 'none', borderTop: '1px solid #eee', background: 'white', cursor: 'pointer', fontSize: '14px', textAlign: 'left', whiteSpace: 'nowrap' }}
            >
              ☕ Перерыв
            </button>
          </div>
        </>
      )}
{/* Модалка с деталями заказа */}
{selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSaved={() => { setSelectedOrder(null); onReload() }}
        />
      )}
      {/* Модалка с деталями блока */}
      {selectedBlock && (
        <BlockDetailsModal
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onSaved={() => { setSelectedBlock(null); onReload() }}
        />
      )}
      {/* Стрелка "позже" */}
      {workEndMin < 24 * 60 && (
        <button
          onClick={() => setExpandedAfter(!expandedAfter)}
          style={{ width: '100%', padding: '4px', background: '#f9fafb', border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#888', marginTop: '4px' }}
        >
          {expandedAfter ? '▲ Скрыть поздние часы' : '▼ Показать поздние часы'}
        </button>
      )}
      {/* Легенда */}
      <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: STATUS_COLORS[key] }}></div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function ExecutorPage({ executorId }) {
  const [orders, setOrders] = useState([])
  const [blocks, setBlocks] = useState([])
  const [executor, setExecutor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('orders')
  const [showAddOrder, setShowAddOrder] = useState(false)
  
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
      .order('created_at', { ascending: false })

      setOrders(ordersData || [])

      const { data: blocksData } = await supabase
        .from('blocks')
        .select('*')
        .eq('executor_id', executorId)
      setBlocks(blocksData || [])
  
      setLoading(false)
  }

  useEffect(() => {
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
  if (showAddOrder) {
    return (
      <AddOrderPage
        executor={executor}
        onBack={() => setShowAddOrder(false)}
        onSuccess={() => {
          setShowAddOrder(false)
          window.location.reload()
        }}
      />
    )
  }
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
      {/* Кнопка добавить заявку */}
{activeTab === 'orders' && (
  <button
    onClick={() => setShowAddOrder(true)}
    style={{
      width: '100%',
      padding: '12px',
      background: 'white',
      color: '#2481cc',
      border: '2px dashed #2481cc',
      borderRadius: '12px',
      cursor: 'pointer',
      fontSize: '16px',
      marginBottom: '12px'
    }}
  >
    + Добавить заявку вручную
  </button>
)}
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
<p style={{ margin: '4px 0', fontSize: '14px' }}>🛠 {order.cleaning_type}</p>
<div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginTop: '4px' }}>
  {order.total_price && <span>💰 {order.total_price} руб</span>}
  {order.total_duration && <span>⏱ {order.total_duration} мин</span>}
</div><div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
  {executor?.outcall && order.location_type !== 'incall' && (
    <span style={{
      background: '#e8f4fd',
      color: '#2481cc',
      padding: '3px 8px',
      borderRadius: '10px',
      fontSize: '12px'
    }}>🚗 Выезд</span>
  )}
  {executor?.travel_time && (
    <span style={{
      background: '#fff8ed',
      color: '#f5a623',
      padding: '3px 8px',
      borderRadius: '10px',
      fontSize: '12px'
    }}>🚦 ~{executor.travel_time} мин на дорогу</span>
  )}
</div>
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
        <ScheduleView executor={executor} orders={orders} blocks={blocks} onReload={loadData} onCreateOrder={() => setShowAddOrder(true)} />
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