import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { getTelegramUser } from '../telegram'
import { generateSlots } from '../utils/slotGenerator'

function BookingPage({ executor, slot, onBack, onSuccess }) {
  
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
  useEffect(() => {
    async function loadServices() {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('executor_id', executor.id)
        .order('is_main', { ascending: false })
        .order('name', { ascending: true })
      setServices(data || [])
      const main = data?.find(s => s.is_main)
      if (main) setSelectedService(main)
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
  function toggleExtra(service) {
    setSelectedExtras(prev =>
      prev.find(s => s.id === service.id)
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service]
    )
  }
  function handleServiceSelect(service) {
    setSelectedService(service)
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
    if (!name || !phone || !address || !selectedService) {
      alert('Пожалуйста заполните все обязательные поля')
      return
    }

    setLoading(true)

    // Берём данные пользователя из Telegram
    const tgUser = getTelegramUser()
    const tgId = tgUser?.telegram_id || 0

    let user = null

    // Если есть telegram_id — ищем существующего пользователя
    if (tgId) {
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .maybeSingle()
      user = existing
    }

    if (user) {
      // Пользователь уже есть — обновляем имя и телефон на свежие
      await supabase
        .from('users')
        .update({ full_name: name, phone: phone })
        .eq('id', user.id)
    } else {
      // Пользователя нет — создаём нового
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          full_name: name,
          phone: phone,
          role: 'client',
          telegram_id: tgId
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
    const extrasNames = selectedExtras.map(s => s.name).join(', ')
    const fullServiceName = extrasNames
      ? `${selectedService.name} + ${extrasNames}`
      : selectedService.name

      const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        client_id: user.id,
        executor_id: executor.id,
        address: address,
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

    await supabase
      .from('slots')
      .update({ is_available: false })
      .eq('id', selectedSlot?.id)

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
        <p style={{ margin: 0, fontWeight: 'bold' }}>{executor.users?.full_name}</p>
        {executor.rating && <p style={{ margin: '2px 0 0', color: '#f59e0b', fontSize: '13px' }}>⭐ {executor.rating}</p>}
        {fromSlot
          ? <p style={{ margin: '4px 0 0', color: '#2481cc' }}>📅 {formatSlot(slot.start)}</p>
          : <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>Выберите время ниже</p>
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
                      border: selectedSlot?.label === s.label ? '2px solid #2481cc' : '2px solid #f0f0f0',
                      background: selectedSlot?.label === s.label ? '#f0f7ff' : 'white',
                      color: selectedSlot?.label === s.label ? '#2481cc' : 'black',
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
                      border: selectedSlot?.label === s.label ? '2px solid #2481cc' : '2px solid #f0f0f0',
                      background: selectedSlot?.label === s.label ? '#f0f7ff' : 'white',
                      color: selectedSlot?.label === s.label ? '#2481cc' : 'black',
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
          <input
            type="date"
            value={pickedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => {
              setPickedDate(e.target.value)
              loadPickedDateSlots(e.target.value)
            }}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
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
                        border: selectedSlot?.label === s.label ? '2px solid #2481cc' : '2px solid #f0f0f0',
                        background: selectedSlot?.label === s.label ? '#f0f7ff' : 'white',
                        color: selectedSlot?.label === s.label ? '#2481cc' : 'black',
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