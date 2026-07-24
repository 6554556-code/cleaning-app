import { useRef } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Avatar from '../components/Avatar'
import MiniCalendar from '../components/MiniCalendar'
import { getSession } from '../session'
import { BrandMark, WebFooter, WebBaseStyles } from '../components/WebShell'
import { ROLE_BTN, rub, Y, YP, Y_SOFT, Y_TINT, Y_DARK, INK, MUTED, LINE, LINE_2, BG } from '../webTheme'

// ─────────────────────────────────────────────────────────────────
//  ВЕБ-ВЕРСИЯ СТРАНИЦЫ ЗАПИСИ (десктоп)
//  Чистая вёрстка: вся логика, запросы и состояние живут в BookingPage,
//  сюда прилетают готовые пропсы. Мини-апп этот файл не видит.
// ─────────────────────────────────────────────────────────────────

const CARD = {
  background: '#fff', border: `1px solid ${LINE_2}`, borderRadius: 16,
  padding: 22, marginBottom: 20, boxShadow: '0 1px 2px rgba(30,25,10,.05)',
}
const H = { fontSize: 19, fontWeight: 800, margin: '0 0 16px', color: INK }
const LABEL = { margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#5E5E5E' }
const INPUT = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E7E3DA',
  fontSize: 15, boxSizing: 'border-box', background: '#fff', color: INK, outline: 'none',
  fontFamily: 'inherit',
}

// Жёлтый пин вместо синей стандартной метки Leaflet
const webPin = L.divIcon({
  className: 'ebb-pin',
  html: '<div class="ebb-pin-head"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function Stars({ n }) {
  return <span style={{ color: Y, fontSize: 14, letterSpacing: 1 }}>{'★'.repeat(n)}<span style={{ color: '#E2DED4' }}>{'★'.repeat(5 - n)}</span></span>
}

// Плитки со свободным временем
function SlotChips({ slots, showAll, setShowAll, selectedSlot, setSelectedSlot }) {
  if (!slots || slots.length === 0) return <p style={{ color: MUTED, fontSize: 14, margin: '0 0 4px' }}>Нет свободных слотов</p>
  const shown = showAll ? slots : slots.slice(0, 8)
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {shown.map(s => {
          // Сравниваем по времени, а не по ссылке: слоты пересоздаются при смене
          // услуги/типа визита, и выбранное время не должно «терять» подсветку.
          const active = !!selectedSlot && new Date(selectedSlot.start).getTime() === new Date(s.start).getTime()
          return (
            <button key={s.start.toString()} onClick={() => setSelectedSlot(s)} className="ebb-slot"
              style={{
                padding: '10px 15px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                border: active ? `2px solid ${Y}` : '2px solid #EDEAE2',
                background: active ? Y : '#fff', color: INK,
              }}>
              {s.label}
            </button>
          )
        })}
      </div>
      {slots.length > 8 && (
        <button onClick={() => setShowAll(!showAll)}
          style={{ marginTop: 10, background: 'none', border: 'none', color: Y_DARK, cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: 0 }}>
          {showAll ? '▲ Свернуть' : `▼ Показать все (${slots.length})`}
        </button>
      )}
    </>
  )
}

