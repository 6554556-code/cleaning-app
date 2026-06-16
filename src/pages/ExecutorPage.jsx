import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { getTelegramUser } from '../telegram'
import AddOrderPage from './AddOrderPage'
import MiniCalendar from '../components/MiniCalendar'
import { loadReviewsByExecutors, calculateStats } from '../reviewsUtils'
import BalanceBlock from '../components/BalanceBlock'
// Retry-обёртка для нестабильного соединения (Telegram WebApp)
async function withRetry(fn, attempts = 3, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn()
      if (result?.error) throw result.error
      return result
    } catch (err) {
      if (i === attempts - 1) throw err
      await new Promise(r => setTimeout(r, delayMs * (i + 1)))
    }
  }
}
// Считает статистику заказов клиента по списку всех заказов
function getClientStats(allOrders, clientId) {
  const clientOrders = allOrders.filter(o => o.client_id === clientId)
  let done = 0, active = 0, cancelled = 0
  clientOrders.forEach(o => {
    if (o.status === 'done') done++
    else if (o.status === 'cancelled') cancelled++
    else active++
  })
  return { done, active, cancelled }
}

// Пузырьки заказов клиента: две слепленные группы "У Вас" и "Всего".
// Внутри группы пузырьки без gap (слеплены), между группами — отступ.
function ClientStatsBadges({ stats, globalStats }) {
  const badge = (count, color, pos) => {
    const radius = pos === 'left' ? '8px 0 0 8px' : pos === 'right' ? '0 8px 8px 0' : pos === 'mid' ? '0' : '8px'
    return (
      <span style={{
        background: color,
        color: 'white',
        borderRadius: radius,
        padding: '1px 5px',
        fontSize: '10px',
        fontWeight: 'bold',
        lineHeight: '18px',
        display: 'inline-block',
      }}>
        {count}
      </span>
    )
  }
  const group = (label, s) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0' }}>
      <span style={{ fontSize: '10px', color: '#888', marginRight: '3px' }}>{label}</span>
      {badge(s.done, '#16a34a', 'left')}
      {badge(s.active, '#3b82f6', 'mid')}
      {badge(s.cancelled, '#ef4444', 'right')}
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
      {group('У Вас', stats)}
      {globalStats && group('Всего', globalStats)}
    </span>
  )
}
// Цвета статусов
const STATUS_COLORS = {
  new: '#fbbf24',
  confirmed_by_executor: '#3b82f6',
  awaiting_client_confirmation: '#f97316',
  confirmed_by_client: '#86d4a8',
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
  const [overlapInfo, setOverlapInfo] = useState(null)
  
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
function OrderDetailsModal({ order, clientStats, globalClientStats, onClose, onSaved, executor }) {
  const [status, setStatus] = useState(order.status)
  const [comment, setComment] = useState(order.executor_comment || '')
  const [price, setPrice] = useState(order.total_price ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    // Формируем апдейт: статус + комментарий, плюс гигиена cancelled_by
    const updates = { status, executor_comment: comment, total_price: price === '' ? null : Number(price) }
    if (status === 'cancelled') {
      updates.cancelled_by = 'executor'
    } else if (order.status === 'cancelled' && status !== 'cancelled') {
      // Заказ оживляют — стираем пометку "кто отменил"
      updates.cancelled_by = null
    }

    const { error } = await withRetry(() =>
      supabase.from('orders').update(updates).eq('id', order.id)
    )

    // Если заказ отменён — удаляем его авто-блоки (дорога, буфер), освобождаем время
    if (status === 'cancelled') {
      await supabase
        .from('blocks')
        .delete()
        .eq('order_id', order.id)
        .in('type', ['auto_travel', 'auto_buffer'])
    }

    // Восстанавливаем авто-блоки при оживлении отменённого заказа
    if (order.status === 'cancelled' && status !== 'cancelled' && executor && order.scheduled_at) {
      const blocksToCreate = []
      const orderDate = new Date(order.scheduled_at)
      if (order.location_type === 'outcall' && executor.travel_time > 0) {
        const travelStart = new Date(orderDate.getTime() - executor.travel_time * 60 * 1000)
        blocksToCreate.push({
          executor_id: executor.id, order_id: order.id,
          start_at: travelStart.toISOString(),
          duration: executor.travel_time, type: 'auto_travel', reason: 'Дорога'
        })
        // Дорога обратно
        const travelBackStart = new Date(orderDate.getTime() + (order.total_duration || 60) * 60 * 1000)
        blocksToCreate.push({
          executor_id: executor.id, order_id: order.id,
          start_at: travelBackStart.toISOString(),
          duration: executor.travel_time, type: 'auto_travel', reason: 'Дорога'
        })
      }
      if (executor.buffer_time > 0 && order.total_duration) {
        const bufferOffset = order.total_duration + (order.location_type === 'outcall' ? (executor.travel_time || 0) : 0)
        const bufferStart = new Date(orderDate.getTime() + bufferOffset * 60 * 1000)
        blocksToCreate.push({
          executor_id: executor.id, order_id: order.id,
          start_at: bufferStart.toISOString(),
          duration: executor.buffer_time, type: 'auto_buffer', reason: 'Буфер'
        })
      }
      if (blocksToCreate.length > 0) await supabase.from('blocks').insert(blocksToCreate)
    }

    setSaving(false)
    if (error) {
      alert('Ошибка сохранения: ' + error.message)
      return
    }
    // Скликиваем лид при любом активном действии (кроме отмены)
    if (status !== 'cancelled') {
      await supabase.rpc('consume_lead', { p_order_id: order.id })
    }
    onSaved()
  }
  async function fullDelete() {
    if (!confirm('Удалить заказ полностью? Он исчезнет из расписания.')) return
    setSaving(true)
    // Удаляем связанные блоки (дорога, буфер)
    await supabase.from('blocks').delete().eq('order_id', order.id)
    // Помечаем заказ удалённым
    const { error } = await supabase
      .from('orders')
      .update({ is_deleted: true })
      .eq('id', order.id)
    setSaving(false)
    if (error) {
      alert('Ошибка удаления: ' + error.message)
      return
    }
    onSaved()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '400px', width: '100%', maxHeight: '90dvh', overflow: 'auto', overscrollBehavior: 'contain' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
            <h3 style={{ margin: 0 }}>Заказ #{order.id}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#999' }}>
              {order.source === 'manual' ? '✋ Создан вручную' : '📱 Со страницы брони'}
              {order.created_at ? ` · ${new Date(order.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>
        {order.status === 'cancelled' && order.cancelled_by && (
          <div style={{
            margin: '8px 0 12px',
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#991b1b',
            textAlign: 'center',
            fontWeight: 'bold'
          }}>
            ⊘ Отменён {order.cancelled_by === 'client' ? 'клиентом' : order.cancelled_by === 'executor' ? 'вами' : 'системой'}
          </div>
        )}
        <p style={{ margin: '4px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span><b>Клиент:</b> {order.client_name || order.client?.full_name || order.name || '—'}</span>
          {clientStats && <ClientStatsBadges stats={clientStats} globalStats={globalClientStats} />}
        </p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Телефон:</b> {order.client_phone || order.client?.phone || order.phone || '—'}</p>
        {(order.client_telegram_username || order.client?.telegram_username) && (
          <a
            href={`https://t.me/${order.client_telegram_username || order.client?.telegram_username}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              margin: '8px 0',
              padding: '10px',
              background: '#2481cc',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              textAlign: 'center',
              fontWeight: 'bold'
            }}
          >
            💬 Написать @{order.client_telegram_username || order.client?.telegram_username}
          </a>
        )}
        <p style={{ margin: '4px 0', fontSize: '14px' }}>
          <b>Услуга:</b> {order.location_type === 'incall' ? '🏠 ' : order.location_type === 'outcall' ? '🚗 ' : ''}{order.cleaning_type || '—'}
        </p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Время:</b> {(() => {
          const d = new Date(order.scheduled_at)
          const dateStr = d.toLocaleDateString('ru-RU')
          const startStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          if (order.total_duration) {
            const end = new Date(d.getTime() + order.total_duration * 60000)
            const endStr = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            return dateStr + ', ' + startStr + '–' + endStr
          }
          return dateStr + ', ' + startStr
        })()}</p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Длительность:</b> {order.total_duration || '—'} мин</p>
        <p style={{ margin: '4px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <b>Цена:</b>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            style={{ width: '100px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '16px' }}
          />
          <span>₽</span>
        </p>
        {order.location_type === 'outcall' && order.address && (
          <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Адрес:</b> {order.address}</p>
        )}
        {order.location_type === 'incall' && order.incall_address && (
          <p style={{ margin: '6px 0 2px', fontSize: '11px', color: '#999' }}>
            Адрес приёма (на момент брони): {order.incall_address}
          </p>
        )}
        {order.comment && <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}><b>От клиента:</b> {order.comment}</p>}

        <p style={{ marginTop: '16px', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>Статус</p>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <p style={{ marginTop: '12px', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>Комментарий исполнителя</p>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Например: клиент опаздывает на 15 мин" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', minHeight: '60px', boxSizing: 'border-box', resize: 'vertical' }} />

        <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: '12px', padding: '12px', background: '#2481cc', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        {order.source !== 'booking' && (
          <button onClick={fullDelete} disabled={saving} style={{ width: '100%', marginTop: '8px', padding: '10px', background: 'white', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
            🗑 Удалить полностью
          </button>
        )}
      </div>
    </div>
  )
}
// Модалка создания перерыва
function BreakModal({ executor, day, orders, blocks, initialHour, initialMinute, onClose, onSaved }) {
  const initialTime = (initialHour !== undefined && initialMinute !== undefined)
    ? `${String(initialHour).padStart(2, '0')}:${String(initialMinute).padStart(2, '0')}`
    : '13:00'
  const [time, setTime] = useState(initialTime)
  const [duration, setDuration] = useState(60)
  const [reason, setReason] = useState('Перерыв')
  const [saving, setSaving] = useState(false)
  const [overlapInfo, setOverlapInfo] = useState(null)

  // Считаем пересечения и свободное окно (минуты от полуночи)
  function checkOverlap(startMin, durMin) {
    const travelTime = executor.travel_time || 0
    const bufferTime = executor.buffer_time || 0
    const dayStr = day.toDateString()
    const endMin = startMin + durMin

    // Собираем все занятые отрезки на этот день
    const busy = []

    orders.forEach(o => {
      if (!o.scheduled_at) return
      const d = new Date(o.scheduled_at)
      if (d.toDateString() !== dayStr) return
      if (o.status === 'cancelled') return
      const sM = d.getHours() * 60 + d.getMinutes()
      const dur = o.total_duration || 60
      const isOut = o.location_type === 'outcall'
      const from = sM
      const to = sM + dur
      busy.push({ from, to })
    })

    blocks.forEach(b => {
      if (!b.start_at) return
      const d = new Date(b.start_at)
      if (d.toDateString() !== dayStr) return
      const sM = d.getHours() * 60 + d.getMinutes()
      const to = sM + (b.duration || 0)
      busy.push({ from: sM, to })
    })

    // Граница суток как виртуальный «занятый» блок — перерыв не должен переползать на следующий день
    busy.push({ from: 1440, to: 1441 })

    // Есть ли пересечение с запрошенным интервалом?
    const conflict = busy.some(b => b.from < endMin && b.to > startMin)
    if (!conflict) return { ok: true }

    // Левый край рабочего дня — дефолт для leftEdge, если слева ничего нет
    const [wStartH, wStartM] = executor.work_start.split(':').map(Number)
    const workStartMin = wStartH * 60 + wStartM

    // Свободное окно вокруг startMin
    let leftEdge = workStartMin
    let rightEdge = null
    busy.forEach(b => {
      if (b.to <= startMin) {
        if (leftEdge === null || b.to > leftEdge) leftEdge = b.to
      }
      if (b.from > startMin) {
        if (rightEdge === null || b.from < rightEdge) rightEdge = b.from
      }
      // Если занятость окружает startMin — окно нулевое слева/справа
      if (b.from <= startMin && b.to > startMin) {
        leftEdge = b.to
      }
    })

    return { ok: false, leftEdge, rightEdge }
  }
  // Реальное сохранение в базу (вызывается после проверки пересечений)
  async function saveBlock(startMin, durMin) {
    setSaving(true)
    const startAt = new Date(day)
    startAt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)

    const { error } = await supabase.from('blocks').insert({
      executor_id: executor.id,
      start_at: startAt.toISOString(),
      duration: durMin,
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

  function handleSave() {
    const [h, m] = time.split(':').map(Number)
    const startMin = h * 60 + m
    const durMin = Number(duration)

    const result = checkOverlap(startMin, durMin)

    if (result.ok) {
      // Конфликта нет — сохраняем как есть
      saveBlock(startMin, durMin)
    } else {
      // Конфликт — показываем диалог с вариантами
      setOverlapInfo({ startMin, durMin, leftEdge: result.leftEdge, rightEdge: result.rightEdge })
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
        {overlapInfo && (() => {
          const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
          const { startMin, durMin, leftEdge, rightEdge } = overlapInfo
          // rightEdge может быть null — тогда берём конец рабочего дня
          const [wEndH, wEndM] = executor.work_end.split(':').map(Number)
          const workEndMin = wEndH * 60 + wEndM
          const right = rightEdge !== null ? rightEdge : workEndMin

          // Вариант 1: с запрошенного начала до правого края
          const opt1Start = startMin
          const opt1End = right
          const opt1Dur = opt1End - opt1Start

          // Вариант 2: максимально влево, сколько влезет до правого края
          // Если запрошенная длительность влезает — получим полный перерыв.
          // Если не влезает — получим всё свободное окно (что лучше, чем огрызок справа).
          const opt2Start = Math.max(leftEdge, right - durMin)
          const opt2End = right
          const opt2Dur = opt2End - opt2Start
          // Показываем, только если начало отличается от варианта 1 (иначе дубль)
          const hasOpt2 = opt2Start < startMin
          
          return (
            <div>
              <h3 style={{ margin: '0 0 8px' }}>⚠️ Не хватает времени</h3>
              <p style={{ margin: '0 0 16px', color: '#666', fontSize: '13px' }}>
                В это время уже что-то стоит. Куда поставить перерыв?
              </p>

              {opt1Dur > 0 && (
                <button
                  onClick={() => { setOverlapInfo(null); saveBlock(opt1Start, opt1Dur) }}
                  disabled={saving}
                  style={{ width: '100%', padding: '12px', marginBottom: '8px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}
                >
                  Поставить с {fmt(opt1Start)} до {fmt(opt1End)} ({opt1Dur} мин)
                </button>
              )}

              {hasOpt2 && opt2Dur > 0 && (
                <button
                  onClick={() => { setOverlapInfo(null); saveBlock(opt2Start, opt2Dur) }}
                  disabled={saving}
                  style={{ width: '100%', padding: '12px', marginBottom: '8px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}
                >
                  Поставить с {fmt(opt2Start)} до {fmt(opt2End)} ({opt2Dur} мин)
                </button>
              )}

              <button
                onClick={() => setOverlapInfo(null)}
                style={{ width: '100%', padding: '10px', marginTop: '8px', border: '1px solid #ddd', background: 'white', borderRadius: '6px', cursor: 'pointer' }}
              >
                Отмена / подумаю
              </button>
            </div>
          )
        })()}

        {!overlapInfo && (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
function ScheduleView({ executor, orders, blocks, globalClientStats, onReload, onCreateOrder, weekOffset, setWeekOffset }) {
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [overlapList, setOverlapList] = useState(null)
  const [expandedBefore, setExpandedBefore] = useState(false)
  const [expandedAfter, setExpandedAfter] = useState(false)

  const [clickMenu, setClickMenu] = useState(null)
  const [pickedCalendarDate, setPickedCalendarDate] = useState(null)
  const [breakDay, setBreakDay] = useState(null)
  if (!executor) return null

  // Парсим время работы
  const [workStartH, workStartM] = executor.work_start.split(':').map(Number)
  const [workEndH, workEndM] = executor.work_end.split(':').map(Number)
  const workStartMin = workStartH * 60 + workStartM
  const workEndMin = workEndH * 60 + workEndM
 

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

  // Ищем самый ранний и поздний край среди заказов и блоков видимых дней
  const visibleDayStrings = days.map(d => d.toDateString())
  const travelTimeForView = executor.travel_time || 0
const bufferTimeForView = executor.buffer_time || 0
let earliestMin = workStartMin
let latestMin = workEndMin

orders.forEach(o => {
  if (!o.scheduled_at) return
  const d = new Date(o.scheduled_at)
  if (!visibleDayStrings.includes(d.toDateString())) return
  const startM = d.getHours() * 60 + d.getMinutes()
  const dur = o.total_duration || 60
  const isOut = o.location_type === 'outcall'
  const from = startM - (isOut ? travelTimeForView : 0)
  const to = startM + dur + bufferTimeForView + (isOut ? travelTimeForView : 0)
  if (from < earliestMin) earliestMin = from
  if (to > latestMin) latestMin = to
})

blocks.forEach(b => {
  if (!b.start_at) return
  const d = new Date(b.start_at)
  if (!visibleDayStrings.includes(d.toDateString())) return
  const startM = d.getHours() * 60 + d.getMinutes()
  const to = startM + (b.duration || 0)
  if (startM < earliestMin) earliestMin = startM
  if (to > latestMin) latestMin = to
})

earliestMin = Math.max(0, Math.floor(earliestMin / 60) * 60)
latestMin = Math.min(24 * 60, Math.ceil(latestMin / 60) * 60)
const viewStartMin = expandedBefore ? 0 : earliestMin
  const viewEndMin = expandedAfter ? 24 * 60 : latestMin
  const totalMinutes = viewEndMin - viewStartMin

  // Рабочая зона для подсветки в колонках дней
  const workZoneStart = Math.max(workStartMin, viewStartMin)
  const workZoneEnd = Math.min(workEndMin, viewEndMin)
  const workZoneTop = (workZoneStart - viewStartMin) * PX_PER_MIN
  const workZoneHeight = Math.max(0, (workZoneEnd - workZoneStart) * PX_PER_MIN)

  // Рабочие дни недели (ISO: Пн=1..Вс=7)
  const workDays = (executor.work_days || '').split(',').filter(Boolean).map(Number)
  const isWorkDay = (date) => {
    const dow = date.getDay() // 0=Вс..6=Сб
    const isoDay = dow === 0 ? 7 : dow
    return workDays.includes(isoDay)
  }
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
  // Находит все заказы (включая сам order), пересекающиеся с order по времени
  function getOverlappingOrders(order) {
    const start = new Date(order.scheduled_at).getTime()
    const end = start + (order.total_duration || 60) * 60000

    return orders.filter(o => {
      if (o.is_deleted) return false
      const oStart = new Date(o.scheduled_at).getTime()
      const oEnd = oStart + (o.total_duration || 60) * 60000
      // Интервалы пересекаются
      return start < oEnd && oStart < end
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <button onClick={() => setWeekOffset(weekOffset - 1)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>← Назад</button>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {formatDay(days[0])} — {formatDay(days[2])}
        </span>
        <button onClick={() => setWeekOffset(weekOffset + 1)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Вперёд →</button>
      </div>

      {/* Быстрый переход к дате */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
      <MiniCalendar
          value={pickedCalendarDate}
          allowPast
          onChange={(dateStr) => {
            setPickedCalendarDate(dateStr)
            if (!dateStr) return
            const picked = new Date(dateStr)
            picked.setHours(0, 0, 0, 0)
            const todayMidnight = new Date()
            todayMidnight.setHours(0, 0, 0, 0)
            const diffDays = Math.round((picked - todayMidnight) / (1000 * 60 * 60 * 24))
            setWeekOffset(Math.floor(diffDays / 3))
          }}
        />
        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '13px' }}
          >
            Сегодня
          </button>
        )}
        <button
          onClick={onReload}
          title="Обновить расписание"
          style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '13px' }}
        >
          🔄 Обновить
        </button>
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
    // Вычисляем время клика по позиции курсора внутри колонки
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const minutesFromTop = offsetY / PX_PER_MIN
    const absoluteMinutes = viewStartMin + minutesFromTop
    // Округляем до 15 минут вниз
    const roundedMinutes = Math.floor(absoluteMinutes / 15) * 15
    const clickHour = Math.floor(roundedMinutes / 60)
    const clickMin = roundedMinutes % 60    
    const centerX = rect.left + rect.width / 2
    setClickMenu({ x: centerX, y: e.clientY, day, hour: clickHour, minute: clickMin })
  }}
  style={{ position: 'relative', height: `${totalMinutes * PX_PER_MIN}px`, background: '#f7faf8', borderRadius: '4px', cursor: 'pointer', overflow: 'hidden' }}
>
                {/* Подсветка рабочих часов */}
                {workZoneHeight > 0 && isWorkDay(day) && (
                  <div style={{ position: 'absolute', top: `${workZoneTop}px`, left: 0, right: 0, height: `${workZoneHeight}px`, background: '#f5f5f5', pointerEvents: 'none' }}></div>
                )}
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
                        onClick={() => {
                          const overlapping = getOverlappingOrders(order).filter(o => o.status !== 'cancelled')
                          if (overlapping.length > 1) {
                            setOverlapList(overlapping)
                          } else {
                            setSelectedOrder(order)
                          }
                        }}
                          style={{ position: 'absolute', top: `${top}px`, left: '2px', right: '2px', height: `${duration * PX_PER_MIN}px`, background: color, borderRadius: '4px', padding: '2px 4px', fontSize: '10px', color: 'white', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title={order.status === 'cancelled' && order.cancelled_by
                            ? `Отменена ${order.cancelled_by === 'client' ? 'клиентом' : order.cancelled_by === 'executor' ? 'вами' : 'системой'}`
                            : STATUS_LABELS[order.status]}
                        >
                          <div style={{ width: '100%' }}>
                          <div style={{ fontWeight: 'bold' }}>{order.client_name || order.client?.full_name || order.name || 'Клиент'}</div>
                          <div style={{ fontSize: '9px', opacity: 0.9 }}>{(() => {
                            const startStr = orderDate.getHours() + ':' + String(orderDate.getMinutes()).padStart(2, '0')
                            const end = new Date(orderDate.getTime() + duration * 60000)
                            const endStr = end.getHours() + ':' + String(end.getMinutes()).padStart(2, '0')
                            return startStr + '–' + endStr + ' ' + duration + 'мин' + (order.total_price ? ' · ' + order.total_price + '₽' : '')
                          })()}</div>
                          <div style={{ fontSize: '8px', opacity: 0.7 }}>#{order.id}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            {/* Итог дня */}
            {(() => {
                const doneRev = dayOrders.filter(o => o.status === 'done').reduce((s, o) => s + (o.total_price || 0), 0)
                const planRev = dayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_price || 0), 0)
                if (doneRev === 0 && planRev === 0) return null
                return (
                  <div style={{ textAlign: 'center', padding: '4px 2px', borderTop: '1px solid #eee', marginTop: '4px' }}>
                    <div style={{ fontSize: '9px', color: '#999', marginBottom: '1px' }}>факт / план</div>
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{doneRev.toLocaleString('ru-RU')}</span>
                      <span style={{ color: '#bbb' }}>/</span>
                      <span style={{ color: '#3b82f6' }}>{planRev.toLocaleString('ru-RU')}</span>
                      <span style={{ color: '#888' }}> ₽</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
      {/* Модалка создания перерыва */}
      {breakDay && (
        <BreakModal
          executor={executor}
          day={breakDay.day}
          orders={orders}
          blocks={blocks}
          initialHour={breakDay.hour}
          initialMinute={breakDay.minute}
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
            transform: 'translateX(-50%)',
            zIndex: 101,
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => { onCreateOrder({ day: clickMenu.day, hour: clickMenu.hour, minute: clickMenu.minute }); setClickMenu(null) }}
              style={{ display: 'block', width: '100%', padding: '12px 20px', border: 'none', background: 'white', cursor: 'pointer', fontSize: '14px', textAlign: 'left', whiteSpace: 'nowrap' }}
            >
              📝 Создать заказ
            </button>
            <button
              onClick={() => { setBreakDay({ day: clickMenu.day, hour: clickMenu.hour, minute: clickMenu.minute }); setClickMenu(null) }}
              style={{ display: 'block', width: '100%', padding: '12px 20px', border: 'none', borderTop: '1px solid #eee', background: 'white', cursor: 'pointer', fontSize: '14px', textAlign: 'left', whiteSpace: 'nowrap' }}
            >
              ☕ Перерыв
            </button>
          </div>
        </>
      )}
      {/* Модалка выбора заказа при пересечении */}
      {overlapList && (
        <div
          onClick={() => setOverlapList(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ margin: '0 0 4px' }}>Несколько заказов на это время</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#666' }}>Выберите заказ</p>

            {overlapList.map(o => {
              const start = new Date(o.scheduled_at)
              const end = new Date(start.getTime() + (o.total_duration || 60) * 60000)
              const fmt = d => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedOrder(o)
                    setOverlapList(null)
                  }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: '8px', border: '1px solid #e0e0e0', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{o.client_name || o.client?.full_name || o.name || 'Клиент'}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {fmt(start)}–{fmt(end)} · {o.cleaning_type || '—'}
                  </div>
                </button>
              )
            })}

            <button
              onClick={() => setOverlapList(null)}
              style={{ width: '100%', padding: '10px', marginTop: '4px', background: 'white', color: '#666', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
{/* Модалка с деталями заказа */}
{selectedOrder && (
        <OrderDetailsModal
        order={selectedOrder}
        clientStats={getClientStats(orders, selectedOrder.client_id)}
        globalClientStats={globalClientStats[selectedOrder.client_id]}
        onClose={() => setSelectedOrder(null)}
        onSaved={() => { setSelectedOrder(null); onReload() }}
        executor={executor}
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
      {/* Легенда + объясняшки */}
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#666', textAlign: 'left' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: STATUS_COLORS[key] }}></div>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap', width: '100%', lineHeight: 1.7 }}>
          <span style={{ fontSize: '11px', color: '#888', marginRight: '3px' }}>У Вас</span>
          <span style={{ background: '#16a34a', color: 'white', borderRadius: '8px 0 0 8px', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold' }}>0</span>
          <span style={{ background: '#3b82f6', color: 'white', borderRadius: '0', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold' }}>0</span>
          <span style={{ background: '#ef4444', color: 'white', borderRadius: '0 8px 8px 0', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold' }}>0</span>
          <span style={{ fontSize: '11px', color: '#888', margin: '0 3px 0 8px' }}>Всего</span>
          <span style={{ background: '#16a34a', color: 'white', borderRadius: '8px 0 0 8px', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold' }}>0</span>
          <span style={{ background: '#3b82f6', color: 'white', borderRadius: '0', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold' }}>0</span>
          <span style={{ background: '#ef4444', color: 'white', borderRadius: '0 8px 8px 0', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold' }}>0</span>
          <span style={{ fontSize: '11px', color: '#555', marginLeft: '6px' }}>— заказы клиента (выполнено / активно / отменено)</span>
        </div>
        <div style={{ width: '100%', lineHeight: 1.7 }}>📦 X / Y заказов — выполнено через мини-апп / всего выполнено</div>
      </div>
    </div>
  )
}
function ExecutorPage({ executorId }) {
  const [orders, setOrders] = useState([])
  const [blocks, setBlocks] = useState([])
  const [executor, setExecutor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ratingStats, setRatingStats] = useState(null)
  const [activeTab, setActiveTab] = useState('schedule')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  // Общая статистика клиентов по ВСЕЙ системе: client_id → { done, active, cancelled }.
  // Используется для второго ряда пузырьков "Всего" в карточке заказа.
  const [globalClientStats, setGlobalClientStats] = useState({})
  function normalizePhone(raw) {
    if (!raw) return null
    let p = raw.replace(/[^\d+]/g, '')
    if (p.startsWith('+')) return p
    if (p.length === 11 && p.startsWith('8')) return '+7' + p.slice(1)
    if (p.length === 11 && p.startsWith('7')) return '+' + p
    return p
  }

  function callPhone(raw) {
    const phone = normalizePhone(raw)
    if (!phone) {
      alert('У этого клиента не указан телефон')
      return
    }
    window.location.href = 'tel:' + phone
  }

  function copyPhone(raw) {
    const phone = normalizePhone(raw)
    if (!phone) return
    navigator.clipboard?.writeText(phone)
    alert('Номер скопирован: ' + phone)
  }
  async function toggleVisible() {
    const newValue = !executor.is_visible
        const { error } = await supabase
      .from('executors')
      .update({ is_visible: newValue })
      .eq('id', executor.id)

    if (error) {
      alert('Не получилось сохранить: ' + error.message)
      return
    }

    setExecutor({ ...executor, is_visible: newValue })
  }
  async function loadData() {
    
    // Определяем, чей это кабинет
    let realExecutorId = executorId  // запасной вариант (тест через ?executor=1)

    const tgUser = getTelegramUser()
    if (tgUser?.telegram_id) {
      // Ищем пользователя по telegram_id
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', tgUser.telegram_id)
        .eq('role', 'executor')
        .maybeSingle()

      if (user) {
        // Ищем профиль исполнителя этого пользователя
        const { data: myExec } = await supabase
          .from('executors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (myExec) realExecutorId = myExec.id
      }
    }

    const { data: executorData } = await supabase
      .from('executors')
      .select('*, users(full_name)')
      .eq('id', realExecutorId)
      .single()
    setExecutor(executorData)

    const { data: ordersData } = await supabase
    .from('orders')
    .select('*, client:client_id(full_name, phone, telegram_username)')
    .eq('executor_id', realExecutorId)
    .neq('is_deleted', true)
    .order('created_at', { ascending: false })

    setOrders(ordersData || [])

    // Подгружаем общую статистику клиентов по всей системе — без фильтра по executor_id.
    // Берём только тех client_id, что у нас уже есть в заказах этого исполнителя.
    const clientIds = [...new Set((ordersData || []).map(o => o.client_id).filter(Boolean))]
    if (clientIds.length > 0) {
      const { data: allClientOrders } = await supabase
        .from('orders')
        .select('client_id, status')
        .in('client_id', clientIds)
        .neq('is_deleted', true)
      const statsMap = {}
      ;(allClientOrders || []).forEach(o => {
        if (!statsMap[o.client_id]) statsMap[o.client_id] = { done: 0, active: 0, cancelled: 0 }
        if (o.status === 'done') statsMap[o.client_id].done++
        else if (o.status === 'cancelled') statsMap[o.client_id].cancelled++
        else statsMap[o.client_id].active++
      })
      setGlobalClientStats(statsMap)
    }

    const { data: blocksData } = await supabase
        .from('blocks')
        .select('*')
        .eq('executor_id', realExecutorId)
      setBlocks(blocksData || [])
      // Считаем рейтинг из реальных отзывов
      const reviewsMap = await loadReviewsByExecutors([realExecutorId])
      const stats = calculateStats(reviewsMap[realExecutorId] || [])
      setRatingStats(stats)
  
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

  function getStatusLabel(status, cancelledBy) {
    const statuses = {
      new: { label: 'Новая', color: '#f5a623', bg: '#fff8ed' },
      in_progress: { label: 'В работе', color: '#2481cc', bg: '#e8f4fd' },
      done: { label: 'Выполнена', color: '#16a34a', bg: '#f0fdf4' },
      confirmed_by_executor: { label: 'Подтверждено вами', color: '#3b82f6', bg: '#eff6ff' },
      awaiting_client_confirmation: { label: 'Ждём клиента', color: '#f97316', bg: '#fff7ed' },
      confirmed_by_client: { label: 'Подтверждено клиентом', color: '#15803d', bg: '#d1fae5' },
      cancelled: { label: 'Отменена', color: '#dc2626', bg: '#fef2f2' },
    }
    const result = statuses[status] || { label: status, color: '#666', bg: '#f0f0f0' }
    if (status === 'cancelled') {
      if (cancelledBy === 'client') return { ...result, label: 'Отменена клиентом' }
      if (cancelledBy === 'executor') return { ...result, label: 'Отменена вами' }
      if (cancelledBy === 'system') return { ...result, label: 'Отменена системой' }
    }
    return result
  }

  if (loading) return <p style={{ padding: '20px' }}>Загружаем данные...</p>
  if (showAddOrder) {
    return (
      <AddOrderPage
        executor={executor}
        initialDay={typeof showAddOrder === 'object' ? showAddOrder.day : null}
        initialHour={typeof showAddOrder === 'object' ? showAddOrder.hour : null}
        initialMinute={typeof showAddOrder === 'object' ? showAddOrder.minute : null}
        onBack={() => setShowAddOrder(false)}
        onSuccess={() => {
          setShowAddOrder(false)
          setActiveTab('schedule')
          loadData()
        }}
      />
    )
  }
  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>

      {/* Верхняя панель: домик слева, настройки справа */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <a href="/" style={{ fontSize: '14px', color: '#2481cc', textDecoration: 'none' }}>
          🏠 На главную
        </a>
        <a href="/?settings=1" style={{ fontSize: '14px', color: '#2481cc', textDecoration: 'none' }}>
          ⚙️ Настройки
        </a>
      </div>

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
        {(() => {
          const doneOrders = orders.filter(o => o.status === 'done' && !o.is_deleted)
          const total = doneOrders.length
          const fromApp = doneOrders.filter(o => o.source === 'booking').length
          return (
            <p style={{ margin: '0', color: '#666' }}>
              {ratingStats && ratingStats.count > 0
                ? <>⭐ {ratingStats.avgRating.toFixed(1)} ({ratingStats.count}) · </>
                : <>Новый исполнитель · </>}
              📦 {fromApp} / {total} заказов
            </p>
          )
        })()}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <button
            onClick={toggleVisible}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              background: executor?.is_visible ? '#22c55e' : '#9ca3af',
              color: 'white',
            }}
          >
            {executor?.is_visible ? '👁 Виден на главной' : '🙈 Скрыт с главной'}
          </button>
          <BalanceBlock executor={executor} />
          </div>
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
          <input
            type="text"
            placeholder="🔍 Поиск по имени, телефону, @тг, адресу, комментарию, №"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #ddd',
              fontSize: '14px',
              marginBottom: '12px',
              boxSizing: 'border-box',
              background: '#f7faf8',
            }}
          />
          {(() => {
            const q = searchQuery.trim().toLowerCase()
            const filtered = q === '' ? orders : orders.filter(o => {
              const name = (o.client_name || o.client?.full_name || o.name || '').toLowerCase()
              const phone = (o.client_phone || o.client?.phone || '').toLowerCase().replace(/[^\d]/g, '')
              const tg = (o.client_telegram_username || o.client?.telegram_username || '').toLowerCase()
              const address = (o.address || o.incall_address || '').toLowerCase()
              const comment = (o.comment || '').toLowerCase()
              const id = String(o.id)
              const qDigits = q.replace(/[^\d]/g, '')
              return (
                name.includes(q) ||
                (qDigits && phone.includes(qDigits)) ||
                tg.includes(q.replace('@', '')) ||
                address.includes(q) ||
                comment.includes(q) ||
                id.includes(q)
              )
            })
            if (filtered.length === 0) return (
              <p style={{ color: '#666', textAlign: 'center' }}>
                {q ? 'Ничего не найдено' : 'Заявок пока нет'}
              </p>
            )
            return filtered.map(order => {
              const status = getStatusLabel(order.status, order.cancelled_by)
              return (
                <div key={order.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h4 style={{ margin: 0 }}>
                  {order.client_name || order.client?.full_name || 'Клиент'}
                    </h4>
                    <ClientStatsBadges stats={getClientStats(orders, order.client_id)} globalStats={globalClientStats[order.client_id]} />
                  </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#bbb', marginBottom: '2px' }}>#{order.id}</div>
                      <span style={{
                       background: status.bg,
                       color: status.color,
                       padding: '4px 10px',
                       borderRadius: '12px',
                       fontSize: '13px'
                      }}>{status.label}</span>
                    </div>
                  </div>
                  {order.location_type === 'outcall' && order.address && (
                    <p style={{ margin: '8px 0 4px', fontSize: '14px' }}>🚗 {order.address}</p>
                  )}
                  {order.location_type === 'incall' && order.incall_address && (
                    <p style={{ margin: '8px 0 4px', fontSize: '11px', color: '#999' }}>
                      🏠 Адрес приёма: {order.incall_address}
                    </p>
                  )}
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>📅 {formatDate(order.scheduled_at)}</p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>📞 {order.client_phone || order.client?.phone || '—'}</p>
<p style={{ margin: '4px 0', fontSize: '14px' }}>💬 {order.comment || 'Без комментария'}</p>
<p style={{ margin: '4px 0', fontSize: '14px' }}>🛠 {order.cleaning_type}</p>
<div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginTop: '4px' }}>
  {order.total_price && <span>💰 {order.total_price} руб</span>}
  {order.total_duration && <span>⏱ {order.total_duration} мин</span>}
  </div>
<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
{(order.client_telegram_username || order.client?.telegram_username) && (
  <a
  href={`https://t.me/${order.client_telegram_username || order.client?.telegram_username}`}
  target="_blank"
  rel="noreferrer"
  style={{
    flex: 1,
    padding: '8px',
    background: '#2481cc',
    color: 'white',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    textAlign: 'center'
  }}
>💬 Написать @{order.client_telegram_username || order.client?.telegram_username}</a>
)}
<button onClick={() => callPhone(order.client_phone || order.client?.phone)} style={{
  flex: 1,
  padding: '8px',
  background: '#f0f0f0',
  color: 'black',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  textAlign: 'center'
}}>📞 Позвонить</button>
</div>
{(order.client_phone || order.client?.phone) && (
  <div
    onClick={() => copyPhone(order.client_phone || order.client?.phone)}
    style={{ marginTop: '6px', textAlign: 'center', fontSize: '12px', color: '#888', cursor: 'pointer' }}
  >
    📋 {normalizePhone(order.client_phone || order.client?.phone)} (нажми, чтобы скопировать)
  </div>
)}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    {order.status === 'new' && (
                      <button
                      onClick={async () => {
                        await supabase.from('orders').update({ status: 'confirmed_by_executor' }).eq('id', order.id)
                        await supabase.rpc('consume_lead', { p_order_id: order.id })
                        setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'confirmed_by_executor' } : o))
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
                    {!['new', 'done', 'cancelled'].includes(order.status) && (
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
                    {!['done', 'cancelled'].includes(order.status) && (
  <button
    onClick={async () => {
      if (!confirm('Отменить заказ? Клиент получит уведомление об отмене.')) return
      await supabase.from('orders').update({ status: 'cancelled', cancelled_by: 'executor' }).eq('id', order.id)
      await supabase.from('blocks').delete().eq('order_id', order.id).in('type', ['auto_travel', 'auto_buffer'])
      setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'cancelled', cancelled_by: 'executor' } : o))
    }}
    style={{
      flex: 1,
      padding: '8px',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px'
    }}
  >
    ✕ Отменить
  </button>
)}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Расписание */}
      {activeTab === 'schedule' && (
        <ScheduleView executor={executor} orders={orders} blocks={blocks} globalClientStats={globalClientStats} onReload={loadData} onCreateOrder={(info) => setShowAddOrder(info || true)} weekOffset={scheduleWeekOffset} setWeekOffset={setScheduleWeekOffset} />
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