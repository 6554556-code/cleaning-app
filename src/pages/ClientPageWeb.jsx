import { useState, useMemo, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Avatar from '../components/Avatar'
import ExecutorCard from '../components/ExecutorCard'
import { BrandMark, WebFooter, WebBaseStyles } from '../components/WebShell'
import useIsMobile from '../hooks/useIsMobile'
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
    { image: '/banners/ban248.png', link: 'https://t.me/Ebookee777_bot/Ebookee', alt: 'приложение ебуки в телеграм' },
]

// Логотип и подвал с реквизитами переехали в src/components/WebShell.jsx —
// они общие для всех веб-экранов, правятся там в одном месте.

// Пин с иконкой категории (белый кружок + «хвостик»).
// Иконка берётся из professions.icon; когда будут свои картинки —
// достаточно подменить содержимое .eb-pin-head на <img src=...>.
// Стили жёлтого пина — общие для десктопной и мобильной раскладки
const PIN_CSS = `
  .eb-pin-head{width:40px;height:40px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:19px;line-height:1;color:${Y};box-shadow:0 4px 10px rgba(30,25,10,.28);position:relative}
  .eb-pin-head img{width:22px;height:22px;object-fit:contain}
  .eb-pin-head::after{content:"";position:absolute;bottom:-6px;left:50%;transform:translateX(-50%) rotate(45deg);width:14px;height:14px;background:#fff;border-radius:0 0 3px 0}
`

// Компактные кнопки ролей в мобильной шапке
const ROLE_M = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '0 11px', height: 38,
  borderRadius: 11, fontSize: 13, fontWeight: 700, background: '#F4F2ED',
  color: '#3E3E3E', textDecoration: 'none', whiteSpace: 'nowrap',
}

// Тап по пустому месту карты — закрыть нижнюю карточку
function MapTapCatcher({ onTap }) {
  useMapEvents({ click: onTap })
  return null
}


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

// Что умеет исполнитель по типу визита (из его услуг):
//   inc — принимает у себя (🏠), out — выезжает (🚗).
function visitCaps(services) {
  const active = (services || []).filter(s => !s.is_archived)
  return {
    inc: active.some(s => s.location_type === 'incall' || s.location_type === 'both'),
    out: active.some(s => s.location_type === 'outcall' || s.location_type === 'both'),
  }
}

// Свободен ли исполнитель ближайшие 2 дня — тот же критерий, что у freeSoon-карусели.
function isFreeSoon(ex) {
  return (ex.todaySlots?.length > 0) || (ex.tomorrowSlots?.length > 0)
}

// Зелёный «неоновый» огонёк «свободен сегодня/завтра».
// Постоянный мягкий glow + расходящееся пульсирующее кольцо.
// На десктопе (>900px) при hover показывает подпись; на мобиле — только точка.
// Стили инлайном через React 19 <style precedence> — дедуплицируется автоматически,
// в мини-апп не утекает (класс уникальный, используется только тут).
function FreeDot() {
  return (
    <span
      className="eb-freedot-wrap"
      data-label="Свободен сегодня/завтра"
      aria-label="Свободен сегодня или завтра"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: 'none', marginLeft: 5 }}
    >
      <style precedence="default" href="eb-freedot">{`
        .eb-freedot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22C55E;
          box-shadow: 0 0 5px rgba(34,197,94,.65), 0 0 0 0 rgba(34,197,94,.7);
          animation: eb-freedot-pulse 1.8s ease-out infinite;
        }
        @keyframes eb-freedot-pulse {
          0%   { box-shadow: 0 0 5px rgba(34,197,94,.65), 0 0 0 0 rgba(34,197,94,.7); }
          70%  { box-shadow: 0 0 5px rgba(34,197,94,.65), 0 0 0 4.5px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 5px rgba(34,197,94,.65), 0 0 0 0 rgba(34,197,94,0); }
        }
        @media (min-width: 901px) {
          .eb-freedot-wrap[data-label]:hover::after {
            content: attr(data-label);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%) translateY(-8px);
            background: #1A1A1A;
            color: #fff;
            padding: 5px 9px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            pointer-events: none;
            z-index: 10;
            box-shadow: 0 2px 8px rgba(0,0,0,.15);
          }
          .eb-freedot-wrap[data-label]:hover::before {
            content: '';
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%) translateY(-2px);
            border: 4px solid transparent;
            border-top-color: #1A1A1A;
            pointer-events: none;
            z-index: 10;
          }
        }
      `}</style>
      <span className="eb-freedot" />
    </span>
  )
}

