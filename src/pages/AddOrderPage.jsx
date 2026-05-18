import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hasOverlap, generateSlots, findNearestSlot } from '../utils/slotGenerator'

function AddOrderPage({ executor, onBack, onSuccess }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [overlapModal, setOverlapModal] = useState(null)
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
  // Создаёт заказ и связанные блоки на заданное время
  async function createOrder(userId, fullServiceName, scheduledAt) {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        client_id: userId,
        executor_id: executor.id,
        address: address || 'Не указан',
        comment: comment,
        cleaning_type: fullServiceName,
        scheduled_at: scheduledAt.toISOString(),
        status: 'new',
        service_type: executor.service_type,
        total_price: calcTotal(),
        total_duration: calcDuration(),
        location_type: locationType,
        source: 'manual'
      }])
      .select()
      .single()

    if (orderError) {
      alert('Ошибка при создании заявки')
      setLoading(false)
      return
    }

    // Блоки: дорога до, дорога после, буфер
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
    setOverlapModal(null)
    onSuccess()
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

      // Проверяем пересечение с существующими заказами и блоками
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
  
        const overlap = hasOverlap(
          executor,
          existingOrders || [],
          existingBlocks || [],
          scheduledAt,
          calcDuration(),
          locationType
        )
    
        if (overlap) {
          // Ищем ближайшее свободное время
          const nearest = findNearestSlot(
            executor,
            existingOrders || [],
            existingBlocks || [],
            scheduledAt,
            calcDuration(),
            locationType
          )
          // Показываем модалку выбора
          setOverlapModal({ nearest, userId: user.id, scheduledAt })
      setLoading(false)
      return
        }
  
        await createOrder(user.id, fullServiceName, scheduledAt)
      }
      return (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
    
          {/* Модалка пересечения */}
          {overlapModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '340px', width: '100%' }}>
                <h3 style={{ margin: '0 0 8px' }}>⚠️ Время занято</h3>
                <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#666' }}>
                  Это время пересекается с другим заказом или перерывом.
                </p>
    
                {overlapModal.nearest ? (
                  <button
                    onClick={async () => {
                      setLoading(true)
                      const extrasNames = selectedExtras.map(s => s.name).join(', ')
                      const fullServiceName = extrasNames
                        ? `${selectedService.name} + ${extrasNames}`
                        : selectedService.name
                      await createOrder(overlapModal.userId, fullServiceName, new Date(overlapModal.nearest.start))
                    }}
                    style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', marginBottom: '8px' }}
                  >
                    ✅ Забронировать на {overlapModal.nearest.label}
                  </button>
                ) : (
                  <p style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>Свободного времени в этот день нет</p>
                )}
    
                <button
                  onClick={async () => {
                    setLoading(true)
                    const extrasNames = selectedExtras.map(s => s.name).join(', ')
                    const fullServiceName = extrasNames
                      ? `${selectedService.name} + ${extrasNames}`
                      : selectedService.name
                    await createOrder(overlapModal.userId, fullServiceName, overlapModal.scheduledAt)
                  }}
                  style={{ width: '100%', padding: '12px', background: 'white', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', marginBottom: '8px' }}
                >
                  Всё равно создать на это время
                </button>
    
                <button
                  onClick={() => setOverlapModal(null)}
                  style={{ width: '100%', padding: '12px', background: 'white', color: '#666', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
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
        {services.filter(s => s.is_main).map(service => (
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

            {/* Допы под своей основной */}
            {selectedService?.id === service.id &&
              services.filter(s => !s.is_main && s.parent_service_id === service.id).map(extra => (
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
              ))
            }
          </div>
        ))}
      </div>

      
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
        ...(locationType !== 'incall' ? [{ label: 'Адрес', value: address, setter: setAddress, placeholder: 'Улица, дом, квартира' }] : []),
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