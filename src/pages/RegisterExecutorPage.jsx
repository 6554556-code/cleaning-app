import { useState } from 'react'
import { supabase } from '../supabase'

function RegisterExecutorPage() {
  // Профиль
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [serviceType, setServiceType] = useState('cleaning')
  const [timezone, setTimezone] = useState('Europe/Moscow')
  // График
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5])

  // Первая услуга
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [serviceDuration, setServiceDuration] = useState('')

  const [saving, setSaving] = useState(false)

  const dayLabels = [
    { num: 1, label: 'Пн' },
    { num: 2, label: 'Вт' },
    { num: 3, label: 'Ср' },
    { num: 4, label: 'Чт' },
    { num: 5, label: 'Пт' },
    { num: 6, label: 'Сб' },
    { num: 7, label: 'Вс' },
  ]

  function toggleDay(num) {
    setWorkDays(prev =>
      prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num]
    )
  }

  async function handleSubmit() {
    // Проверка обязательных полей
    if (!fullName || !phone || !address) {
      alert('Заполните имя, телефон и адрес')
      return
    }
    if (workDays.length === 0) {
      alert('Выберите хотя бы один рабочий день')
      return
    }
    if (!serviceName || !servicePrice || !serviceDuration) {
      alert('Заполните название, цену и длительность услуги')
      return
    }

    setSaving(true)

    // 1. Создаём пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ full_name: fullName, phone: phone, role: 'executor', telegram_id: 0 }])
      .select()
      .single()

    if (userError) {
      alert('Ошибка создания пользователя: ' + userError.message)
      setSaving(false)
      return
    }

    // 2. Создаём профиль исполнителя
    const { data: executor, error: execError } = await supabase
      .from('executors')
      .insert([{
        user_id: user.id,
        address: address,
        service_type: serviceType,
        work_start: workStart,
        work_end: workEnd,
        work_days: workDays.sort((a, b) => a - b).join(','),
        buffer_time: 15,
        travel_time: 30,
        rating: 0,
        is_verified: false,
        timezone: timezone
      }])
      .select()
      .single()

    if (execError) {
      alert('Ошибка создания профиля: ' + execError.message)
      setSaving(false)
      return
    }

    // 3. Создаём первую услугу
    const { error: serviceError } = await supabase
      .from('services')
      .insert([{
        executor_id: executor.id,
        name: serviceName,
        price: Number(servicePrice),
        duration: Number(serviceDuration),
        is_main: true,
        location_type: 'both'
      }])

    setSaving(false)

    if (serviceError) {
      alert('Ошибка создания услуги: ' + serviceError.message)
      return
    }

    alert('Профиль создан! Сейчас откроется ваш кабинет.')
    window.location.href = '/?executor=1'
  }

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }
  const labelStyle = { display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>Регистрация исполнителя</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '20px' }}>
        Заполните минимум — остальное добавите потом в кабинете
      </p>

      {/* Профиль */}
      <h3>1. О себе</h3>
      <label style={labelStyle}>Имя</label>
      <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} placeholder="Анна Иванова" />

      <label style={labelStyle}>Телефон</label>
      <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+7..." />

      <label style={labelStyle}>Адрес</label>
      <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} placeholder="Улица, дом" />

      <label style={labelStyle}>Вид услуг</label>
      <select value={serviceType} onChange={e => setServiceType(e.target.value)} style={inputStyle}>
        <option value="cleaning">Клининг</option>
        <option value="manicure">Маникюр</option>
        <option value="nanny">Няня</option>
      </select>
      <label style={labelStyle}>Часовой пояс</label>
      <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle}>
        <option value="Europe/Kaliningrad">Калининград (МСК−1)</option>
        <option value="Europe/Moscow">Москва (МСК)</option>
        <option value="Europe/Samara">Самара (МСК+1)</option>
        <option value="Asia/Yekaterinburg">Екатеринбург (МСК+2)</option>
        <option value="Asia/Omsk">Омск (МСК+3)</option>
        <option value="Asia/Krasnoyarsk">Красноярск (МСК+4)</option>
        <option value="Asia/Irkutsk">Иркутск (МСК+5)</option>
        <option value="Asia/Yakutsk">Якутск (МСК+6)</option>
        <option value="Asia/Vladivostok">Владивосток (МСК+7)</option>
        <option value="Asia/Magadan">Магадан (МСК+8)</option>
        <option value="Asia/Kamchatka">Камчатка (МСК+9)</option>
      </select>
      {/* График */}
      <h3>2. График работы</h3>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Начало</label>
          <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Конец</label>
          <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <label style={labelStyle}>Рабочие дни</label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {dayLabels.map(d => (
          <button
            key={d.num}
            onClick={() => toggleDay(d.num)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: workDays.includes(d.num) ? '2px solid #2481cc' : '2px solid #f0f0f0',
              background: workDays.includes(d.num) ? '#f0f7ff' : 'white',
              color: workDays.includes(d.num) ? '#2481cc' : '#888',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Услуга */}
      <h3>3. Первая услуга</h3>
      <label style={labelStyle}>Название</label>
      <input value={serviceName} onChange={e => setServiceName(e.target.value)} style={inputStyle} placeholder="Уборка квартиры" />

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Цена, ₽</label>
          <input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} style={inputStyle} placeholder="3000" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Длительность, мин</label>
          <input type="number" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)} style={inputStyle} placeholder="120" />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        style={{ width: '100%', padding: '14px', background: '#2481cc', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
      >
        {saving ? 'Создаём...' : 'Создать профиль'}
      </button>
    </div>
  )
}

export default RegisterExecutorPage