// ─── ФИЛЬТРЫ (нативные выпадашки) ───────────────────────────────
// Варианты для «оценки» и «места». Значения — строки (нативный <select>
// отдаёт строку); рейтинг приводим к числу при чтении.
const RATING_OPTS = [
  { v: '0', label: '⭐ Любая оценка' },
  { v: '4.5', label: '⭐ 4,5+' },
  { v: '4.8', label: '⭐ 4,8+' },
]
const VISIT_OPTS = [
  { v: 'any', label: '🚗🏠 Везде' },
  { v: 'outcall', label: '🚗 Выезд' },
  { v: 'incall', label: '🏠 Приём у себя' },
]

// Компактный фильтр рейтинга: одна кнопка-звезда. Тап циклит порог:
// любой → 4,5+ → 4,8+ → любой. Когда включён — лёгкая жёлтая подсветка.
function RatingButton({ value, onChange, style }) {
  const next = value === 0 ? 4.5 : value === 4.5 ? 4.8 : 0
  const label = value === 0 ? '⭐' : `⭐ ${String(value).replace('.', ',')}+`
  return (
    <button onClick={() => onChange(next)} aria-label="Фильтр по рейтингу"
      style={{
        height: 46, borderRadius: 13, border: '1px solid #E7E3DA',
        background: value ? '#FFF7E0' : '#fff', padding: '0 13px', fontSize: 14, fontWeight: 700,
        color: '#1A1A1A', cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
        display: 'inline-flex', alignItems: 'center', ...style,
      }}>
      {label}
    </button>
  )
}

// Нативный <select> в стиле «пилюли». Стрелку оставляем браузерную —
// как у селекта городов, чтобы вид был единый.
function FilterSelect({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={onChange} style={{
      height: 46, borderRadius: 13, border: '1px solid #E7E3DA', background: '#fff',
      padding: '0 14px', fontSize: 14, fontWeight: 700, color: '#1A1A1A',
      cursor: 'pointer', outline: 'none', ...style,
    }}>
      {options.map(o => <option key={String(o.v)} value={o.v}>{o.label}</option>)}
    </select>
  )
}

