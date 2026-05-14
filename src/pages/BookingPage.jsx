import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function BookingPage({ executor, slot, onBack, onSuccess }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedExtras, setSelectedExtras] = useState([])

  useEffect(() => {
    async function loadServices() {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('executor_id', executor.id)
        .order('is_main', { ascending: false })
      setServices(data || [])
      const main = data?.find(s => s.is_main)
      if (main) setSelectedService(main)
    }
    loadServices()
  }, [executor.id])

  function toggleExtra(service) {
    setSelectedExtras(prev =>
      prev.find(s => s.id === service.id)
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service]
    )
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
    if (!name || !phone || !address || !selectedService) {
      alert('Пожалуйста заполните все обязательные поля')
      return
    }

    setLoading(true)

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        full_name: name,
        phone: phone,
        role: 'client',
        telegram_id: 0
      }])
      .select()
      .single()

    if (userError) {
      alert('Ошибка при создании заявки')
      setLoading(false)
      return
    }

    const extrasNames = selectedExtras.map(s => s.name).join(', ')
    const fullServiceName = extrasNames
      ? `${selectedService.name} + ${extrasNames}`
      : selectedService.name

    const { error: orderError } = await supabase
      .from('orders')
      .insert([{
        client_id: user.id,
        executor_id: executor.id,
        address: address,
        comment: comment,
        cleaning_type: fullServiceName, 
        total_price: calcTotal(),
      total_duration: calcDuration(),
        scheduled_at: slot.start,
        status: 'new',
        service_type: executor.service_type
      }])

    if (orderError) {
      alert('Ошибка при создании заказа')
      setLoading(false)
      return
    }

    await supabase
      .from('slots')
      .update({ is_available: false })
      .eq('id', slot.id)

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
        <p style={{ margin: '4px 0 0', color: '#2481cc' }}>📅 {formatSlot(slot.start)}</p>
      </div>

      {/* Основная услуга */}
      <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Основная услуга</p>
      <div style={{ marginBottom: '16px' }}>
        {services.filter(s => s.is_main).map(service => (
          <div
            key={service.id}
            onClick={() => setSelectedService(service)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '8px',
              border: selectedService?.id === service.id ? '2px solid #2481cc' : '2px solid #f0f0f0',
              background: selectedService?.id === service.id ? '#f0f7ff' : 'white',
              cursor: 'pointer'
            }}
          >
            <div>
              <span>⭐ {service.name}</span>
              {service.duration && (
                <span style={{ color: '#999', fontSize: '12px', marginLeft: '8px' }}>
                  ⏱ {service.duration} мин
                </span>
              )}
            </div>
            <span style={{ color: '#2481cc', fontWeight: 'bold' }}>{service.price} руб</span>
          </div>
        ))}
      </div>

      {/* Доп услуги */}
      {services.filter(s => !s.is_main).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Дополнительно</p>
          {services.filter(s => !s.is_main).map(service => (
            <div
              key={service.id}
              onClick={() => toggleExtra(service)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                border: selectedExtras.find(s => s.id === service.id) ? '2px solid #16a34a' : '2px solid #f0f0f0',
                background: selectedExtras.find(s => s.id === service.id) ? '#f0fdf4' : 'white',
                cursor: 'pointer'
              }}
            >
              <div>
                <span>➕ {service.name}</span>
                {service.duration && (
                  <span style={{ color: '#999', fontSize: '12px', marginLeft: '8px' }}>
                    ⏱ {service.duration} мин
                  </span>
                )}
              </div>
              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>+{service.price} руб</span>
            </div>
          ))}
        </div>
      )}
      {[
        { label: 'Адрес *', value: address, setter: setAddress, placeholder: 'Улица, дом, квартира' },
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