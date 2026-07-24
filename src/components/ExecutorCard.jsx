import Avatar from './Avatar'
import { getLocationIcon } from '../utils/locationIcon'

// Презентационная карточка исполнителя. Логика/данные — снаружи (ClientPage),
// сюда прилетают готовые пропсы. Разметка и стили 1:1 как были в списке —
// чтобы мини-апп выглядел идентично. Веб-оформление добавим отдельным пропсом позже.
export default function ExecutorCard({
  executor,
  professions,
  reviewStats,
  ordersCountByExecutor,
  expandedServices,
  setExpandedServices,
  expandedBios,
  setExpandedBios,
  onBook,
  web = false,        // веб-оформление (жёлтый акцент). По умолчанию false → мини-апп 1:1 как был.
  onMessage,          // если передан (веб) — показываем кнопку «Написать»
}) {
  // Палитра: дефолт = точь-в-точь прежние синие значения мини-аппа.
  const P = web
    ? { soft:'#FBF0D2', pill:'#7A5A0A', price:'#1A1A1A', link:'#8a6a1a',
        slotBorder:'#FDB813', slotBg:'#FFFDF6', slotText:'#1A1A1A',
        btnBg:'#FDB813', btnText:'#1A1A1A' }
    : { soft:'#f0f7ff', pill:'#2481cc', price:'#2481cc', link:'#2481cc',
        slotBorder:'#2481cc', slotBg:'#f0f7ff', slotText:'#2481cc',
        btnBg:'#2481cc', btnText:'white' }
  return (
    <div key={executor.id} id={`executor-card-${executor.id}`} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            {/* Верхняя строка: профессия слева, статы справа */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
              {(() => {
                const prof = professions.find(p => p.code === executor.service_type)
                if (!prof) return <span />
                return (
                  <span style={{ display: 'inline-block', padding: '3px 10px', background: P.soft, color: P.pill, borderRadius: '12px', fontSize: '11px', flexShrink: 0 }}>
                    {prof.icon} {prof.name}
                  </span>
                )
              })()}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {(() => {
                  const stats = reviewStats[executor.id]
                  const count = ordersCountByExecutor[executor.id]?.fromApp || 0
                  const ordersLine = count > 0 ? (
                    <span style={{ color: '#666', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      📦 {count} {count === 1 ? 'заказ' : count < 5 ? 'заказа' : 'заказов'}
                    </span>
                  ) : null
                  if (!stats || stats.count === 0) {
                    return (
                      <>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          background: P.soft,
                          color: P.pill,
                          borderRadius: '8px',
                          fontSize: '11px',
                          lineHeight: '1.3',
                          textAlign: 'center'
                        }}>
                          Новый<br />исполнитель
                        </span>
                        {ordersLine}
                      </>
                    )
                  }
                  return (
                    <>
                      <span style={{ color: '#f5a623', fontWeight: 'bold', fontSize: '18px', display: 'block' }}>
                        ⭐ {stats.avgRating}
                      </span>
                      {ordersLine}
                      {stats.alwaysOnTime && (
                        <span title="Не опаздывает на встречи" style={{ color: '#2ecc71', fontSize: '11px', fontWeight: 'bold', display: 'block', marginTop: '2px' }}>
                          ✓ Всегда вовремя
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Средняя строка: аватар + город/метро */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <Avatar url={executor.avatar_url} name={executor.users?.full_name} size={92} />
              {(executor.city || executor.subway_station) ? (
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: executor.subway_station ? 'center' : 'flex-start', gap: '14px', minHeight: '92px', color: '#666', fontSize: '13px', textAlign: 'center', paddingRight: '104px' }}>
                {executor.city && (
                  <div style={{ wordBreak: 'break-word' }}>
                    {executor.city.length <= 9 && '📍\u00A0'}{executor.city}
                  </div>
                )}
                {executor.subway_station && (
                  <div style={{ wordBreak: 'break-word' }}>🚇&nbsp;{executor.subway_station}</div>
                )}
              </div>
              ) : <div style={{ flex: 1 }} />}
            </div>

            {/* Имя одной строкой по центру под аватаром */}
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span>{executor.users?.full_name}</span>
              {executor.is_verified && <span title="Проверенный исполнитель">✅</span>}
            </h3>
            
            {executor.bio && (() => {
              const LIMIT = 200
              const isOpen = expandedBios.includes(executor.id)
              const isLong = executor.bio.length > LIMIT
              const shown = isOpen || !isLong ? executor.bio : executor.bio.slice(0, LIMIT).trimEnd() + '…'
              return (
                <p style={{ color: '#666', margin: '8px 0', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                  {shown}
                  {isLong && (
                    <span
                    onClick={(e) => {
                      e.stopPropagation()
                      const pEl = e.currentTarget.parentElement
                      const wasOpen = isOpen
                      setExpandedBios(prev =>
                        wasOpen ? prev.filter(id => id !== executor.id) : [...prev, executor.id]
                      )
                      if (wasOpen && pEl) {
                        setTimeout(() => {
                          pEl.scrollIntoView({ block: 'start', behavior: 'smooth' })
                        }, 0)
                      }
                    }}
                      style={{ color: '#5b8def', cursor: 'pointer', marginLeft: 4 }}
                    >
                      {isOpen ? ' Свернуть ▴' : ' Развернуть ▾'}
                    </span>
                  )}
                </p>
              )
            })()}
            {executor.services && executor.services.length > 0 && (() => {
  const isExpanded = expandedServices.includes(executor.id)
  const allMain = executor.services.filter(s => s.is_main)
  const mainToShow = isExpanded ? allMain : allMain.slice(0, 3)
  return (
  <div style={{ marginTop: '10px' }}>
    {mainToShow.map(mainService => {
      const allExtras = executor.services.filter(s => !s.is_main && s.parent_service_id === mainService.id)
      const extrasToShow = isExpanded ? allExtras : allExtras.slice(0, 2)
      return (
      <div key={mainService.id}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '10px',
          padding: '6px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '14px'
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>⭐ {mainService.name} {getLocationIcon(mainService.location_type)} {mainService.duration ? `· ${mainService.duration} мин` : ''}</span>
          <span style={{ color: P.price, fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>{mainService.price} руб</span>
        </div>
        {extrasToShow.map(extra => (
          <div key={extra.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '10px',
            padding: '4px 0 4px 12px',
            fontSize: '12px',
            color: '#888'
          }}>
            <span style={{ flex: 1, minWidth: 0 }}>➕ {extra.name} {extra.duration ? `· ${extra.duration} мин` : ''}</span>
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>+{extra.price} руб</span>
          </div>
        ))}
      </div>
      )
    })}
    {(allMain.length > 3 || allMain.some(m => executor.services.filter(s => !s.is_main && s.parent_service_id === m.id).length > 2)) && (
      <button
      onClick={() => {
        const wasExpanded = expandedServices.includes(executor.id)
        setExpandedServices(prev =>
          wasExpanded
            ? prev.filter(id => id !== executor.id)
            : [...prev, executor.id]
        )
        // Если сворачиваем — возвращаем карточку в поле зрения
        if (wasExpanded) {
          setTimeout(() => {
            const card = document.getElementById(`executor-card-${executor.id}`)
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 50)
        }
      }}
        style={{ marginTop: '6px', background: 'none', border: 'none', color: P.link, cursor: 'pointer', fontSize: '13px', padding: 0 }}
      >
        {isExpanded ? '▲ Свернуть' : '▼ Показать все услуги'}
      </button>
    )}
  </div>
  )
})()}
            
            {((executor.todaySlots && executor.todaySlots.length > 0) || (executor.tomorrowSlots && executor.tomorrowSlots.length > 0)) && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#666' }}>📅 Ближайшие слоты:</p>

                {executor.todaySlots && executor.todaySlots.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#888', minWidth: '52px' }}>Сегодня</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {executor.todaySlots.map(slot => (
                        <span key={slot.start.toString()} style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${P.slotBorder}`, background: P.slotBg, color: P.slotText, fontSize: '13px' }}>
                          {slot.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {executor.tomorrowSlots && executor.tomorrowSlots.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#888', minWidth: '52px' }}>Завтра</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {executor.tomorrowSlots.map(slot => (
                        <span key={slot.start.toString()} style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${P.slotBorder}`, background: P.slotBg, color: P.slotText, fontSize: '13px' }}>
                          {slot.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onBook}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '10px',
                background: P.btnBg,
                color: P.btnText,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Записаться
            </button>
            {web && onMessage && (
              <button
                onClick={onMessage}
                style={{
                  marginTop: '8px', width: '100%', padding: '10px',
                  background: 'white', color: '#2A2A2A',
                  border: '1.5px solid #E4E0D6', borderRadius: '10px',
                  cursor: 'pointer', fontSize: '15px', fontWeight: 600,
                }}
              >
                Написать
              </button>
            )}
          </div>
  )
}
