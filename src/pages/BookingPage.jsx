import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { getTelegramUser } from '../telegram'
import { generateSlots } from '../utils/slotGenerator'
import Avatar from '../components/Avatar'
import MiniCalendar from '../components/MiniCalendar'

function BookingPage({ executor, stats, reviews, slot, onBack, onSuccess }) {
  // Автоскролл наверх при открытии страницы
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedExtras, setSelectedExtras] = useState([])
  const [locationType, setLocationType] = useState('outcall')
  const [selectedSlot, setSelectedSlot] = useState(slot || null)
  const fromSlot = !!slot
  const [todaySlots, setTodaySlots] = useState([])
  const [tomorrowSlots, setTomorrowSlots] = useState([])
  const [showAllToday, setShowAllToday] = useState(false)
  const [showAllTomorrow, setShowAllTomorrow] = useState(false)
  const [pickedDate, setPickedDate] = useState('')
  const [pickedSlots, setPickedSlots] = useState([])
  const [showAllPicked, setShowAllPicked] = useState(false)
  const [servicesExpanded, setServicesExpanded] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)
  useEffect(() => {
    async function loadServices() {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('executor_id', executor.id)
        .eq('is_archived', false)
        .order('is_main', { ascending: false })
        .order('name', { ascending: true })
      setServices(data || [])
      const main = data?.find(s => s.is_main)
      if (main) setSelectedService(main)
      if (main) {
        if (main.location_type === 'incall') setLocationType('incall')
        else setLocationType('outcall')
      }
    }
    loadServices()
  }, [executor.id])
