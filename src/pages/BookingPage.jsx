import { useState } from 'react'
import { supabase } from '../supabase'

function BookingPage({ executor, slot, onBack, onSuccess }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [budget, setBudget] = useState('')
  const [cleaningType, setCleaningType] = useState('standard')
  const [loading, setLoading] = useState(false)

  const cleaningTypes = [
    { id: 'standard', label: '🧹 Стандартная' },
    { id: 'general', label: '🏠 Генеральная' },
    { id: 'after_repair', label: '🔨 После ремонта' },
  ]
  async function handleSubmit() {
    if (!name || !phone || !address) {
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

    const { error: orderError } = await supabase
      .from('orders')
      .insert([{
        client_id: user.id,
        executor_id: executor.id,
        budget: budget,
        address: address,
        area: area,
        cleaning_type: cleaningType,
        scheduled_at: slot.start_time,
        status: 'new',
        service_type: 'cleaning'
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
  }function formatSlot(start) {
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
        <p style={{ margin: '4px 0 0', color: '#2481cc' }}>📅 {formatSlot(slot.start_time)}</p>
      </div><p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Тип уборки</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {cleaningTypes.map(t => (
          <button
            key={t.id}
            onClick={() => setCleaningType(t.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: cleaningType === t.id ? '#2481cc' : '#f0f0f0',
              color: cleaningType === t.id ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {[
        { label: 'Бюджет', value: budget, setter: setBudget, placeholder: 'Например: 5000 руб' },
        { label: 'Адрес *', value: address, setter: setAddress, placeholder: 'Улица, дом, квартира' },
        { label: 'Площадь', value: area, setter: setArea, placeholder: 'Например: 45 кв.м' },
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
        {loading ? 'Отправляем...' : 'Подтвердить заявку'}
      </button>
    </div>
  )
}

export default BookingPage