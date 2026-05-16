import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import BookingPage from './BookingPage'
import { generateSlots } from '../utils/slotGenerator'
import { getLocationIcon } from '../utils/locationIcon'

function ClientPage() {
  const [executors, setExecutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState('cleaning')
  const [selectedExecutor, setSelectedExecutor] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [showBooking, setShowBooking] = useState(false)

  const services = [
    { id: 'cleaning', label: '🧹 Клининг' },
    { id: 'manicure', label: '💅 Маникюр' },
    { id: 'nanny', label: '👶 Няня' },
  ]

  useEffect(() => {
    async function loadExecutors() {
      setLoading(true)
      const { data, error } = await supabase
        .from('executors')
        .select('*, users(full_name), address')
        .eq('service_type', selectedService)
        .order('rating', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 2)

      const executorsWithData = await Promise.all(data.map(async (executor) => {
        // Загружаем существующие заказы исполнителя
const { data: existingOrders } = await supabase
.from('orders')
.select('*')
.eq('executor_id', executor.id)
.neq('status', 'cancelled')
.gte('scheduled_at', today.toISOString())

// Генерируем слоты на сегодня и завтра
const todaySlots = generateSlots(executor, existingOrders || [], today)
const tomorrowDate = new Date(today)
tomorrowDate.setDate(tomorrowDate.getDate() + 1)
const tomorrowSlots = generateSlots(executor, existingOrders || [], tomorrowDate)

const now = new Date()
const slots = [...todaySlots, ...tomorrowSlots]
  .filter(s => new Date(s.start) > now)
  .slice(0, 3)

        const { data: executorServices } = await supabase
          .from('services')
          .select('*')
                    .eq('executor_id', executor.id)
          .order('is_main', { ascending: false })

        return { ...executor, slots: slots || [], services: executorServices || [] }
      }))

      setExecutors(executorsWithData)
      setLoading(false)
    }
    loadExecutors()
  }, [selectedService])
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
      <h2 style={{ textAlign: 'center' }}>Выберите услугу</h2>
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
          <div key={executor.id} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{executor.users?.full_name}</h3>
              <span style={{ color: '#f5a623', fontWeight: 'bold', fontSize: '18px' }}>
                ⭐ {executor.rating}
              </span>
            </div>
            {executor.subway_station && (
              <p style={{ margin: '4px 0', color: '#666', fontSize: '13px' }}>
                🚇 {executor.subway_station}
              </p>
            )}
            <p style={{ color: '#666', margin: '8px 0', fontSize: '14px' }}>{executor.bio}</p>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px', flexWrap: 'wrap' }}>
              <span>📦 {executor.orders_count} заказов</span>
              
            </div>
            {executor.services && executor.services.length > 0 && (
  <div style={{ marginTop: '10px' }}>
    {executor.services.filter(s => s.is_main).map(mainService => (
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
        {executor.services.filter(s => !s.is_main && s.parent_service_id === mainService.id).map(extra => (
          <div key={extra.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0 4px 12px',
            fontSize: '12px',
            color: '#888'
          }}>
            <span>➕ {extra.name} {getLocationIcon(extra.location_type)} {extra.duration ? `· ${extra.duration} мин` : ''}</span>
            <span>+{extra.price} руб</span>
          </div>
        ))}
      </div>
    ))}
  </div>
)}
            
            {executor.slots && executor.slots.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#666' }}>📅 Ближайшие слоты:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {executor.slots.map(slot => (
                    <span
                      key={slot.start.toString()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #2481cc',
                        background: '#f0f7ff',
                        color: '#2481cc',
                        fontSize: '13px'
                      }}
                    >
                      {formatSlot(slot.start)}
                    </span>
                  ))}
                </div>
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