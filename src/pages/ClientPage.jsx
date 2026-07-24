import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useProfessions } from "../hooks/useProfessions.js";
import { loadReviewsByExecutors, calculateStats } from "../reviewsUtils.js";
import { loadOrdersCountByExecutors } from "../ordersUtils.js";
import { useCities } from "../hooks/useCities.js";
import { getTelegramUser, isWeb } from '../telegram'
import { getSession } from '../session'
import BookingPage from './BookingPage'
import { generateSlots } from '../utils/slotGenerator'
import ExecutorCard from '../components/ExecutorCard'
import ClientPageWeb from './ClientPageWeb'

function ClientPage() {
  const [executors, setExecutors] = useState([])
  const [loading, setLoading] = useState(true)
  // В вебе по умолчанию показываем всех исполнителей (все категории).
  // В мини-аппе поведение прежнее — стартуем с клининга.
  const [selectedService, setSelectedService] = useState(isWeb() ? 'all' : 'cleaning')
  const [selectedCity, setSelectedCity] = useState(() => localStorage.getItem('selectedCity') || 'all')
  const [selectedExecutor, setSelectedExecutor] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [showBooking, setShowBooking] = useState(false)
  const [myUserId, setMyUserId] = useState(null)
  const [myExecutorId, setMyExecutorId] = useState(null)
  const [expandedServices, setExpandedServices] = useState([])
  const [expandedBios, setExpandedBios] = useState([])
  // Строка поиска по имени, услугам, описанию, метро (фильтрация на клиенте, без запросов к БД)
  const [search, setSearch] = useState('')
  // Статистика отзывов по исполнителю: { executor_id: { avgRating, count, onTimePercent, alwaysOnTime } }
  const [reviewStats, setReviewStats] = useState({})
  // Сами отзывы по исполнителям (для показа в BookingPage)
  const [reviewsByExecutor, setReviewsByExecutor] = useState({})
  // Счётчики выполненных заказов: { executor_id: { fromApp, total } }
  const [ordersCountByExecutor, setOrdersCountByExecutor] = useState({})
  const [targetExecutorId, setTargetExecutorId] = useState(null)
  // Если в URL пришёл &book=1 — после загрузки исполнителей сразу откроем бронь.
  // Инициализируем СРАЗУ из URL, чтобы не мигнуть главной перед открытием брони.
  const [pendingBookExecutorId, setPendingBookExecutorId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('executor_id')
    return id && params.get('book') === '1' ? Number(id) : null
  })

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
  // Подстраховка: если за 4 сек бронь не открылась (исполнитель отфильтрован по городу и т.п.) — не зависаем на заглушке
  useEffect(() => {
    if (!pendingBookExecutorId) return
    const t = setTimeout(() => setPendingBookExecutorId(null), 4000)
    return () => clearTimeout(t)
  }, [pendingBookExecutorId])
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
    if (!tgUser?.telegram_id) {
      // Веб-юзер: личность из сохранённой сессии (вошёл по телефону)
      const session = getSession()
      if (session?.id) setMyUserId(session.id)
      return
    }

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
  let cancelled = false
  async function loadExecutors() {
    setLoading(true)
      let baseQuery = supabase
        .from('executors')
        .select('*, users(full_name), address')
        .eq('is_visible', true)
      // 'all' — без фильтра по профессии (показываем всех)
      if (selectedService !== 'all') {
        baseQuery = baseQuery.eq('service_type', selectedService)
      }
      const { data, error } = await baseQuery
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

      // Тянем отзывы и счётчики заказов параллельно — они не зависят друг от друга
      const [reviewsMap, ordersCountMap] = await Promise.all([
        loadReviewsByExecutors(executorIds),
        loadOrdersCountByExecutors(executorIds)
      ])
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
      if (cancelled) return
      setReviewStats(statsMap)
      setReviewsByExecutor(reviewsMap)
      setOrdersCountByExecutor(ordersCountMap)
      setExecutors(sortedExecutors)
      setLoading(false)
    }
    loadExecutors()
    return () => { cancelled = true }
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

  // Идём прямой дорогой в бронь (book=1) — пока грузим исполнителя, показываем заглушку, а не мигаем главной
  if (pendingBookExecutorId && !showBooking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '14px' }}>
        Открываем запись…
      </div>
    )
  }

  if (showBooking && selectedExecutor) {

    return (
      <BookingPage
        executor={selectedExecutor}
        stats={reviewStats[selectedExecutor.id]}
        reviews={reviewsByExecutor[selectedExecutor.id] || []}
        slot={selectedSlot}
        onBack={() => {
          // Пришли в бронь с карты (from=map) → возвращаемся на карту. Иначе — на главную/список.
          if (new URLSearchParams(window.location.search).get('from') === 'map') {
            window.location.href = '?map=1'
          } else {
            setShowBooking(false)
          }
        }}
        onSuccess={(clientId) => {
          alert('Заявка принята! Мы свяжемся с вами.')
          window.location.href = '/?client=' + clientId
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

  // ── ВЕБ (открыто вне Telegram) — отдельная десктоп-вёрстка. Мини-апп ниже не трогаем. ──
  if (isWeb()) {
    return (
      <ClientPageWeb
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        professions={professions}
        cities={cities}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        search={search}
        setSearch={setSearch}
        loading={loading}
        visibleExecutors={visibleExecutors}
        reviewStats={reviewStats}
        ordersCountByExecutor={ordersCountByExecutor}
        expandedServices={expandedServices}
        setExpandedServices={setExpandedServices}
        expandedBios={expandedBios}
        setExpandedBios={setExpandedBios}
        myUserId={myUserId}
        onBook={(executor) => {
          setSelectedExecutor(executor)
          setSelectedSlot(null)
          setShowBooking(true)
        }}
      />
    )
  }

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
        <a href="?map=1"
          style={{ fontSize: '12px', color: '#2481cc', textDecoration: 'none', padding: '5px 8px', borderRadius: '8px', border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}
        >
          🗺 Карта
        </a>
        <a href="?executor=1"
          style={{ fontSize: '12px', color: '#2481cc', textDecoration: 'none', padding: '5px 8px', borderRadius: '8px', border: '1px solid #e0e0e0', whiteSpace: 'nowrap', flex: 1, textAlign: 'center' }}
        >
          👷 Я исполнитель
        </a>
        {myUserId ? (
          <a href={`?client=${myUserId}`}
            style={{ fontSize: '12px', color: 'white', background: '#2481cc', textDecoration: 'none', padding: '5px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}
          >
           👤 Я клиент
          </a>
        ) : (!getTelegramUser()?.telegram_id && (
          <a href="?client=0"
            style={{ fontSize: '12px', color: 'white', background: '#2481cc', textDecoration: 'none', padding: '5px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}
          >
            👤 Войти
          </a>
        ))}
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, maxWidth: '160px', overflow: 'hidden' }}>
            <select
              value={selectedCity}
              onChange={(e) => {
                const value = e.target.value
                setSelectedCity(value)
                localStorage.setItem('selectedCity', value)
              }}
              style={{ width: '160px', minWidth: '160px', maxWidth: '160px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
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
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
        {services.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedService(s.id)}
            style={{
              padding: '7px 4px',
              borderRadius: '20px',
              border: 'none',
              background: selectedService === s.id ? '#2481cc' : '#f0f0f0',
              color: selectedService === s.id ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap'
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
          <ExecutorCard
            key={executor.id}
            executor={executor}
            professions={professions}
            reviewStats={reviewStats}
            ordersCountByExecutor={ordersCountByExecutor}
            expandedServices={expandedServices}
            setExpandedServices={setExpandedServices}
            expandedBios={expandedBios}
            setExpandedBios={setExpandedBios}
            onBook={() => {
              setSelectedExecutor(executor)
              setSelectedSlot(null)
              setShowBooking(true)
            }}
          />
        ))
      )}
    </div>
  )
}

export default ClientPage