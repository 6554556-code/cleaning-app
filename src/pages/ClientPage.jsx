import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useProfessions } from "../hooks/useProfessions.js";
import { loadReviewsByExecutors, calculateStats } from "../reviewsUtils.js";
import { loadOrdersCountByExecutors } from "../ordersUtils.js";
import { useCities } from "../hooks/useCities.js";
import { getTelegramUser } from '../telegram'
import BookingPage from './BookingPage'
import { generateSlots } from '../utils/slotGenerator'
import { getLocationIcon } from '../utils/locationIcon'
import Avatar from '../components/Avatar'

function ClientPage() {
  const [executors, setExecutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState('cleaning')
  const [selectedCity, setSelectedCity] = useState(() => localStorage.getItem('selectedCity') || 'all')
  const [selectedExecutor, setSelectedExecutor] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [showBooking, setShowBooking] = useState(false)
  const [myUserId, setMyUserId] = useState(null)
  const [myExecutorId, setMyExecutorId] = useState(null)
  const [expandedServices, setExpandedServices] = useState([])
  // Строка поиска по имени, услугам, описанию, метро (фильтрация на клиенте, без запросов к БД)
  const [search, setSearch] = useState('')
  // Статистика отзывов по исполнителю: { executor_id: { avgRating, count, onTimePercent, alwaysOnTime } }
  const [reviewStats, setReviewStats] = useState({})
  // Сами отзывы по исполнителям (для показа в BookingPage)
  const [reviewsByExecutor, setReviewsByExecutor] = useState({})
  // Счётчики выполненных заказов: { executor_id: { fromApp, total } }
  const [ordersCountByExecutor, setOrdersCountByExecutor] = useState({})
  const [targetExecutorId, setTargetExecutorId] = useState(null)
  // Если в URL пришёл &book=1 — после загрузки исполнителей сразу откроем бронь
  const [pendingBookExecutorId, setPendingBookExecutorId] = useState(null)

  // Ловим ?executor_id=N из URL — это переход с карты по кнопке "Записаться"
  // Или ?executor_id=N&book=1 — это переход из ЛК клиента "Записаться снова"
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('executor_id')
    if (!id) return
    setTargetExecutorId(Number(id))
    // Если есть флаг book=1 — запомним, что надо открыть бронь после загрузки
    if (params.get('book') === '1') {
      setPendingBookExecutorId(Number(id))
    }
    // Узнаём профессию исполнителя и переключаем фильтр на неё
    supabase
      .from('executors')
      .select('service_type')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data?.service_type) setSelectedService(data.service_type)
      })
  }, [])
  // Когда исполнители загрузились и есть pendingBookExecutorId — открываем бронь
  useEffect(() => {
    if (!pendingBookExecutorId || executors.length === 0) return
    const exec = executors.find(e => e.id === pendingBookExecutorId)
    if (exec) {
      setSelectedExecutor(exec)
      setSelectedSlot(null)
      setShowBooking(true)
      setPendingBookExecutorId(null)
    }
  }, [executors, pendingBookExecutorId])
  // Когда исполнители загрузились — прокручиваем к нужной карточке (если пришли с карты)
  useEffect(() => {
    if (!targetExecutorId || executors.length === 0) return
    // Небольшая задержка — чтобы DOM успел отрисоваться после смены фильтра
    const timer = setTimeout(() => {
      const card = document.getElementById(`executor-card-${targetExecutorId}`)
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setTargetExecutorId(null)
    }, 200)
    return () => clearTimeout(timer)
  }, [executors, targetExecutorId])
  const { professions } = useProfessions()
  const { cities } = useCities()
  const services = professions.map(p => ({
    id: p.code,
    label: `${p.icon || ''} ${p.name}`.trim()
  }))
