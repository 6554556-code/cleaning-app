import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import BookingPage from './BookingPage'

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
        .select('*, users(full_name)')
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

      const executorsWithSlots = await Promise.all(data.map(async (executor) => {
        const { data: slots } = await supabase
          .from('slots')
          .select('*')
          .eq('executor_id', executor.id)
          .eq('is_available', true)
          .gte('start_time', today.toISOString())
          .lte('start_time', tomorrow.toISOString())
          .order('start_time', { ascending: true })
          .limit(3)
        return { ...executor, slots: slots || [] }
      }))

      setExecutors(executorsWithSlots)
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

  if (showBooking && selectedExecutor && selectedSlot) {
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
              <span>💰 от {executor.price} руб {executor.price_label}</span>
              <span>📦 {executor.orders_count} заказов</span>
              <span>⏱ {executor.service_duration} мин</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {executor.outcall && (
                <span style={{
                  background: '#e8f4fd',
                  color: '#2481cc',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '13px'
                }}>🚗 Выезд</span>
              )}
              {executor.incall && (
                <span style={{
                  background: '#f0fdf4',
                  color: '#16a34a',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '13px'
                }}>🏠 Приём у себя</span>
              )}
            </div>
            {executor.slots && executor.slots.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#666' }}>📅 Ближайшие слоты:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {executor.slots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => {
                        setSelectedExecutor(executor)
                        setSelectedSlot(slot)
                        setShowBooking(true)
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #2481cc',
                        background: 'white',
                        color: '#2481cc',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      {formatSlot(slot.start_time)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => {
                setSelectedExecutor(executor)
                setSelectedSlot(executor.slots[0] || null)
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