// Загружаем заказы исполнителя и генерируем слоты
useEffect(() => {
  async function loadSlots() {
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('scheduled_at, total_duration, location_type')
      .eq('executor_id', executor.id)
      .neq('status', 'cancelled')
      .neq('is_deleted', true)

    const { data: existingBlocks } = await supabase
      .from('blocks')
      .select('start_at, duration')
      .eq('executor_id', executor.id)

    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Параметры нового заказа для расчёта слотов
    const newOrder = {
      duration: calcDuration(),
      locationType: locationType
    }

    const now = new Date()
    const todayGen = generateSlots(executor, existingOrders || [], today, newOrder, existingBlocks || [])
      .filter(s => new Date(s.start) > now)
    const tomorrowGen = generateSlots(executor, existingOrders || [], tomorrow, newOrder, existingBlocks || [])

    setTodaySlots(todayGen)
    setTomorrowSlots(tomorrowGen)
  }
  loadSlots()
}, [executor.id, selectedService, selectedExtras, locationType])
// Генерируем слоты для даты, выбранной в календарике
async function loadPickedDateSlots(dateStr) {
  if (!dateStr) {
    setPickedSlots([])
    return
  }
  const { data: existingOrders } = await supabase
    .from('orders')
    .select('scheduled_at, total_duration, location_type')
    .eq('executor_id', executor.id)
    .neq('status', 'cancelled')
    .neq('is_deleted', true)

  const { data: existingBlocks } = await supabase
    .from('blocks')
    .select('start_at, duration')
    .eq('executor_id', executor.id)

  const newOrder = {
    duration: calcDuration(),
    locationType: locationType
  }

  const pickedDay = new Date(dateStr)
  let gen = generateSlots(executor, existingOrders || [], pickedDay, newOrder, existingBlocks || [])

  // Если выбран сегодняшний день — убираем прошедшие слоты
  const now = new Date()
  if (pickedDay.toDateString() === now.toDateString()) {
    gen = gen.filter(s => new Date(s.start) > now)
  }

  setPickedSlots(gen)
  setShowAllPicked(false)
}
function toggleExtra(extra) {
  if (selectedService?.id !== extra.parent_service_id) {
    const parent = services.find(s => s.id === extra.parent_service_id)
    if (parent) handleServiceSelect(parent)
    setSelectedExtras([extra])
    return
  }
  setSelectedExtras(prev =>
    prev.find(s => s.id === extra.id)
      ? prev.filter(s => s.id !== extra.id)
      : [...prev, extra]
  )
}
  function handleServiceSelect(service) {
    setSelectedService(service)
    setSelectedExtras([])
    if (service.location_type === 'outcall') setLocationType('outcall')
    if (service.location_type === 'incall') setLocationType('incall')
  }
  function calcTotal() {
    const base = selectedService?.price || 0
    const extras = selectedExtras.reduce((sum, s) => sum + s.price, 0)
    return base + extras
  }

  function calcDuration() {
    const base = selectedService?.duration || 0
    const extras = selectedExtras.reduce((sum, s) => sum + (s.duration || 0), 0)
    return base + extras
  }
  async function handleSubmit() {
    if (!selectedSlot) {
      alert('Пожалуйста выберите время визита')
      return
    }
    if (!name || !phone || !selectedService) {
      alert('Пожалуйста заполните все обязательные поля')
      return
    }
    // Адрес нужен только для выезда (outcall)
    if (locationType === 'outcall' && !address) {
      alert('Укажите адрес — для выезда он обязателен')
      return
    }

    setLoading(true)

    // Берём данные пользователя из Telegram
    const tgUser = getTelegramUser()
    const tgId = tgUser?.telegram_id || 0
    const tgUsername = tgUser?.username ? tgUser.username.toLowerCase() : null

    let user = null

    // Ищем существующего КЛИЕНТА (берём самого раннего, не давимся на дублях)
    if (tgId) {
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .eq('role', 'client')
        .order('id', { ascending: true })
        .limit(1)
      user = existing && existing[0] ? existing[0] : null
    }

    if (user) {
      // Пользователь уже есть — НЕ трогаем его имя/телефон.
      // Эти данные принадлежат самому юзеру, а имя/телефон из формы — это данные заявки,
      // они пойдут в orders.client_name / orders.client_phone ниже.
    } else {
      // Пользователя нет — создаём нового
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          full_name: name,
          phone: phone,
          role: 'client',
          telegram_id: tgId,
          telegram_username: tgUsername
        }])
        .select()
        .single()

      if (userError) {
        alert('Ошибка при создании заявки')
        setLoading(false)
        return
      }
      user = newUser
    }

    // Проверка лимита: не больше 3 заявок со статусом "Новая"
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', user.id)
      .eq('status', 'new')
      .neq('is_deleted', true)

    if (count >= 3) {
      alert('У вас уже 3 заявки в ожидании. Дождитесь подтверждения специалистом или отмените одну из них.')
      setLoading(false)
      return
    }

    const extrasNames = selectedExtras.map(s => s.name).join(', ')
    const fullServiceName = extrasNames
      ? `${selectedService.name} + ${extrasNames}`
      : selectedService.name

      const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        client_id: user.id,
        client_name: name,
        client_phone: phone,
        executor_id: executor.id,
        address: address,
        incall_address: locationType === 'incall' ? (executor.address || '') : null,
        comment: comment,
        cleaning_type: fullServiceName,
        total_price: calcTotal(),
        total_duration: calcDuration(),
        scheduled_at: selectedSlot?.start,
        status: 'new',
        service_type: executor.service_type,
        location_type: locationType,
        source: 'booking',
      }])
      .select()
      .single()

    if (orderError) {
      alert('Ошибка при создании заказа')
      setLoading(false)
      return
    }
        
    // Создаём блоки: дорога, буфер
    const scheduledAt = new Date(selectedSlot?.start)
    const travelTime = executor.travel_time || 0
    const bufferTime = executor.buffer_time || 0
    const isOutcall = locationType === 'outcall'
    const duration = calcDuration()

    const blocksToCreate = []

    if (isOutcall && travelTime > 0) {
      const travelBefore = new Date(scheduledAt.getTime() - travelTime * 60000)
      blocksToCreate.push({
        executor_id: executor.id,
        start_at: travelBefore.toISOString(),
        duration: travelTime,
        reason: 'Дорога к клиенту',
        type: 'auto_travel',
        order_id: orderData.id
      })
    }

    const endTime = new Date(scheduledAt.getTime() + duration * 60000)

    if (isOutcall && travelTime > 0) {
      blocksToCreate.push({
        executor_id: executor.id,
        start_at: endTime.toISOString(),
        duration: travelTime,
        reason: 'Дорога обратно',
        type: 'auto_travel',
        order_id: orderData.id
      })
    }

    if (bufferTime > 0) {
      const bufferStart = isOutcall ? new Date(endTime.getTime() + travelTime * 60000) : endTime
      blocksToCreate.push({
        executor_id: executor.id,
        start_at: bufferStart.toISOString(),
        duration: bufferTime,
        reason: 'Перерыв',
        type: 'auto_buffer',
        order_id: orderData.id
      })
    }

    if (blocksToCreate.length > 0) {
      await supabase.from('blocks').insert(blocksToCreate)
    }

    setLoading(false)
    onSuccess()
  }
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
  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>

      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '16px',
          cursor: 'pointer',
          marginBottom: '16px',
          color: '#2481cc'
        }}
      >
        ← Назад
      </button>

      <h2 style={{ marginTop: 0 }}>Оформление заявки</h2>

      <div style={{
        background: '#f0f7ff',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Avatar url={executor.avatar_url} name={executor.users?.full_name} size={118} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>{executor.users?.full_name}</p>
            {executor.is_verified && <span title="Проверенный исполнитель">✅</span>}
          </div>
        </div>
        {stats && stats.count > 0 ? (
          <div style={{ marginTop: '6px' }}>
            <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '15px' }}>
              ⭐ {stats.avgRating}
            </span>
            <span style={{ color: '#666', fontSize: '13px', marginLeft: '6px' }}>
              ({stats.count} {stats.count === 1 ? 'отзыв' : stats.count < 5 ? 'отзыва' : 'отзывов'})
            </span>
            {stats.alwaysOnTime && (
              <span style={{ color: '#2ecc71', fontSize: '12px', fontWeight: 'bold', marginLeft: '8px' }}>
                ✓ Всегда вовремя
              </span>
            )}
          </div>
        ) : (
          <p style={{ margin: '4px 0 0', color: '#999', fontSize: '12px' }}>Новый исполнитель</p>
        )}
        {/* Список отзывов */}
        {reviews && reviews.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #d6e7f8', paddingTop: '10px' }}>
            {(showAllReviews ? reviews : reviews.slice(0, 1)).map(r => {
              const date = new Date(r.created_at)
              const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
              return (
                <div key={r.id} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #e8f0fa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#f59e0b', fontSize: '13px' }}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </span>
                    <span style={{ color: '#999', fontSize: '11px' }}>{monthName}</span>
                    {r.on_time === true && (
                      <span style={{ color: '#2ecc71', fontSize: '11px' }}>✓ Вовремя</span>
                    )}
                    {r.on_time === false && (
                      <span style={{ color: '#e67e22', fontSize: '11px' }}>⚠️ Опоздал</span>
                    )}
                  </div>
                  {r.comment && (
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#444' }}>{r.comment}</p>
                  )}
                </div>
              )
            })}
            {reviews.length > 1 && (
              <button
                onClick={() => setShowAllReviews(!showAllReviews)}
                style={{
                  background: 'none', border: 'none', color: '#2481cc',
                  cursor: 'pointer', fontSize: '13px', padding: '4px 0'
                }}
              >
                {showAllReviews ? '▲ Скрыть' : `▼ Показать все (${reviews.length})`}
              </button>
            )}
          </div>
        )}
        {fromSlot
          ? <p style={{ margin: '4px 0 0', color: '#2481cc' }}>📅 {formatSlot(slot.start)}</p>
          : null
        }
      </div>
{/* Выбор времени если пришёл не со слота */}
{!fromSlot && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Дата и время</p>

          {/* Сегодня */}
          <p style={{ margin: '8px 0 6px', fontSize: '13px', color: '#666' }}>Сегодня</p>
          {todaySlots.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(showAllToday ? todaySlots : todaySlots.slice(0, 3)).map(s => (
                  <button
                    key={s.start.toString()}
                    onClick={() => setSelectedSlot(s)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: selectedSlot?.start === s.start ? '2px solid #2481cc' : '2px solid #f0f0f0',
                      background: selectedSlot?.start === s.start ? '#f0f7ff' : 'white',
                      color: selectedSlot?.start === s.start ? '#2481cc' : 'black',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {todaySlots.length > 3 && (
                <button
                  onClick={() => setShowAllToday(!showAllToday)}
                  style={{ marginTop: '6px', background: 'none', border: 'none', color: '#2481cc', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  {showAllToday ? '▲ Свернуть' : `▼ Показать все (${todaySlots.length})`}
                </button>
              )}
            </>
          ) : (
            <p style={{ color: '#888', fontSize: '13px' }}>Нет слотов</p>
          )}

          {/* Завтра */}
          <p style={{ margin: '12px 0 6px', fontSize: '13px', color: '#666' }}>Завтра</p>
          {tomorrowSlots.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(showAllTomorrow ? tomorrowSlots : tomorrowSlots.slice(0, 3)).map(s => (
                  <button
                    key={s.start.toString()}
                    onClick={() => setSelectedSlot(s)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: selectedSlot?.start === s.start ? '2px solid #2481cc' : '2px solid #f0f0f0',
                      background: selectedSlot?.start === s.start ? '#f0f7ff' : 'white',
                      color: selectedSlot?.start === s.start ? '#2481cc' : 'black',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {tomorrowSlots.length > 3 && (
                <button
                  onClick={() => setShowAllTomorrow(!showAllTomorrow)}
                  style={{ marginTop: '6px', background: 'none', border: 'none', color: '#2481cc', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  {showAllTomorrow ? '▲ Свернуть' : `▼ Показать все (${tomorrowSlots.length})`}
                </button>
              )}
            </>
          ) : (
            <p style={{ color: '#888', fontSize: '13px' }}>Нет слотов</p>
          )}

          {/* Выбор другой даты */}
          <p style={{ margin: '12px 0 6px', fontSize: '13px', color: '#666' }}>Другая дата</p>
          <MiniCalendar
            value={pickedDate}
            minDate={new Date().toISOString().split('T')[0]}
            onChange={(dateStr) => {
              setPickedDate(dateStr)
              loadPickedDateSlots(dateStr)
            }}
          />

          {/* Слоты выбранной даты */}
          {pickedDate && (
            pickedSlots.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {(showAllPicked ? pickedSlots : pickedSlots.slice(0, 3)).map(s => (
                    <button
                      key={s.start.toString()}
                      onClick={() => setSelectedSlot(s)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: selectedSlot?.start === s.start ? '2px solid #2481cc' : '2px solid #f0f0f0',
                        background: selectedSlot?.start === s.start ? '#f0f7ff' : 'white',
                        color: selectedSlot?.start === s.start ? '#2481cc' : 'black',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {pickedSlots.length > 3 && (
                  <button
                    onClick={() => setShowAllPicked(!showAllPicked)}
                    style={{ marginTop: '6px', background: 'none', border: 'none', color: '#2481cc', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                  >
                    {showAllPicked ? '▲ Свернуть' : `▼ Показать все (${pickedSlots.length})`}
                  </button>
                )}
              </>
            ) : (
              <p style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>Нет слотов на этот день</p>
            )
          )}
        </div>
      )}
{/* Тип визита */}
<p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Тип визита</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'outcall', label: '🚗 Выезд' },
          { id: 'incall', label: '🏠 Приём у себя' },
        ].map(t => {
          const disabled =
            t.id === 'outcall' && selectedService?.location_type === 'incall' ||
            t.id === 'incall' && selectedService?.location_type === 'outcall'
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setLocationType(t.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                background: locationType === t.id ? '#2481cc' : '#f0f0f0',
                color: locationType === t.id ? 'white' : disabled ? '#aaa' : 'black',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: disabled ? 0.5 : 1
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
            {/* Основная услуга */}
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Основная услуга</p>
      <div style={{ marginBottom: '16px' }}>
      {(() => {
          const allMain = services.filter(s => s.is_main)
          const mainToShow = servicesExpanded ? allMain : allMain.slice(0, 3)
         
          return mainToShow.map(service => {
          const allExtras = services.filter(s => !s.is_main && s.parent_service_id === service.id)
          const extrasToShow = servicesExpanded ? allExtras : allExtras.slice(0, 2)
          return (
          <div key={service.id}>
            <div
              onClick={() => handleServiceSelect(service)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '4px',
                border: selectedService?.id === service.id ? '2px solid #2481cc' : '2px solid #f0f0f0',
                background: selectedService?.id === service.id ? '#f0f7ff' : 'white',
                cursor: 'pointer'
              }}
            >
              <span>⭐ {service.name} {service.location_type === 'outcall' ? '🚗' : service.location_type === 'incall' ? '🏠' : '🚗🏠'} · {service.duration} мин</span>
              <span style={{ color: '#2481cc', fontWeight: 'bold' }}>{service.price} руб</span>
            </div>
            {extrasToShow.map(extra => (
                <div
                  key={extra.id}
                  onClick={() => toggleExtra(extra)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px 8px 24px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    border: selectedExtras.find(s => s.id === extra.id) ? '2px solid #16a34a' : '2px solid #f0f0f0',
                    background: selectedExtras.find(s => s.id === extra.id) ? '#f0fdf4' : 'white',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <span>➕ {extra.name} {extra.duration ? `· ${extra.duration} мин` : ''}</span>
                  <span style={{ color: '#16a34a', fontWeight: 'bold' }}>+{extra.price} руб</span>
                </div>
             ))}
             </div>
             )
             })
            })()}
            {(() => {
              const allMain = services.filter(s => s.is_main)
              const hasMore = allMain.length > 3 || allMain.some(m => services.filter(s => !s.is_main && s.parent_service_id === m.id).length > 2)
              if (!hasMore) return null
              return (
                <button
                  onClick={() => setServicesExpanded(!servicesExpanded)}
                  style={{ marginTop: '4px', background: 'none', border: 'none', color: '#2481cc', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  {servicesExpanded ? '▲ Свернуть' : '▼ Показать все услуги'}
                </button>
              )
            })()}
          </div>
     
      {[
        ...(locationType === 'outcall' ? [{ label: 'Адрес *', value: address, setter: setAddress, placeholder: 'Улица, дом, квартира' }] : []),
        ...(locationType === 'incall' ? [{ label: 'Адрес исполнителя', value: executor.address || '—', setter: () => {}, placeholder: '' }] : []),
        { label: 'Комментарий', value: comment, setter: setComment, placeholder: 'Укажите важные детали: площадь, порода собаки, возраст ребёнка...' },
        { label: 'Ваше имя *', value: name, setter: setName, placeholder: 'Как вас зовут' },
        { label: 'Телефон *', value: phone, setter: setPhone, placeholder: '+7 999 123 45 67' },
      ].map(field => (
        <div key={field.label} style={{ marginBottom: '12px' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' }}>{field.label}</p>
          <input
            value={field.value}
            onChange={e => field.setter(e.target.value)}
            placeholder={field.placeholder}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      ))}

      {/* Итого */}
      <div style={{
        background: '#f0f7ff',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#666' }}>⏱ Длительность:</span>
          <span>{calcDuration()} мин</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'bold' }}>💰 Итого:</span>
          <span style={{ fontWeight: 'bold', color: '#2481cc' }}>{calcTotal()} руб</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          background: loading ? '#ccc' : '#2481cc',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          marginTop: '8px'
        }}
      >
        {loading ? 'Отправляем...' : `Подтвердить заявку · ${calcTotal()} руб`}
      </button>
    </div>
  )
}

export default BookingPage