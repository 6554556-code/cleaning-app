import { useState, useRef, useEffect } from 'react'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

// Палитра: по умолчанию — прежние синие значения мини-аппа, web={true} — жёлтая.
function palette(web) {
  return web
    ? { accent: '#FDB813', selBg: '#FDB813', selText: '#1A1A1A', selBorder: '#FDB813',
        todayBg: '#FFF7E2', todayText: '#8a6a1a', trigBg: '#FFFDF6', trigText: '#1A1A1A' }
    : { accent: '#2481cc', selBg: '#2481cc', selText: 'white', selBorder: '#2481cc',
        todayBg: '#f0f7ff', todayText: '#2481cc', trigBg: '#f0f7ff', trigText: '#2481cc' }
}

function Calendar({ value, onChange, minDate, onClose, allowPast, web }) {
  const P = palette(web)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const min = minDate ? new Date(minDate) : (allowPast ? null : today)

  const [viewYear, setViewYear] = useState(() => {
    const d = value ? new Date(value) : today
    return d.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value) : today
    return d.getMonth()
  })

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function toStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      userSelect: 'none',
      width: '260px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: P.accent, padding: '0 6px' }}>‹</button>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: P.accent, padding: '0 6px' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: '#999', fontWeight: 'bold', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dateStr = toStr(viewYear, viewMonth, day)
          const cellDate = new Date(viewYear, viewMonth, day)
          const isDisabled = min ? cellDate < min : false
          const isSelected = dateStr === value
          const isToday = cellDate.toDateString() === today.toDateString()
          return (
            <button
              key={dateStr}
              onClick={() => { if (!isDisabled) { onChange(dateStr); onClose() } }}
              disabled={isDisabled}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: isSelected ? `2px solid ${P.selBorder}` : '2px solid transparent',
                background: isSelected ? P.selBg : isToday ? P.todayBg : 'transparent',
                color: isSelected ? P.selText : isDisabled ? '#ccc' : isToday ? P.todayText : '#333',
                fontSize: '13px',
                fontWeight: isToday ? 'bold' : 'normal',
                cursor: isDisabled ? 'default' : 'pointer',
                textAlign: 'center',
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function MiniCalendar({ value, onChange, minDate, allowPast, web = false }) {
  const P = palette(web)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Закрываем при клике снаружи
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function formatDisplay(dateStr) {
    if (!dateStr) return 'Выбрать дату'
    const d = new Date(dateStr)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          background: value ? P.trigBg : 'white',
          color: value ? P.trigText : '#666',
          fontSize: '14px',
          cursor: 'pointer',
          fontWeight: value ? 'bold' : 'normal',
        }}
      >
        📅 {formatDisplay(value)}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '44px', left: 0, zIndex: 100 }}>
          <Calendar
            value={value}
            onChange={onChange}
            minDate={minDate}
            allowPast={allowPast}
            web={web}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}