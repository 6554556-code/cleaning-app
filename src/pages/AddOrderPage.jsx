import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function AddOrderPage({ executor, onBack, onSuccess }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedExtras, setSelectedExtras] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [locationType, setLocationType] = useState('outcall')

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
    if (!name || !phone || !selectedService || !selectedDate || !selectedTime) {
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
      alert('Ошибка при создании клиента')
      setLoading(false)
      return
    }

    const extrasNames = selectedExtras.map(s => s.name).join(', ')
    const fullServiceName = extrasNames
      ? `${selectedService.name} + ${extrasNames}`
      : selectedService.name

    const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`)

    const { error: orderError } = await supabase
      .from('orders')
      .insert([{
        client_id: user.id,
        executor_id: executor.id,
        address: address || 'Не указан',
        comment: comment,
        cleaning_type: fullServiceName,
        scheduled_at: scheduledAt.toISOString(),
        status: 'new',
        service_type: executor.service_type,
        total_price: calcTotal(),
        total_duration: calcDuration(),
        location_type: locationType
      }])

    if (orderError) {
      alert('Ошибка при создании заявки')
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
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

      <h2 style={{ marginTop: 0 }}>Новая заявка</h2>

      {/* Тип визита */}
      <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Тип визита</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'outcall', label: '🚗 Выезд' },
          { id: 'incall', label: '🏠 Приём у себя' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setLocationType(t.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: locationType === t.id ? '#2481cc' : '#f0f0f0',
              color: locationType === t.id ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Основная услуга */}
      <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Основная услуга</p>
      <div style={{ marginBottom: '16px' }}>
        {services.filter(s => s.is_main).map(service => (
          <div
            key={service.id}
            onClick={() => handleServiceSelect(service)}
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
            <span>⭐ {service.name}</span>
            <span style={{ color: '#2481cc', fontWeight: 'bold' }}>{service.price} руб</span>
          </div>
        ))}
      </div>

      {/* Доп услуги */}
      {services.filter(s => !s.is_main).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Дополнительно</p>
          {services.filter(s => !s.is_main && s.parent_service_id === selectedService?.id).map(service => (
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
              <span>➕ {service.name}</span>
              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>+{service.price} руб</span>
            </div>
          ))}
        </div>
      )}
      {/* Дата и время */}
      <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Дата и время</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '16px'
          }}
        />
        <input
          type="time"
          value={selectedTime}
          onChange={e => setSelectedTime(e.target.value)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '16px'
          }}
        />
      </div>

      {[
        { label: 'Имя клиента *', value: name, setter: setName, placeholder: 'Как зовут клиента' },
        { label: 'Телефон *', value: phone, setter: setPhone, placeholder: '+7 999 123 45 67' },
        { label: 'Адрес', value: address, setter: setAddress, placeholder: 'Улица, дом, квартира' },
        { label: 'Комментарий', value: comment, setter: setComment, placeholder: 'Важные детали...' },
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
  {locationType === 'outcall' && executor.travel_time > 0 && (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#f5a623' }}>🚗 Дорога ДО клиента:</span>
        <span style={{ color: '#f5a623' }}>+{executor.travel_time} мин</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#f5a623' }}>🚗 Дорога ПОСЛЕ заказа:</span>
        <span style={{ color: '#f5a623' }}>+{executor.travel_time} мин</span>
      </div>
    </>
  )}
  {executor.buffer_time > 0 && (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span style={{ color: '#16a34a' }}>☕ Перерыв после заказа:</span>
      <span style={{ color: '#16a34a' }}>+{executor.buffer_time} мин</span>
    </div>
  )}
 
  <div style={{
    borderTop: '1px solid #ddd',
    marginTop: '8px',
    paddingTop: '8px',
    display: 'flex',
    justifyContent: 'space-between'
  }}>
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
          fontSize: '16px'
        }}
      >
        {loading ? 'Сохраняем...' : `Добавить заявку · ${calcTotal()} руб`}
      </button>
    </div>
  )
}

export default AddOrderPage