// ─── БОГАТАЯ КАРТОЧКА ПО ТАПУ НА ПИН ────────────────────────────
// Общая для обычной мобильной шторки и для полноэкранной карты.
// Показывает: аватар, имя, статус ✅, рейтинг, метро/город, плашки
// (профессия, тип визита, «всегда вовремя»), описание, цену и «Записаться».
function SheetCard({ ex, prof, stats, onBook, onClose }) {
  const caps = visitCaps(ex.services)
  const price = minPrice(ex.services)
  const rated = stats && stats.count > 0
  const bio = (ex.bio || '').trim()
  return (
    <div>
      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
        <Avatar url={ex.avatar_url} name={ex.users?.full_name} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ex.users?.full_name || 'Исполнитель'}
            </span>
            {ex.is_verified && <span title="Проверенный исполнитель" style={{ flex: 'none' }}>✅</span>}
            {isFreeSoon(ex) && <FreeDot />}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
            {rated
              ? <span><span style={{ color: '#E8A200', fontWeight: 800 }}>★ {stats.avgRating}</span> <span style={{ color: '#8C8C8C' }}>· {stats.count} отз.</span></span>
              : <span style={{ color: '#8C8C8C' }}>Новый исполнитель</span>}
            {(ex.subway_station || ex.city) && (
              <span style={{ color: '#8C8C8C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                {ex.subway_station ? `🚇 ${ex.subway_station}` : `📍 ${ex.city}`}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Закрыть"
            style={{ flex: 'none', width: 30, height: 30, borderRadius: 15, border: 'none', background: '#F4F2ED', color: '#6B6B6B', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Плашки: профессия · тип визита · статус */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
        {prof && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#FBF0D2', color: '#7A5A0A', borderRadius: 11, fontSize: 12, fontWeight: 700 }}>
            {prof.icon} {prof.name}
          </span>
        )}
        {(caps.inc || caps.out) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#EEF3FF', color: '#3B5BA5', borderRadius: 11, fontSize: 12, fontWeight: 700 }}>
            {caps.inc && caps.out ? '🚗 выезд · 🏠 приём' : caps.out ? '🚗 выезд' : '🏠 приём у себя'}
          </span>
        )}
        {rated && stats.alwaysOnTime && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#EAF7EE', color: '#1B7F3B', borderRadius: 11, fontSize: 12, fontWeight: 700 }}>✓ Всегда вовремя</span>
        )}
      </div>

      {/* Описание — не больше трёх строк */}
      {bio && (
        <p style={{ margin: '11px 0 0', fontSize: 13, color: '#5E5E5E', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {bio}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        {price != null && (
          <div style={{ flex: 'none' }}>
            <div style={{ fontSize: 12, color: '#8C8C8C', lineHeight: 1.2 }}>Услуги</div>
            <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap' }}>от {price} ₽</div>
          </div>
        )}
        <button onClick={onBook} className="eb-book"
          style={{ flex: 1, height: 48, borderRadius: 13, border: 'none', background: Y, color: '#1A1A1A', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          Записаться
        </button>
      </div>
    </div>
  )
}

// Небольшая карточка исполнителя для карусели «Свободны сегодня и завтра»
function MiniCard({ ex, prof, stats, onBook, width = 340 }) {
  const price = minPrice(ex.services)
  return (
    <div style={{
      position: 'relative', flex: `0 0 ${width}px`, background: '#fff', border: '1px solid #F0EDE6',
      borderRadius: 16, boxShadow: '0 1px 2px rgba(30,25,10,.05)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', padding: 16,
    }}>
      {/* мягкий жёлтый узор в углу */}
      <svg width="150" height="120" viewBox="0 0 150 120" style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none' }}>
        <path d="M20 120C40 70 90 96 120 52c18-26 14-44 14-52h16v120H20Z" fill="#FDB813" opacity=".10" />
        <path d="M62 120c14-30 44-24 62-52 10-16 12-30 12-38h14v90H62Z" fill="#FDB813" opacity=".10" />
      </svg>

      {/* верхний ряд: аватар + инфо (профессия, рейтинг, город, метро) */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 'none' }}>
          <Avatar url={ex.avatar_url} name={ex.users?.full_name} size={76} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* профессия слева, рейтинг справа */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {prof ? (
              <span style={{ display: 'inline-block', padding: '3px 10px', background: '#FBF0D2', color: '#7A5A0A', borderRadius: '12px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                {prof.icon} {prof.name}
              </span>
            ) : <span />}
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              {stats && stats.count > 0
                ? <>
                    <span style={{ color: '#f5a623', fontSize: '18px' }}>★</span>
                    <span style={{ color: '#1A1A1A', fontWeight: 800, fontSize: '22px' }}>{stats.avgRating}</span>
                    <span style={{ color: '#9A9A9A', fontSize: '13px' }}>({stats.count})</span>
                  </>
                : <span style={{ color: '#9A9A9A', fontSize: '13px' }}>Новый</span>}
            </span>
          </div>

          {/* город и метро */}
          {ex.city && <div style={{ fontSize: '13px', color: '#666', marginTop: 8 }}>📍 {ex.city}</div>}
          {ex.subway_station && <div style={{ fontSize: '13px', color: '#666', marginTop: 3 }}>🚇 {ex.subway_station}</div>}
        </div>
      </div>

      {/* низ на всю ширину карточки, прижат к нижнему краю (уровень совпадает у всех карточек) */}
      <div style={{ marginTop: 'auto', position: 'relative', zIndex: 1 }}>
        {/* имя (у левого края карточки) + цена (у правого) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '14px 0 12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.users?.full_name || 'Исполнитель'}</span>
            {ex.is_verified && <span title="Проверенный исполнитель">✅</span>}
            {isFreeSoon(ex) && <FreeDot />}
          </h3>
          {price != null && (
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: '12px', color: '#8C8C8C', fontWeight: 500 }}>от</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#1A1A1A' }}>{price.toLocaleString('ru-RU')}</span>
              <span style={{ fontSize: '12px', color: '#8C8C8C', fontWeight: 500 }}>₽</span>
            </span>
          )}
        </div>

        <button onClick={onBook} className="eb-book" style={{ width: '100%', padding: '11px', borderRadius: 11, background: Y, fontWeight: 'bold', fontSize: '16px', color: '#1A1A1A', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
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
  onBook, myUserId,view, setView, minRating, setMinRating, visitType, setVisitType,
  mapFull, setMapFull,
}) {
  const [selectedId, setSelectedId] = useState(null)
  // view, minRating, visitType — приходят из ClientPage через пропсы (чтобы не слетать при уходе в бронь и обратно)
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

  // ФИЛЬТРЫ КАРТЫ: рейтинг + тип визита. Применяем поверх visibleExecutors
  // (там уже отработали город, категория и поиск). Всё, что видно на карте,
  // в списке и в карусели, идёт из filtered.
  const filtered = useMemo(() => visibleExecutors.filter(ex => {
    if (minRating > 0) {
      const st = reviewStats[ex.id]
      const r = st && st.count > 0 ? parseFloat(st.avgRating) : 0
      if (r < minRating) return false        // «новые» (без отзывов) при фильтре по рейтингу прячем
    }
    if (visitType !== 'any') {
      const { inc, out } = visitCaps(ex.services)
      if (visitType === 'outcall' && !out) return false
      if (visitType === 'incall' && !inc) return false
    }
    return true
  }), [visibleExecutors, reviewStats, minRating, visitType])

  // Выбранный исполнитель для правой колонки: явно выбранный либо первый в списке
  const selected = useMemo(
    () => filtered.find(e => e.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  )
  const profOf = ex => professions.find(p => p.code === ex.service_type)

  // Опции для выпадашки услуг (мобилка): «Все услуги» + категории
  const serviceOpts = [{ v: 'all', label: '✨ Все услуги' }, ...professions.map(p => ({ v: p.code, label: `${p.icon} ${p.name}` }))]

  // Свободные сегодня/завтра — для карусели
  const freeSoon = filtered.filter(
    e => (e.todaySlots && e.todaySlots.length) || (e.tomorrowSlots && e.tomorrowSlots.length)
  )
  const withCoords = filtered.filter(e => e.latitude != null && e.longitude != null)
  // точки для авто-центрирования карты (город/категория/фильтр поменялись → подлетаем к выборке)
  const points = useMemo(() => withCoords.map(e => [e.latitude, e.longitude]), [withCoords])
  const pointsKey = `${selectedCity}|${selectedService}|${minRating}|${visitType}|${points.length}|${points[0] || ''}`

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
  const isMobile = useIsMobile()

  // Тап по пину на телефоне открывает нижнюю карточку (шторку).
  // Скроллить к карточке в списке нельзя: при подгрузке порциями нужного
  // исполнителя в отрисованном списке может просто не оказаться.
  const [sheetId, setSheetId] = useState(null)
  // mapFull — приходит из ClientPage через пропсы (чтобы не слетал при уходе в бронь и обратно)
  const sheetEx = useMemo(() => visibleExecutors.find(e => e.id === sheetId) || null, [visibleExecutors, sheetId])


  // ─────────────────────────────────────────────────────────────
  //  МОБИЛЬНАЯ РАСКЛАДКА ВЕБА
  //  Тот же код и те же данные, другая подача: одна колонка,
  //  низкая карта, категории чипами, карточки на всю ширину.
  //  В Telegram сюда не попадаем — там работает мини-апп.
  // ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="eb-web eb-m" style={{ background: '#FBFAF7', minHeight: '100vh', color: '#1A1A1A', colorScheme: 'light', textAlign: 'left' }}>
        <WebBaseStyles />
        <style>{`
          body{overflow-x:hidden}
          ${PIN_CSS}
          .eb-m-chip{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:16px;font-size:13px;font-weight:600;border:none;background:#EFECE6;color:#1A1A1A;cursor:pointer;line-height:1.15}
          .eb-m-chip .eb-m-ico{font-size:14px}
          .eb-m-chip[data-on="1"]{background:${Y};color:#1A1A1A}
          .eb-m-track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 12px 12px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
          .eb-m-track::-webkit-scrollbar{display:none}
          .eb-m-track > *{scroll-snap-align:start}
          .eb-m input,.eb-m select{font-size:16px}
          .leaflet-container{border-radius:14px}
          .eb-m-sheet{animation:eb-up .18s ease-out}
          @keyframes eb-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
        `}</style>

        {/* ─── ШАПКА ─── */}
        <header style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff', borderBottom: '1px solid #ECECEC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: '#1A1A1A', flex: 'none' }}>
              <BrandMark size={30} />
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em' }}>ebookee</span>
            </a>
            <div style={{ flex: 1 }} />
            <a href="?executor=1" style={ROLE_M}>👷 Исполнитель</a>
            <a href={myUserId ? `?client=${myUserId}` : '?client=0'} style={{ ...ROLE_M, background: Y, color: '#1A1A1A' }}>🧑 Клиент</a>
          </div>
        </header>

        <div style={{ padding: '12px 12px 0' }}>
          {/* ─── КАРТА ─── */}
          {/* Обычная карта 170px (как было). Кнопка «во весь экран» разворачивает
              её в полноэкранный оверлей — там удобно двигать и зумить. */}
          <div style={{ position: 'relative', zIndex: 0, isolation: 'isolate', height: 170, borderRadius: 14, overflow: 'hidden', border: '1px solid #E6E1D6' }}>
            <MapContainer center={MOSCOW_CENTER} zoom={11} style={{ height: '100%' }} attributionControl={false}>
              <AttributionNoFlag />
              <MapFocus points={points} pointsKey={pointsKey} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapTapCatcher onTap={() => setSheetId(null)} />
              {withCoords.map(ex => (
                <Marker key={ex.id} position={[ex.latitude, ex.longitude]} icon={pinIcon(profOf(ex)?.icon)}
                  eventHandlers={{ click: () => setSheetId(ex.id) }} />
              ))}
            </MapContainer>

            <button onClick={() => setMapFull(true)} aria-label="Открыть карту на весь экран"
              style={{
                position: 'absolute', right: 10, bottom: 10, zIndex: 500, height: 34, padding: '0 13px',
                borderRadius: 17, border: 'none', background: '#fff', color: '#1A1A1A', fontSize: 13, fontWeight: 700,
                boxShadow: '0 2px 8px rgba(30,25,10,.22)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
              ⛶ На весь экран
            </button>
          </div>

          {/* ─── ПОИСК + ГОРОД ─── */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #EDEAE2', borderRadius: 13, padding: '0 13px', height: 46 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', opacity: .5 }}><circle cx="11" cy="11" r="7" stroke="#8C8C8C" strokeWidth="2"/><path d="m20 20-3.2-3.2" stroke="#8C8C8C" strokeWidth="2" strokeLinecap="round"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск…"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: '#1A1A1A' }} />
            </div>
            {cities.length > 0 && (
              <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); localStorage.setItem('selectedCity', e.target.value) }}
                style={{ flex: 'none', maxWidth: 150, height: 46, borderRadius: 13, border: '1px solid #E7E3DA', background: '#fff', padding: '0 10px', color: '#2E2E2E', fontWeight: 600 }}>
                <option value="all">Все города</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* ─── ФИЛЬТРЫ: услуги + место + компактный рейтинг ─── */}
          <div style={{ display: 'flex', gap: 8, padding: '4px 12px 0' }}>
            <FilterSelect style={{ flex: 1, minWidth: 0 }} options={serviceOpts}
              value={selectedService} onChange={e => setSelectedService(e.target.value)} />
            <FilterSelect style={{ flex: 1, minWidth: 0 }} options={VISIT_OPTS}
              value={visitType} onChange={e => setVisitType(e.target.value)} />
            <RatingButton value={minRating} onChange={setMinRating} />
          </div>
        </div>

        {/* ─── СВОБОДНЫ СЕГОДНЯ И ЗАВТРА ─── */}
        {!loading && freeSoon.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 12px 12px' }}>Свободны сегодня и завтра</h3>
            <div className="eb-m-track">
              {freeSoon.map(ex => (
                <MiniCard key={ex.id} ex={ex} prof={profOf(ex)} stats={reviewStats[ex.id]} width={288} onBook={() => onBook(ex)} />
              ))}
            </div>
          </section>
        )}

        {/* ─── СПИСОК ИСПОЛНИТЕЛЕЙ ─── */}
        <section style={{ padding: '8px 12px 0' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>
            Специалисты {!loading && filtered.length > 0 && <span style={{ color: '#8C8C8C' }}>{filtered.length}</span>}
          </h3>
          {loading ? (
            <p style={{ color: '#888' }}>Загружаем исполнителей…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: '#888' }}>Под фильтры никто не подошёл — попробуйте ослабить условия</p>
          ) : (
            filtered.map(ex => <ExecutorCard key={ex.id} {...cardProps(ex)} />)
          )}
        </section>

        {/* ─── КАРТА ВО ВЕСЬ ЭКРАН ─── */}
        {mapFull && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#fff' }}>
            <MapContainer center={MOSCOW_CENTER} zoom={11} style={{ height: '100%', width: '100%' }} attributionControl={false}>
              <AttributionNoFlag />
              <MapFocus points={points} pointsKey={pointsKey} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapTapCatcher onTap={() => setSheetId(null)} />
              {withCoords.map(ex => (
                <Marker key={ex.id} position={[ex.latitude, ex.longitude]} icon={pinIcon(profOf(ex)?.icon)}
                  eventHandlers={{ click: () => setSheetId(ex.id) }} />
              ))}
            </MapContainer>

            {/* Верхняя панель: выпадашки услуги + оценка + место
                (слева отступ под зум +/-, справа — под крестик) */}
            <div style={{ position: 'absolute', top: 'calc(12px + env(safe-area-inset-top))', left: 0, right: 0, zIndex: 520, display: 'flex', gap: 8, paddingLeft: 54, paddingRight: 66 }}>
              <FilterSelect style={{ flex: 1, minWidth: 0 }} options={serviceOpts}
                value={selectedService} onChange={e => setSelectedService(e.target.value)} />
              <FilterSelect style={{ flex: 1, minWidth: 0 }} options={VISIT_OPTS}
                value={visitType} onChange={e => setVisitType(e.target.value)} />
              <RatingButton value={minRating} onChange={setMinRating} />
            </div>

            <button onClick={() => setMapFull(false)} aria-label="Закрыть карту"
              style={{
                position: 'absolute', right: 14, top: 'calc(12px + env(safe-area-inset-top))', zIndex: 540,
                width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#fff', color: '#1A1A1A',
                fontSize: 18, fontWeight: 800, boxShadow: '0 3px 12px rgba(30,25,10,.28)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              ✕
            </button>

            {/* Богатая карточка по тапу на пин — работает и на полном экране */}
            {sheetEx && (
              <div style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 510 }}>
                <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 8px 30px rgba(30,25,10,.3)', padding: '14px 16px' }}>
                  <SheetCard ex={sheetEx} prof={profOf(sheetEx)} stats={reviewStats[sheetEx.id]}
                    onClose={() => setSheetId(null)}
                    onBook={() => { setMapFull(false); onBook(sheetEx) }} />
                </div>
              </div>
            )}
          </div>
        )}

        <WebFooter />

        {/* ─── НИЖНЯЯ КАРТОЧКА ПО ТАПУ НА ПИН ─── */}
        {sheetEx && (
          <>
            <div onClick={() => setSheetId(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,10,.28)', zIndex: 1190 }} />
            <div className="eb-m-sheet" style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200, background: '#fff',
              borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 30px rgba(30,25,10,.25)',
              padding: '10px 16px calc(16px + env(safe-area-inset-bottom))',
            }}>
              <div style={{ width: 40, height: 4, borderRadius: 4, background: '#E4E0D6', margin: '0 auto 14px' }} />

              <SheetCard ex={sheetEx} prof={profOf(sheetEx)} stats={reviewStats[sheetEx.id]}
                onClose={() => setSheetId(null)}
                onBook={() => { setSheetId(null); onBook(sheetEx) }} />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="eb-web" style={{ background: '#FBFAF7', minHeight: '100vh', color: '#1A1A1A', colorScheme: 'light', textAlign: 'left' }}>
      <style>{`
        /* Веб открыт вне Telegram: снимаем ограничения шаблонного #root (max-width:500px, центрирование),
           которые нужны мини-аппу, но ломают широкую вёрстку. Действует только пока смонтирован ClientPageWeb. */
        #root{max-width:none !important;width:100% !important;margin:0 !important;padding:0 !important;text-align:left !important;word-break:normal !important;font-size:15px}
        body{overflow-x:auto}
        .eb-web *{overflow-wrap:normal;word-break:normal}
        ${PIN_CSS}
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
          {/* view switch + фильтры (оценка, место) в одну строку */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', background: '#F0EDE6', borderRadius: 13, padding: 4, gap: 4 }}>
              {[['map', '🗺 Карта'], ['list', '☰ Список']].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', color: view === v ? '#1A1A1A' : '#6B6B6B', background: view === v ? '#fff' : 'transparent', boxShadow: view === v ? '0 1px 2px rgba(30,25,10,.05)' : 'none' }}>{label}</button>
              ))}
            </div>
            <FilterSelect style={{ flex: 'none', minWidth: 168 }} options={RATING_OPTS}
              value={String(minRating)} onChange={e => setMinRating(Number(e.target.value))} />
            <FilterSelect style={{ flex: 'none', minWidth: 168 }} options={VISIT_OPTS}
              value={visitType} onChange={e => setVisitType(e.target.value)} />
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
                ) : filtered.length === 0 ? (
                  <p style={{ color: '#888' }}>Под фильтры никто не подошёл — попробуйте ослабить условия</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(332px,1fr))', gap: 20, alignItems: 'start' }}>
                    {filtered.map(ex => (
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