export default function BookingPageWeb({
  executor, stats, reviews, fromSlot, onBack,
  services, selectedService, onServiceSelect, selectedExtras, onToggleExtra,
  servicesExpanded, setServicesExpanded,
  locationType, setLocationType,
  selectedSlot, setSelectedSlot,
  todaySlots, tomorrowSlots,
  showAllToday, setShowAllToday, showAllTomorrow, setShowAllTomorrow,
  pickedDate, pickedSlots, showAllPicked, setShowAllPicked, onPickDate,
  name, setName, phone, setPhone, address, setAddress, comment, setComment,
  showAllReviews, setShowAllReviews,
  loading, onSubmit, total, duration, formatSlot,
  mapRef, mapBoxRef,
}) {
  const session = getSession()
  // Клик по рейтингу в карточке мастера — плавный скролл к списку отзывов
  const reviewsRef = useRef(null)
  const hasReviews = !!(reviews && reviews.length)
  const scrollToReviews = () => reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const mainServices = services.filter(s => s.is_main)
  const mainToShow = servicesExpanded ? mainServices : mainServices.slice(0, 3)
  const hasMore = mainServices.length > 3 ||
    mainServices.some(m => services.filter(s => !s.is_main && s.parent_service_id === m.id).length > 2)

  // «от N ₽» — та же логика минимальной цены, что на витрине
  const prices = mainServices.filter(s => s.price != null).map(s => s.price)
  const fromPrice = prices.length ? Math.min(...prices) : null

  const hasMap = executor.latitude != null && executor.longitude != null
  const canPickTime = !fromSlot

  // Выбранное время «живо», только пока оно есть среди актуальных слотов.
  // Слоты пересобираются в BookingPage при смене услуги, допов и типа визита:
  // взял услугу подлиннее — время, которое больше не помещается, исчезает из
  // плиток, а значит должно исчезнуть и из карточки заявки. Приход со слота
  // с главной — исключение: там время приходит пропом и показывается всегда.
  const sameTime = (a, b) => a && b && new Date(a.start).getTime() === new Date(b.start).getTime()
  const liveSlot = fromSlot
    ? selectedSlot
    : (selectedSlot && [...(todaySlots || []), ...(tomorrowSlots || []), ...(pickedSlots || [])]
        .find(s => sameTime(s, selectedSlot))) || null

  return (
    <div className="eb-web" style={{ background: BG, minHeight: '100vh', color: INK, colorScheme: 'light', textAlign: 'left' }}>
      <WebBaseStyles />
      <style>{`
        .ebb-pin-head{width:30px;height:30px;background:#fff;border-radius:50%;box-shadow:0 4px 10px rgba(30,25,10,.28);position:relative}
        .ebb-pin-head::before{content:"";position:absolute;inset:8px;border-radius:50%;background:${Y}}
        .ebb-pin-head::after{content:"";position:absolute;bottom:-5px;left:50%;transform:translateX(-50%) rotate(45deg);width:11px;height:11px;background:#fff;border-radius:0 0 3px 0}
        .ebb-slot:hover{border-color:${Y} !important}
        .ebb-srv:hover{border-color:#E2D9BF !important}
        .ebb-submit:hover:enabled{background:${YP} !important}
        .ebb-link:hover{text-decoration:underline}
        .ebb-rating:hover span:last-child{text-decoration:underline}
        .ebb-input:focus{border-color:${Y} !important;box-shadow:0 0 0 3px rgba(253,184,19,.18)}
        @media(max-width:1080px){
          .ebb-layout{grid-template-columns:1fr !important}
          .ebb-summary{position:static !important}
        }
      `}</style>

      {/* ─── ШАПКА ─── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', maxWidth: 1240, margin: '0 auto' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: INK, flex: 'none' }}>
            <BrandMark size={40} />
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>ebookee</span>
          </a>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
            <a href="?executor=1" className="eb-role" style={ROLE_BTN}>👷 Я исполнитель</a>
            <a href={session?.id ? `?client=${session.id}` : '?client=0'} className="eb-role" style={ROLE_BTN}>🧑 Я клиент</a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 24px 40px' }}>
        <button onClick={onBack} className="ebb-link"
          style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 600, color: Y_DARK, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
          ← Назад к списку
        </button>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 22px', letterSpacing: '-.02em' }}>Оформление заявки</h1>

        <div className="ebb-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 400px', gap: 24, alignItems: 'start' }}>

          {/* ─────────── ЛЕВАЯ КОЛОНКА ─────────── */}
          <div>

            {/* Мастер */}
            <div style={{ ...CARD, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <Avatar url={executor.avatar_url} name={executor.users?.full_name} size={96} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{executor.users?.full_name || 'Исполнитель'}</h2>
                  {executor.is_verified && <span title="Проверенный исполнитель">✅</span>}
                </div>

                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {stats && stats.count > 0 ? (
                    <>
                      <button
                        onClick={hasReviews ? scrollToReviews : undefined}
                        className={hasReviews ? 'ebb-rating' : undefined}
                        title={hasReviews ? 'Читать отзывы' : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: 0, border: 'none',
                          background: 'none', font: 'inherit', cursor: hasReviews ? 'pointer' : 'default',
                        }}>
                        <span style={{ color: Y, fontWeight: 800, fontSize: 17 }}>★ {stats.avgRating}</span>
                        <span style={{ color: hasReviews ? Y_DARK : MUTED, fontSize: 14, fontWeight: hasReviews ? 700 : 400 }}>
                          {stats.count} {stats.count === 1 ? 'отзыв' : stats.count < 5 ? 'отзыва' : 'отзывов'}
                        </span>
                      </button>
                      {stats.alwaysOnTime && (
                        <span style={{ background: '#EAF7EE', color: '#1B7F3B', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 10 }}>✓ Всегда вовремя</span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: MUTED, fontSize: 14 }}>Новый исполнитель</span>
                  )}
                </div>

                {(executor.subway_station || executor.city) && (
                  <div style={{ marginTop: 8, fontSize: 14, color: '#666' }}>
                    {executor.subway_station && <>🚇 {executor.subway_station}</>}
                    {executor.subway_station && executor.city && ' · '}
                    {executor.city && <>📍 {executor.city}</>}
                  </div>
                )}
              </div>

              {fromPrice != null && (
                <div style={{ flex: 'none', textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: MUTED }}>Услуги</div>
                  <div style={{ fontSize: 22, fontWeight: 800, whiteSpace: 'nowrap' }}>от {rub(fromPrice)}</div>
                </div>
              )}
            </div>

            {/* Где находится мастер */}
            {hasMap && (
              <div style={CARD}>
                <h3 style={H}>Где находится мастер</h3>
                <div ref={mapBoxRef} style={{ position: 'relative', zIndex: 0, isolation: 'isolate', borderRadius: 14, overflow: 'hidden', border: '1px solid #E6E1D6' }}>
                  <MapContainer ref={mapRef} center={[executor.latitude, executor.longitude]} zoom={14}
                    scrollWheelZoom={false} style={{ height: 260, width: '100%' }} attributionControl={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[executor.latitude, executor.longitude]} icon={webPin} />
                  </MapContainer>
                </div>
                {(executor.subway_station || executor.address) && (
                  <p style={{ margin: '12px 0 0', fontSize: 14, color: '#666' }}>
                    {executor.subway_station && <>🚇 {executor.subway_station}</>}
                    {executor.subway_station && executor.address && ' · '}
                    {executor.address && <>📍 {executor.address}</>}
                  </p>
                )}
              </div>
            )}

            {/* Когда */}
            {canPickTime && (
              <div style={CARD}>
                <p style={{ ...LABEL, marginTop: 0 }}>Сегодня</p>
                <SlotChips slots={todaySlots} showAll={showAllToday} setShowAll={setShowAllToday}
                  selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />

                <p style={{ ...LABEL, marginTop: 20 }}>Завтра</p>
                <SlotChips slots={tomorrowSlots} showAll={showAllTomorrow} setShowAll={setShowAllTomorrow}
                  selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />

                <p style={{ ...LABEL, marginTop: 20 }}>Другая дата</p>
                <MiniCalendar web value={pickedDate} minDate={new Date().toISOString().split('T')[0]} onChange={onPickDate} />
                {pickedDate && (
                  <div style={{ marginTop: 12 }}>
                    <SlotChips slots={pickedSlots} showAll={showAllPicked} setShowAll={setShowAllPicked}
                      selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />
                  </div>
                )}
              </div>
            )}

            {/* Что делаем: тип визита + услуги */}
            <div style={CARD}>
              <p style={LABEL}>Тип визита</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[{ id: 'outcall', label: '🚗 Выезд ко мне' }, { id: 'incall', label: '🏠 Приём у мастера' }].map(t => {
                  const disabled =
                    (t.id === 'outcall' && selectedService?.location_type === 'incall') ||
                    (t.id === 'incall' && selectedService?.location_type === 'outcall')
                  const active = locationType === t.id
                  return (
                    <button key={t.id} onClick={() => !disabled && setLocationType(t.id)} disabled={disabled}
                      style={{
                        padding: '10px 18px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                        border: active ? `2px solid ${Y}` : '2px solid #EDEAE2',
                        background: active ? Y : '#fff',
                        color: disabled ? '#B4B4B4' : INK,
                        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1,
                      }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>

              <p style={LABEL}>Основная услуга</p>
              {mainToShow.length === 0 && <p style={{ color: MUTED, fontSize: 14 }}>У исполнителя пока нет услуг</p>}
              {mainToShow.map(service => {
                const allExtras = services.filter(s => !s.is_main && s.parent_service_id === service.id)
                const extrasToShow = servicesExpanded ? allExtras : allExtras.slice(0, 2)
                const active = selectedService?.id === service.id
                return (
                  <div key={service.id} style={{ marginBottom: 8 }}>
                    <div onClick={() => onServiceSelect(service)} className="ebb-srv"
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
                        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        border: active ? `2px solid ${Y}` : '2px solid #F1EEE7',
                        background: active ? Y_TINT : '#fff',
                      }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        {service.name}
                        <span style={{ color: MUTED, fontWeight: 500 }}>
                          {' '}{service.location_type === 'outcall' ? '🚗' : service.location_type === 'incall' ? '🏠' : '🚗🏠'} · {service.duration} мин
                        </span>
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap' }}>{rub(service.price)}</span>
                    </div>

                    {extrasToShow.map(extra => {
                      const on = !!selectedExtras.find(s => s.id === extra.id)
                      return (
                        <div key={extra.id} onClick={() => onToggleExtra(extra)} className="ebb-srv"
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
                            padding: '10px 16px 10px 30px', borderRadius: 12, marginTop: 6, cursor: 'pointer', fontSize: 14,
                            border: on ? `2px solid ${Y}` : '2px solid #F5F3EC',
                            background: on ? Y_SOFT : '#fff',
                          }}>
                          <span>➕ {extra.name}{extra.duration ? ` · ${extra.duration} мин` : ''}</span>
                          <span style={{ fontWeight: 700, color: Y_DARK, whiteSpace: 'nowrap' }}>+{rub(extra.price)}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {hasMore && (
                <button onClick={() => setServicesExpanded(!servicesExpanded)}
                  style={{ marginTop: 6, background: 'none', border: 'none', color: Y_DARK, cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: 0 }}>
                  {servicesExpanded ? '▲ Свернуть' : '▼ Показать все услуги'}
                </button>
              )}
            </div>

            {/* Отзывы */}
            {reviews && reviews.length > 0 && (
              <div ref={reviewsRef} style={{ ...CARD, scrollMarginTop: 90 }}>
                <h3 style={H}>Отзывы <span style={{ color: MUTED, fontWeight: 700 }}>{reviews.length}</span></h3>
                {(showAllReviews ? reviews : reviews.slice(0, 3)).map(r => {
                  const monthName = new Date(r.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
                  return (
                    <div key={r.id} style={{ padding: '12px 0', borderBottom: `1px solid ${LINE_2}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Stars n={r.rating} />
                        <span style={{ color: '#A0A0A0', fontSize: 12 }}>{monthName}</span>
                        {r.on_time === true && <span style={{ color: '#1B7F3B', fontSize: 12 }}>✓ Вовремя</span>}
                        {r.on_time === false && <span style={{ color: '#C97A16', fontSize: 12 }}>⚠️ Опоздал</span>}
                      </div>
                      {r.comment && <p style={{ margin: '6px 0 0', fontSize: 14, color: '#444', lineHeight: 1.5 }}>{r.comment}</p>}
                    </div>
                  )
                })}
                {reviews.length > 3 && (
                  <button onClick={() => setShowAllReviews(!showAllReviews)}
                    style={{ marginTop: 12, background: 'none', border: 'none', color: Y_DARK, cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: 0 }}>
                    {showAllReviews ? '▲ Скрыть' : `▼ Показать все (${reviews.length})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ─────────── ПРАВАЯ КОЛОНКА: заявка ─────────── */}
          <aside className="ebb-summary" style={{ position: 'sticky', top: 86 }}>
            <div style={{ ...CARD, marginBottom: 0, padding: 24 }}>
              <h3 style={{ ...H, marginBottom: 18 }}>Ваша заявка</h3>

              {/* Услуга и время */}
              <div style={{ background: Y_TINT, border: `1px solid ${Y_SOFT}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
                  <span style={{ fontWeight: 700 }}>{selectedService?.name || 'Услуга не выбрана'}</span>
                  {selectedService && <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{rub(selectedService.price)}</span>}
                </div>
                {selectedExtras.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, color: '#5E5E5E', marginTop: 6 }}>
                    <span>+ {e.name}</span>
                    <span style={{ whiteSpace: 'nowrap' }}>{rub(e.price)}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${Y_SOFT}`, marginTop: 12, paddingTop: 12, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5E5E5E' }}>📅 Время</span>
                  <span style={{ fontWeight: 700, textAlign: 'right' }}>
                    {liveSlot ? formatSlot(liveSlot.start) : <span style={{ color: '#C05C0F', fontWeight: 600 }}>не выбрано</span>}
                  </span>
                </div>
                <div style={{ fontSize: 14, display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: '#5E5E5E' }}>⏱ Длительность</span>
                  <span>{duration} мин</span>
                </div>
              </div>

              {/* Поля */}
              {locationType === 'outcall' ? (
                <div style={{ marginBottom: 14 }}>
                  <p style={LABEL}>Адрес *</p>
                  <input className="ebb-input" value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Улица, дом, квартира" style={INPUT} />
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <p style={LABEL}>Адрес исполнителя</p>
                  <div style={{ ...INPUT, background: '#F7F5F0', color: '#5E5E5E' }}>{executor.address || '—'}</div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <p style={LABEL}>Комментарий</p>
                <textarea className="ebb-input" value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Важные детали: площадь, порода собаки, возраст ребёнка…"
                  rows={3} style={{ ...INPUT, resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={LABEL}>Ваше имя *</p>
                <input className="ebb-input" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Как вас зовут" style={INPUT} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={LABEL}>Телефон *</p>
                <input className="ebb-input" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+7 999 123 45 67" style={INPUT} />
              </div>

              {/* Итого */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Итого</span>
                <span style={{ fontSize: 26, fontWeight: 800 }}>{rub(total)}</span>
              </div>

              <button onClick={onSubmit} disabled={loading} className="ebb-submit"
                style={{
                  width: '100%', padding: '15px', borderRadius: 13, border: 'none',
                  background: loading ? '#E3E0D8' : Y, color: loading ? '#8C8C8C' : INK,
                  fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                }}>
                {loading ? 'Отправляем…' : 'Подтвердить заявку'}
              </button>

              <p style={{ margin: '12px 0 0', fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                Нажимая кнопку, вы соглашаетесь с условиями оферты и политикой конфиденциальности.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <WebFooter />
    </div>
  )
}
