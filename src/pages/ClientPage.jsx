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
  // Статистика отзывов по исполнителю: { executor_id: { avgRating, count, onTimePercent, alwaysOnTime } }
  const [reviewStats, setReviewStats] = useState({})
  // Сами отзывы по исполнителям (для показа в BookingPage)
  const [reviewsByExecutor, setReviewsByExecutor] = useState({})
  // Счётчики выполненных заказов: { executor_id: { fromApp, total } }
  const [ordersCountByExecutor, setOrdersCountByExecutor] = useState({})
  const [targetExecutorId, setTargetExecutorId] = useState(null)

  // Ловим ?executor_id=N из URL — это переход с карты по кнопке "Записаться"
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('executor_id')
    if (!id) return
    setTargetExecutorId(Number(id))
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

      const executorsWithData = await Promise.all(filteredByCity.map(async (executor) => {
       // Загружаем существующие заказы исполнителя
const { data: existingOrders } = await supabase
.from('orders')
.select('*')
.eq('executor_id', executor.id)
.neq('status', 'cancelled')
.neq('is_deleted', true)
.gte('scheduled_at', today.toISOString())

// Загружаем блоки исполнителя (перерывы, дорога)
const { data: existingBlocks } = await supabase
.from('blocks')
.select('start_at, duration')
.eq('executor_id', executor.id)

// Загружаем услуги исполнителя (нужны до генерации слотов, чтобы выбрать самую короткую)
const { data: executorServices } = await supabase
  .from('services')
  .select('*')
  .eq('executor_id', executor.id)
  .eq('is_archived', false)
  .order('is_main', { ascending: false })
  .order('name', { ascending: true })

// Выбираем самую короткую основную услугу для расчёта слотов
// Сначала ищем incall (или both), если нет — outcall
const mainActive = (executorServices || []).filter(
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
const todaySlots = generateSlots(executor, existingOrders || [], today, slotParams, existingBlocks || [])
const tomorrowDate = new Date(today)
tomorrowDate.setDate(tomorrowDate.getDate() + 1)
const tomorrowSlots = generateSlots(executor, existingOrders || [], tomorrowDate, slotParams, existingBlocks || [])
const now = new Date()
// Сегодня — только будущие, первые 4
const todayFuture = todaySlots
  .filter(s => new Date(s.start) > now)
  .slice(0, 4)
// Завтра — первые 4
const tomorrowFuture = tomorrowSlots.slice(0, 4)


  return { ...executor, todaySlots: todayFuture, tomorrowSlots: tomorrowFuture, services: executorServices || [] }
      }))
// Тянем отзывы для всех загруженных исполнителей и считаем статистику
      const executorIds = executorsWithData.map(e => e.id)
      const reviewsMap = await loadReviewsByExecutors(executorIds)
      const ordersCountMap = await loadOrdersCountByExecutors(executorIds)
      const statsMap = {}
      executorIds.forEach(id => {
        statsMap[id] = calculateStats(reviewsMap[id] || [])
      })
      setReviewStats(statsMap)
      setReviewsByExecutor(reviewsMap)
      setOrdersCountByExecutor(ordersCountMap)
      setExecutors(executorsWithData)
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', fontSize: '13px', color: '#666' }}>
          <label>
            Город:{' '}
            <select
              value={selectedCity}
              onChange={(e) => {
                const value = e.target.value
                setSelectedCity(value)
                localStorage.setItem('selectedCity', value)
              }}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
            >
              <option value="all">Все</option>
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
      ) : (
        executors.map(executor => (
          <div key={executor.id} id={`executor-card-${executor.id}`} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {(() => {
  const prof = professions.find(p => p.code === executor.service_type)
  if (!prof) return null
  return (
    <span style={{ display: 'inline-block', marginBottom: '4px', padding: '2px 8px', background: '#f0f7ff', color: '#2481cc', borderRadius: '12px', fontSize: '11px' }}>
      {prof.icon} {prof.name}
    </span>
  )
})()}
<h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
  {executor.users?.full_name}
  {executor.is_verified && <span title="Проверенный исполнитель">✅</span>}
</h3>
            
              <div style={{ textAlign: 'right' }}>
                {(() => {
                  const stats = reviewStats[executor.id]
                  if (!stats || stats.count === 0) {
                    return <span style={{ color: '#999', fontSize: '12px' }}>Новый исполнитель</span>
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
            {executor.subway_station && (
              <p style={{ margin: '4px 0', color: '#666', fontSize: '13px' }}>
                🚇 {executor.subway_station}
              </p>
            )}
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