// Определяем текущего пользователя по telegram_id
useEffect(() => {
  async function checkUser() {
    const tgUser = getTelegramUser()
    if (!tgUser?.telegram_id) return

    // --- Исполнитель: ищем строго по роли ---
    const { data: execUser } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', tgUser.telegram_id)
      .eq('role', 'executor')
      .maybeSingle()

    if (execUser) {
      const { data: executor } = await supabase
        .from('executors')
        .select('id')
        .eq('user_id', execUser.id)
        .maybeSingle()
      if (executor) setMyExecutorId(executor.id)
    }

    // --- Клиент: по факту заказов на любой строке этого telegram_id (без роли, без maybeSingle) ---
    const { data: myRows } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', tgUser.telegram_id)
    const myIds = (myRows || []).map(r => r.id)

    if (myIds.length > 0) {
      const { data: myOrders } = await supabase
        .from('orders')
        .select('client_id')
        .in('client_id', myIds)
        .limit(1)
      if (myOrders && myOrders.length > 0) {
        setMyUserId(myOrders[0].client_id)
      }
    }
  }
  checkUser()
}, [])
  useEffect(() => {
    async function loadExecutors() {
      setLoading(true)
      const { data, error } = await supabase
        .from('executors')
        .select('*, users(full_name), address')
        .eq('service_type', selectedService)
        .eq('is_visible', true)      
        .order('is_verified', { ascending: false })
        .order('rating', { ascending: false })

        if (error) {
          console.error(error)
          setLoading(false)
          return
        }
  
        // Фильтр по городу применяем тут (в Supabase сделали бы условный, но проще здесь)
        const filteredByCity = selectedCity === 'all'
          ? data
          : (data || []).filter((ex) => ex.city === selectedCity)
  
        const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 2)

      // ── N+1 → Batch ─────────────────────────────────────────────────────
      // Было: N исполнителей × 3 запроса = 30-60+ запросов на открытие.
      // Стало: 3 запроса на всех через .in(executorIds) = 5 запросов всего.
      const executorIds = filteredByCity.map(e => e.id)

      const [
        { data: allOrdersRaw },
        { data: allBlocksRaw },
        { data: allServicesRaw }
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .in('executor_id', executorIds)
          .neq('status', 'cancelled')
          .neq('is_deleted', true)
          .gte('scheduled_at', today.toISOString()),
        supabase
          .from('blocks')
          .select('executor_id, start_at, duration')
          .in('executor_id', executorIds)
          .gte('start_at', today.toISOString()),
        supabase
          .from('services')
          .select('*')
          .in('executor_id', executorIds)
          .eq('is_archived', false)
          .order('is_main', { ascending: false })
          .order('name', { ascending: true })
      ])

      // Группируем по executor_id для быстрого доступа без вложенных запросов
      const ordersByExecutor = {}
      const blocksByExecutor = {}
      const servicesByExecutor = {}
      ;(allOrdersRaw || []).forEach(o => {
        if (!ordersByExecutor[o.executor_id]) ordersByExecutor[o.executor_id] = []
        ordersByExecutor[o.executor_id].push(o)
      })
      ;(allBlocksRaw || []).forEach(b => {
        if (!blocksByExecutor[b.executor_id]) blocksByExecutor[b.executor_id] = []
        blocksByExecutor[b.executor_id].push(b)
      })
      ;(allServicesRaw || []).forEach(s => {
        if (!servicesByExecutor[s.executor_id]) servicesByExecutor[s.executor_id] = []
        servicesByExecutor[s.executor_id].push(s)
      })

      // Синхронная обработка — никаких запросов к БД внутри
      const executorsWithData = filteredByCity.map((executor) => {
        const existingOrders = ordersByExecutor[executor.id] || []
        const existingBlocks = blocksByExecutor[executor.id] || []
        const executorServices = servicesByExecutor[executor.id] || []

        // Выбираем самую короткую основную услугу для расчёта слотов
        // Сначала ищем incall (или both), если нет — outcall
        const mainActive = executorServices.filter(
          s => s.is_main && !s.is_archived && s.duration > 0
        )
        const incallServices = mainActive.filter(
          s => s.location_type === 'incall' || s.location_type === 'both'
        )
        const outcallServices = mainActive.filter(
          s => s.location_type === 'outcall'
        )
        const pool = incallServices.length > 0 ? incallServices : outcallServices
        const shortestService = pool.length > 0
          ? pool.reduce((a, b) => (a.duration < b.duration ? a : b))
          : null

        // Параметры для генератора слотов
        const slotParams = shortestService
          ? {
              duration: shortestService.duration,
              locationType: shortestService.location_type === 'both'
                ? 'incall'
                : shortestService.location_type
            }
          : {}

        // Генерируем слоты на сегодня и завтра
        const todaySlots = generateSlots(executor, existingOrders, today, slotParams, existingBlocks)
        const tomorrowDate = new Date(today)
        tomorrowDate.setDate(tomorrowDate.getDate() + 1)
        const tomorrowSlots = generateSlots(executor, existingOrders, tomorrowDate, slotParams, existingBlocks)
        const now = new Date()
        // Сегодня — только будущие, первые 4
        const todayFuture = todaySlots
          .filter(s => new Date(s.start) > now)
          .slice(0, 4)
        // Завтра — первые 4
        const tomorrowFuture = tomorrowSlots.slice(0, 4)

        return { ...executor, todaySlots: todayFuture, tomorrowSlots: tomorrowFuture, services: executorServices }
      })

      // Тянем отзывы для всех загруженных исполнителей и считаем статистику
      const reviewsMap = await loadReviewsByExecutors(executorIds)
      const ordersCountMap = await loadOrdersCountByExecutors(executorIds)
      const statsMap = {}
      executorIds.forEach(id => {
        statsMap[id] = calculateStats(reviewsMap[id] || [])
      })
      // Финальная сортировка: сначала верифицированные, внутри — по реальному рейтингу из отзывов.
      // Делаем здесь (а не полагаемся на order() из Supabase), потому что:
      // 1. filter() по городу нарушает порядок из БД
      // 2. реальный avgRating считается из отзывов, а не из колонки rating
      const sortedExecutors = [...executorsWithData].sort((a, b) => {
        // Верифицированные — наверх
        if (b.is_verified !== a.is_verified) return b.is_verified ? 1 : -1
        // Внутри группы — по рейтингу из отзывов (нет отзывов = 0)
        const ratingA = statsMap[a.id]?.avgRating ?? 0
        const ratingB = statsMap[b.id]?.avgRating ?? 0
        return ratingB - ratingA
      })
      setReviewStats(statsMap)
      setReviewsByExecutor(reviewsMap)
      setOrdersCountByExecutor(ordersCountMap)
      setExecutors(sortedExecutors)
      setLoading(false)
    }
    loadExecutors()
  }, [selectedService, selectedCity])
  function formatSlot(start) {
    const date = new Date(start)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isToday = date.toDateString() === today.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Сегодня ${time}`
    if (isTomorrow) return `Завтра ${time}`
    return time
  }

  if (showBooking && selectedExecutor) {

    return (
      <BookingPage
        executor={selectedExecutor}
        stats={reviewStats[selectedExecutor.id]}
        reviews={reviewsByExecutor[selectedExecutor.id] || []}
        slot={selectedSlot}
        onBack={() => setShowBooking(false)}
        onSuccess={() => {
          setShowBooking(false)
          alert('Заявка принята! Мы свяжемся с вами.')
        }}
      />
    )
  }

  // Фильтр по строке поиска: имя, названия услуг, описание (bio), метро.
  // Работает поверх уже загруженного и отсортированного списка — порядок сохраняется.
  const query = search.trim().toLowerCase()
  const visibleExecutors = query === ''
    ? executors
    : executors.filter((ex) => {
        const name = (ex.users?.full_name || '').toLowerCase()
        const bio = (ex.bio || '').toLowerCase()
        const subway = (ex.subway_station || '').toLowerCase()
        const serviceNames = (ex.services || [])
          .map((s) => (s.name || '').toLowerCase())
          .join(' ')
        return (
          name.includes(query) ||
          bio.includes(query) ||
          subway.includes(query) ||
          serviceNames.includes(query)
        )
      })

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
        
      <a href="?map=1"
          style={{ fontSize: '13px', color: '#2481cc', textDecoration: 'none', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e0e0e0' }}
        >
          🗺 Карта
        </a>
        
        <a href={myExecutorId ? '?executor=1' : '?register=executor'}
          style={{ fontSize: '13px', color: '#2481cc', textDecoration: 'none', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e0e0e0' }}
        >
          {myExecutorId ? '👷 Кабинет исполнителя' : '👷 Стать исполнителем'}
        </a>
        {myUserId && (
          <a href={`?client=${myUserId}`}
            style={{ fontSize: '13px', color: 'white', background: '#2481cc', textDecoration: 'none', padding: '6px 10px', borderRadius: '8px' }}
          >
            👤 Кабинет
          </a>
        )}
      </div>
      {cities.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '13px', color: '#666', gap: '8px' }}>
          {/* Поиск по имени, услугам, описанию, метро */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              style={{
                width: '100%',
                padding: '5px 28px 5px 30px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Очистить поиск"
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: '#999',
                  lineHeight: 1,
                  padding: '2px'
                }}
              >
                ×
              </button>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <select
              value={selectedCity}
              onChange={(e) => {
                const value = e.target.value
                setSelectedCity(value)
                localStorage.setItem('selectedCity', value)
              }}
              style={{ width: '130px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
            >
              <option value="all">Все города</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>Выберите услугу</h2>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {services.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedService(s.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: selectedService === s.id ? '#2481cc' : '#f0f0f0',
              color: selectedService === s.id ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p>Загружаем исполнителей...</p>
      ) : executors.length === 0 ? (
        <p>Исполнители не найдены</p>
      ) : visibleExecutors.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '24px 0' }}>
          <p style={{ margin: '0 0 8px' }}>По запросу «{search.trim()}» никого не нашли</p>
          <button
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', color: '#2481cc', cursor: 'pointer', fontSize: '14px' }}
          >
            Сбросить поиск
          </button>
        </div>
      ) : (
        visibleExecutors.map(executor => (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <Avatar url={executor.avatar_url} name={executor.users?.full_name} size={92} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {(() => {
                    const prof = professions.find(p => p.code === executor.service_type)
                    if (!prof) return null
                    return (
                      <span style={{ display: 'inline-block', marginBottom: '4px', padding: '2px 8px', background: '#f0f7ff', color: '#2481cc', borderRadius: '12px', fontSize: '11px' }}>
                        {prof.icon} {prof.name}
                      </span>
                    )
                  })()}
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span style={{ wordBreak: 'break-word', overflowWrap: 'break-word', textAlign: 'center' }}>
                      {executor.users?.full_name}
                    </span>
                    {executor.is_verified && <span title="Проверенный исполнитель" style={{ flexShrink: 0 }}>✅</span>}
                  </h3>
                  {(executor.city || executor.subway_station) && (
  <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px', textAlign: 'center', width: '100%', overflow: 'hidden' }}>
    {executor.city && <span>{'📍\u00A0'}{executor.city}</span>}
    {executor.city && executor.subway_station && ' · '}
    {executor.subway_station && <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>🚇 {executor.subway_station}</span>}
  </p>
)}
                </div>
              </div>
            
              <div style={{ textAlign: 'right', flexShrink: 0, alignSelf: 'flex-start' }}>
                {(() => {
                  const stats = reviewStats[executor.id]
                  if (!stats || stats.count === 0) {
                    return (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        background: '#f0f7ff',
                        color: '#2481cc',
                        borderRadius: '8px',
                        fontSize: '11px',
                        lineHeight: '1.3',
                        textAlign: 'center'
                      }}>
                        Новый<br />исполнитель
                      </span>
                    )
                  }
                  return (
                    <>
                      <span style={{ color: '#f5a623', fontWeight: 'bold', fontSize: '18px', display: 'block' }}>
                        ⭐ {stats.avgRating}
                      </span>
                      {stats.alwaysOnTime && (
                        <span title="Не опаздывает на встречи" style={{ color: '#2ecc71', fontSize: '11px', fontWeight: 'bold' }}>
                          ✓ Всегда вовремя
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
            
            <p style={{ color: '#666', margin: '8px 0', fontSize: '14px' }}>{executor.bio}</p>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px', flexWrap: 'wrap' }}>
            {(() => {
                const count = ordersCountByExecutor[executor.id]?.fromApp || 0
                if (count === 0) return null
                return <span>📦 {count} {count === 1 ? 'заказ' : count < 5 ? 'заказа' : 'заказов'}</span>              })()}
              
            </div>
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
          padding: '6px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '14px'
        }}>
          <span>⭐ {mainService.name} {getLocationIcon(mainService.location_type)} {mainService.duration ? `· ${mainService.duration} мин` : ''}</span>
          <span style={{ color: '#2481cc', fontWeight: 'bold' }}>{mainService.price} руб</span>
        </div>
        {extrasToShow.map(extra => (
          <div key={extra.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0 4px 12px',
            fontSize: '12px',
            color: '#888'
          }}>
            <span>➕ {extra.name} {extra.duration ? `· ${extra.duration} мин` : ''}</span>
            <span>+{extra.price} руб</span>
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
        style={{ marginTop: '6px', background: 'none', border: 'none', color: '#2481cc', cursor: 'pointer', fontSize: '13px', padding: 0 }}
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
                        <span key={slot.start.toString()} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #2481cc', background: '#f0f7ff', color: '#2481cc', fontSize: '13px' }}>
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
                        <span key={slot.start.toString()} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #2481cc', background: '#f0f7ff', color: '#2481cc', fontSize: '13px' }}>
                          {slot.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => {
                setSelectedExecutor(executor)
                setSelectedSlot(null)
                setShowBooking(true)
              }}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '10px',
                background: '#2481cc',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Записаться
            </button>
          </div>
        ))
      )}
    </div>
  )
}

export default ClientPage