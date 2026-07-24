import { useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect } from 'react'
import Avatar from '../components/Avatar'
import ExecutorCard from '../components/ExecutorCard'
import { BrandMark, WebFooter } from '../components/WebShell'
import { Y, YP } from '../webTheme'

const MOSCOW_CENTER = [55.7558, 37.6173]
const ROLE_BTN = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', height: 50,
  borderRadius: 13, fontSize: 15, fontWeight: 600,
  background: '#F4F2ED', color: '#4A4A4A', textDecoration: 'none', whiteSpace: 'nowrap',
}

// ─── РЕКЛАМНЫЕ БАННЕРЫ (левая колонка) ──────────────────────────
// Как добавить: положи картинку в public/banners/ и допиши объект:
//   { image: '/banners/promo.jpg', link: 'https://...', alt: 'Скидка 20%' }
// link можно не указывать — тогда баннер просто картинка без клика.
// Пока список пуст — на его месте серая заглушка «рекламные баннеры».
const BANNERS = [
    { image: '/banners/ban1.png', link: 'https://partner.ru', alt: 'Скидка 20%' },
]

// Логотип и подвал с реквизитами переехали в src/components/WebShell.jsx —
// они общие для всех веб-экранов, правятся там в одном месте.

// Пин с иконкой категории (белый кружок + «хвостик»).
// Иконка берётся из professions.icon; когда будут свои картинки —
// достаточно подменить содержимое .eb-pin-head на <img src=...>.
const pinCache = new Map()
function pinIcon(glyph) {
  const key = glyph || 'e'
  if (!pinCache.has(key)) {
    pinCache.set(key, L.divIcon({
      className: 'eb-pin',
      html: `<div class="eb-pin-head">${key}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -38],
    }))
  }
  return pinCache.get(key)
}

// Подводит карту к текущей выборке: выбран город — центрируемся на его исполнителях.
// Координаты берём из самих исполнителей, поэтому работает для любого города из базы.
function MapFocus({ pointsKey, points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.flyTo(points[0], 13, { duration: 0.8 })
    } else {
      map.flyToBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 14, duration: 0.8 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, map])
  return null
}

// Обязательная атрибуция OSM без флага/«Leaflet»
function AttributionNoFlag() {
  const map = useMap()
  useEffect(() => {
    map.attributionControl?.remove()
    const ctrl = L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map)
    return () => ctrl.remove()
  }, [map])
  return null
}

function minPrice(services) {
  const prices = (services || []).filter(s => !s.is_archived && s.price != null).map(s => s.price)
  return prices.length ? Math.min(...prices) : null
}

// Небольшая карточка исполнителя для карусели «Свободны сегодня и завтра»
function MiniCard({ ex, prof, stats, onBook }) {
  const price = minPrice(ex.services)
  return (
    <div style={{
      position: 'relative', flex: '0 0 340px', background: '#fff', border: '1px solid #F0EDE6',
      borderRadius: 16, boxShadow: '0 1px 2px rgba(30,25,10,.05)', overflow: 'hidden',
      display: 'flex', gap: 14, padding: 16, alignItems: 'flex-start',
    }}>
      {/* мягкий жёлтый узор в углу */}
      <svg width="150" height="120" viewBox="0 0 150 120" style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none' }}>
        <path d="M20 120C40 70 90 96 120 52c18-26 14-44 14-52h16v120H20Z" fill="#FDB813" opacity=".10" />
        <path d="M62 120c14-30 44-24 62-52 10-16 12-30 12-38h14v90H62Z" fill="#FDB813" opacity=".10" />
      </svg>

      <div style={{ flex: 'none', position: 'relative', zIndex: 1 }}>
        <Avatar url={ex.avatar_url} name={ex.users?.full_name} size={76} />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        {prof && (
          <span style={{ display: 'inline-block', padding: '3px 10px', background: '#FBF0D2', color: '#7A5A0A', borderRadius: '12px', fontSize: '11px', marginBottom: 8 }}>
            {prof.icon} {prof.name}
          </span>
        )}
        <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.users?.full_name || 'Исполнитель'}</span>
          {ex.is_verified && <span title="Проверенный исполнитель">✅</span>}
        </h3>
        {ex.city && <div style={{ fontSize: '13px', color: '#666', marginTop: 5 }}>📍 {ex.city}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '10px 0 12px' }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {stats && stats.count > 0
              ? <><span style={{ color: '#f5a623', fontWeight: 'bold', fontSize: '16px' }}>★ {stats.avgRating}</span> <span style={{ color: '#666', fontSize: '13px' }}>({stats.count})</span></>
              : <span style={{ color: '#666', fontSize: '13px' }}>Новый</span>}
          </span>
          {price != null && (
            <span style={{ fontSize: '16px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              от {price} <span style={{ fontSize: '13px', color: '#666' }}>₽</span>
            </span>
          )}
        </div>

        <button onClick={onBook} className="eb-book" style={{ width: '100%', padding: '11px', borderRadius: 11, background: Y, fontWeight: 'bold', fontSize: '16px', color: '#1A1A1A', border: 'none', cursor: 'pointer' }}>
          Записаться
        </button>
      </div>
    </div>
  )
}

export default function ClientPageWeb({
  selectedService, setSelectedService,
  professions, cities, selectedCity, setSelectedCity,
  search, setSearch, loading,
  visibleExecutors, reviewStats, ordersCountByExecutor,
  expandedServices, setExpandedServices, expandedBios, setExpandedBios,
  onBook, myUserId,
}) {
  const [view, setView] = useState('map')            // 'map' | 'list'
  const [selectedId, setSelectedId] = useState(null)
  const trackRef = useRef(null)
  const rafRef = useRef(null)
  const dirRef = useRef(0)
  const framesRef = useRef(0)

  // Пока кнопка зажата — лента едет непрерывно (кадр за кадром), а не прыгает на карточку.
  const startScroll = dir => {
    stopScroll()
    dirRef.current = dir
    framesRef.current = 0
    let speed = 5
    const step = () => {
      framesRef.current += 1
      speed = Math.min(speed + 0.55, 18)          // мягкий разгон: чем дольше держишь, тем быстрее
      if (trackRef.current) trackRef.current.scrollLeft += dir * speed
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }
  const stopScroll = () => {
    if (!rafRef.current) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    // короткий клик (не удержание) — доводим ровно на одну карточку
    if (framesRef.current <= 5) {
      trackRef.current?.scrollBy({ left: dirRef.current * 356, behavior: 'smooth' })
    }
    framesRef.current = 0
  }
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  // Выбранный исполнитель для правой колонки: явно выбранный либо первый в списке
  const selected = useMemo(
    () => visibleExecutors.find(e => e.id === selectedId) || visibleExecutors[0] || null,
    [visibleExecutors, selectedId]
  )
  const profOf = ex => professions.find(p => p.code === ex.service_type)

  // Свободные сегодня/завтра — для карусели
  const freeSoon = visibleExecutors.filter(
    e => (e.todaySlots && e.todaySlots.length) || (e.tomorrowSlots && e.tomorrowSlots.length)
  )
  const withCoords = visibleExecutors.filter(e => e.latitude != null && e.longitude != null)
  // точки для авто-центрирования карты (город/категория поменялись → подлетаем к выборке)
  const points = useMemo(() => withCoords.map(e => [e.latitude, e.longitude]), [withCoords])
  const pointsKey = `${selectedCity}|${selectedService}|${points.length}|${points[0] || ''}`

  const cardProps = ex => ({
    executor: ex,
    professions,
    reviewStats,
    ordersCountByExecutor,
    expandedServices, setExpandedServices,
    expandedBios, setExpandedBios,
    web: true,
    onBook: () => onBook(ex),
  })

  const isListMode = view === 'list'

  return (
    <div className="eb-web" style={{ background: '#FBFAF7', minHeight: '100vh', color: '#1A1A1A', colorScheme: 'light', textAlign: 'left' }}>
      <style>{`
        /* Веб открыт вне Telegram: снимаем ограничения шаблонного #root (max-width:500px, центрирование),
           которые нужны мини-аппу, но ломают широкую вёрстку. Действует только пока смонтирован ClientPageWeb. */
        #root{max-width:none !important;width:100% !important;margin:0 !important;padding:0 !important;text-align:left !important;word-break:normal !important;font-size:15px}
        body{overflow-x:auto}
        .eb-web *{overflow-wrap:normal;word-break:normal}
        .eb-pin-head{width:40px;height:40px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:19px;line-height:1;color:${Y};box-shadow:0 4px 10px rgba(30,25,10,.28);position:relative}
        .eb-pin-head img{width:22px;height:22px;object-fit:contain}
        .eb-pin-head::after{content:"";position:absolute;bottom:-6px;left:50%;transform:translateX(-50%) rotate(45deg);width:14px;height:14px;background:#fff;border-radius:0 0 3px 0}
        .eb-cat:hover{background:#F4F2ED}
        .eb-role:hover{background:#EEEBE4 !important}
        .eb-chip:hover{transform:translateY(-1px)}
        .eb-book:hover{background:${YP} !important}
        .eb-track::-webkit-scrollbar{display:none}
        .eb-arrow:hover{background:#F7F5F0 !important}
        .eb-arrow{user-select:none}
        .eb-track{scroll-behavior:auto}
        .leaflet-container{border-radius:16px;font-family:inherit}
        @media(max-width:1000px){
          .eb-layout{grid-template-columns:1fr !important}
          .eb-banners{display:none}
          .eb-side{order:1}.eb-center{order:3}.eb-selected{order:2}
        }
      `}</style>

      {/* ─── HEADER ─── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff', borderBottom: '1px solid #ECECEC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', maxWidth: 1560, margin: '0 auto' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: '#1A1A1A', flex: 'none' }}>
            <BrandMark size={40} />
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>ebookee</span>
          </a>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, background: '#F5F3EE', border: '1px solid #EDEAE2', borderRadius: 13, padding: '0 16px', height: 50 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', opacity: .5 }}><circle cx="11" cy="11" r="7" stroke="#8C8C8C" strokeWidth="2"/><path d="m20 20-3.2-3.2" stroke="#8C8C8C" strokeWidth="2" strokeLinecap="round"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск услуг и исполнителей"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: '#1A1A1A' }} />
          </div>

          {cities.length > 0 && (
            <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); localStorage.setItem('selectedCity', e.target.value) }}
              style={{ flex: 'none', height: 50, borderRadius: 13, border: '1px solid #E7E3DA', background: '#fff', padding: '0 14px', fontSize: 15, color: '#2E2E2E', fontWeight: 600, cursor: 'pointer' }}>
              <option value="all">Все города</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
            <a href="?executor=1" className="eb-role" style={ROLE_BTN}>👷 Я исполнитель</a>
            <a href={myUserId ? `?client=${myUserId}` : '?client=0'} className="eb-role" style={ROLE_BTN}>🧑 Я клиент</a>
          </div>
        </div>
      </header>

      {/* ─── LAYOUT ─── */}
      <div className="eb-layout" style={{ display: 'grid', gridTemplateColumns: isListMode ? '248px minmax(0,1fr)' : '248px minmax(0,1fr) 380px', gap: 20, padding: '20px 24px', alignItems: 'start', maxWidth: 1560, margin: '0 auto' }}>

        {/* LEFT: categories + banners */}
        <aside className="eb-side">
          <h2 style={{ fontSize: 21, fontWeight: 800, margin: '6px 2px 16px' }}>Выберите услугу</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <button className="eb-cat" onClick={() => setSelectedService('all')}
              style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', padding: '13px 15px', borderRadius: 13, fontSize: 15, fontWeight: 600, color: '#1A1A1A', border: 'none', cursor: 'pointer', background: selectedService === 'all' ? Y : 'transparent' }}>
              <span style={{ fontSize: 19, width: 23, textAlign: 'center' }}>✨</span>Все категории
            </button>
            {professions.map(p => {
              const active = selectedService === p.code
              return (
                <button key={p.code} className="eb-cat" onClick={() => setSelectedService(p.code)}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', padding: '13px 15px', borderRadius: 13, fontSize: 15, fontWeight: 600, color: '#1A1A1A', border: 'none', cursor: 'pointer', background: active ? Y : 'transparent' }}>
                  <span style={{ fontSize: 19, width: 23, textAlign: 'center' }}>{p.icon}</span>{p.name}
                </button>
              )
            })}
          </nav>
          {/* Рекламные баннеры — список BANNERS в начале файла */}
          <div className="eb-banners" style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BANNERS.length === 0 ? (
              <div style={{ background: '#FBF2DC', border: '1px solid #F6E7BE', borderRadius: 16, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#B79A55', fontSize: 15, fontWeight: 600, padding: 20 }}>
                рекламные<br />баннеры
              </div>
            ) : (
              BANNERS.map((b, i) => {
                const img = (
                  <img src={b.image} alt={b.alt || ''} loading="lazy"
                    style={{ display: 'block', width: '100%', borderRadius: 16, border: '1px solid #F0EDE6' }} />
                )
                return b.link
                  ? <a key={i} href={b.link} target="_blank" rel="noopener noreferrer sponsored">{img}</a>
                  : <div key={i}>{img}</div>
              })
            )}
          </div>
        </aside>

        {/* CENTER */}
        <section className="eb-center">
          {/* view switch */}
          <div style={{ display: 'inline-flex', background: '#F0EDE6', borderRadius: 13, padding: 4, gap: 4, marginBottom: 16 }}>
            {[['map', '🗺 Карта'], ['list', '☰ Список']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', color: view === v ? '#1A1A1A' : '#6B6B6B', background: view === v ? '#fff' : 'transparent', boxShadow: view === v ? '0 1px 2px rgba(30,25,10,.05)' : 'none' }}>{label}</button>
            ))}
          </div>

          {(
            <>
              {!isListMode && (
                <>
                  {/* MAP */}
                  <div style={{ position: 'relative', zIndex: 0, isolation: 'isolate', height: 560, borderRadius: 16, overflow: 'hidden', border: '1px solid #E6E1D6', boxShadow: '0 1px 2px rgba(30,25,10,.05)' }}>
                    <MapContainer center={MOSCOW_CENTER} zoom={11} style={{ height: '100%' }} attributionControl={false}>
                      <AttributionNoFlag />
                      <MapFocus points={points} pointsKey={pointsKey} />
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {withCoords.map(ex => (
                        <Marker key={ex.id} position={[ex.latitude, ex.longitude]} icon={pinIcon(profOf(ex)?.icon)}
                          eventHandlers={{ click: () => setSelectedId(ex.id) }}>
                          <Popup>
                            <div style={{ minWidth: 130, textAlign: 'center' }}>
                              <b>{ex.users?.full_name || 'Исполнитель'}</b>
                              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{profOf(ex)?.name}</div>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>

                  {/* CAROUSEL: свободны сегодня и завтра */}
                  {!loading && freeSoon.length > 0 && (
                    <section style={{ marginTop: 22 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 14px' }}>
                        <h3 style={{ fontSize: 20, fontWeight: 800 }}>Свободны сегодня и завтра</h3>
                        <span onClick={() => setView('list')} style={{ color: '#E39A00', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Смотреть все</span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <button className="eb-arrow" aria-label="Назад"
                          onMouseDown={() => startScroll(-1)} onMouseUp={stopScroll} onMouseLeave={stopScroll}
                          onTouchStart={() => startScroll(-1)} onTouchEnd={stopScroll}
                          style={{ position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 6, width: 44, height: 44, borderRadius: '50%', background: '#fff', border: '1px solid #ECECEC', boxShadow: '0 6px 22px rgba(40,34,12,.12)', cursor: 'pointer', fontSize: 18, color: '#3E3E3E' }}>‹</button>
                        <div ref={trackRef} className="eb-track" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 2px 8px', scrollbarWidth: 'none' }}>
                          {freeSoon.map(ex => (
                            <MiniCard key={ex.id} ex={ex} prof={profOf(ex)} stats={reviewStats[ex.id]} onBook={() => onBook(ex)} />
                          ))}
                        </div>
                        <button className="eb-arrow" aria-label="Вперёд"
                          onMouseDown={() => startScroll(1)} onMouseUp={stopScroll} onMouseLeave={stopScroll}
                          onTouchStart={() => startScroll(1)} onTouchEnd={stopScroll}
                          style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 6, width: 44, height: 44, borderRadius: '50%', background: '#fff', border: '1px solid #ECECEC', boxShadow: '0 6px 22px rgba(40,34,12,.12)', cursor: 'pointer', fontSize: 18, color: '#3E3E3E' }}>›</button>
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* LIST of full cards (в списочном режиме — на всю ширину, 3 в ряд) */}
              <section style={{ marginTop: isListMode ? 0 : 22 }}>
                {!isListMode && <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 4px 14px' }}>Специалисты на карте</h3>}
                {loading ? (
                  <p style={{ color: '#888' }}>Загружаем исполнителей…</p>
                ) : visibleExecutors.length === 0 ? (
                  <p style={{ color: '#888' }}>Исполнители не найдены</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(332px,1fr))', gap: 20, alignItems: 'start' }}>
                    {visibleExecutors.map(ex => (
                      <div key={ex.id} onClick={() => setSelectedId(ex.id)} style={{ cursor: 'pointer' }}>
                        <ExecutorCard {...cardProps(ex)} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </section>

        {/* RIGHT: selected specialist */}
        {!isListMode && (
          <aside className="eb-selected">
            {selected ? (
              <ExecutorCard {...cardProps(selected)} onMessage={() => window.alert('Написать исполнителю — скоро')} />
            ) : (
              <div style={{ background: '#fff', border: '1px solid #ECECEC', borderRadius: 16, padding: 22, color: '#888', textAlign: 'center' }}>
                Выберите исполнителя на карте
              </div>
            )}
          </aside>
        )}
      </div>

      <WebFooter />
    </div>
  )
}
