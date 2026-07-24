import { useState } from 'react'
import { supabase } from '../supabase'
import { useProfessions } from "../hooks/useProfessions.js";
import { getLocationFromCoords, getSubwayFromCoords } from "../geocoding.js";
import { getTelegramUser } from '../telegram'
import { getSession, saveSession } from '../session'
import LocationPicker from '../components/LocationPicker'
import { LEGAL_DOCS } from '../legalDocs'

function RegisterExecutorPage() {
  const { professions } = useProfessions();
  // Профиль
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [serviceType, setServiceType] = useState('cleaning')
  const [timezone, setTimezone] = useState('Europe/Moscow')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  // График
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5])

  // Первая услуга
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [serviceDuration, setServiceDuration] = useState('')
  const [serviceLocationType, setServiceLocationType] = useState('both')

  const [saving, setSaving] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [legalModal, setLegalModal] = useState(null) // 'consent' | 'terms' | 'privacy' | 'offer' | null

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
    if (latitude === '' || longitude === '') {
      alert('Поставьте точку на карте — это место, где вы принимаете клиентов или откуда выезжаете')
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

    const [startH, startM] = workStart.split(':').map(Number)
const [endH, endM] = workEnd.split(':').map(Number)
const startMinutes = startH * 60 + startM
const endMinutes = endH * 60 + endM

if (endMinutes < startMinutes) {
  alert('Время окончания раньше времени начала — мастер станет невидимым для клиентов.\n\n🌙 Работаете по ночному графику с переходом через полночь? Укажите 00:00–23:59, а нерабочие часы закройте перерывом в расписании.')
  return
}
if (endMinutes === startMinutes) {
  alert('Время начала и окончания совпадают — мастер станет невидимым для клиентов.\n\n🕐 Для круглосуточной работы укажите 00:00–23:59.')
  return
}
if (!agreedToTerms) {
  alert('Чтобы продолжить, поставьте галочку — согласие с документами обязательно.')
  return
}
setSaving(true)
    

    // 1. Создаём пользователя
    // Берём telegram_id из Telegram
    const tgUser = getTelegramUser()
    const session = getSession()
    const tgId = tgUser?.telegram_id || session?.telegram_id || null
    const tgUsername = (tgUser?.username || session?.telegram_username)
      ? (tgUser?.username || session?.telegram_username).toLowerCase()
      : null

    // Защита: на боевом сайте регистрация без Telegram-данных запрещена
    if (!tgId) {
      alert('Не удалось получить данные из Telegram. Открой приложение через ссылку в чате бота (а не в браузере) и попробуй ещё раз.')
      setSaving(false)
      return
    }

    // Не плодим: если у этого telegram_id уже есть профиль исполнителя — ведём в кабинет
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', tgId)
      .eq('role', 'executor')
      .maybeSingle()

    if (existingUser) {
      const { data: existingExec } = await supabase
        .from('executors')
        .select('id')
        .eq('user_id', existingUser.id)
        .maybeSingle()
      if (existingExec) {
        setSaving(false)
        saveSession(existingUser) // веб-сессия -> исполнитель, иначе гейт не пустит в кабинет
        alert('У вас уже есть профиль исполнителя — открываю кабинет.')
        window.location.href = '/?executor=1'
        return
      }
    }
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ 
        full_name: fullName, 
        phone: phone, 
        role: 'executor', 
        telegram_id: tgId,
        telegram_username: tgUsername
      }])
      .select()
      .single()

    if (userError) {
      alert('Ошибка создания пользователя: ' + userError.message)
      setSaving(false)
      return
    }
// Геолокация: один запрос даёт и город, и проверку страны
const loc = await getLocationFromCoords(Number(latitude), Number(longitude));
if (!loc.isSupported) {
  setSaving(false);
  alert('🌍 В этом месте мы пока не работаем\n\nПередвиньте метку на карте в Россию или страны СНГ.');
  return;
}
const city = loc.city;
const subway = await getSubwayFromCoords(Number(latitude), Number(longitude));
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
        is_visible: false,
        timezone: timezone,
        latitude: Number(latitude),
        longitude: Number(longitude),
        city: city,
        subway_station: subway
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
        location_type: serviceLocationType
      }])

    setSaving(false)

    if (serviceError) {
      alert('Ошибка создания услуги: ' + serviceError.message)
      return
    }

    saveSession(user) // веб-сессия -> исполнитель, иначе гейт не пустит в кабинет
    alert('Профиль создан! Сейчас откроется ваш кабинет.')
    window.location.href = '/?executor=1'
  }

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }
  const labelStyle = { display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }

  // ── Гард: без @username клиенты не смогут с нами связаться. Блокируем регистрацию.
  const tgUserCheck = getTelegramUser()
  const hasUsername = !!(tgUserCheck?.username || getSession()?.telegram_username)
  if (!hasUsername) {
    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <a href="/" style={{ fontSize: '14px', color: '#2481cc', textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}>
          🏠 На главную
        </a>
        <div style={{
          background: '#fff8ed',
          borderLeft: '4px solid #f5a623',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '12px'
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>
            ✋ Нужен @username в Telegram
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '14px', lineHeight: '1.5', color: '#444' }}>
            Без имени пользователя клиенты не смогут написать вам через приложение — а это главный способ связи.
          </p>
          <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 'bold', color: '#444' }}>
            Как установить (1 минута):
          </p>
          <ol style={{ margin: '0 0 12px 20px', padding: 0, fontSize: '14px', lineHeight: '1.7', color: '#444' }}>
            <li>Откройте <b>Настройки</b> Telegram</li>
            <li>Нажмите <b>Выбрать имя пользователя</b></li>
            <li>Придумайте короткое имя (например, <code style={{ background: '#fff', padding: '1px 5px', borderRadius: '4px', fontSize: '13px' }}>anna_uborka</code>)</li>
          </ol>
          <p style={{ margin: '0', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
            Имя видно только тем, кто заказал у вас услугу.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: '14px',
            background: '#2481cc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '16px'
          }}
        >
          ✅ Я установил, проверить
        </button>

        <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#888', textAlign: 'center', lineHeight: '1.4' }}>
          Если кнопка не помогла — полностью закройте Ebookee (свайпом или из меню) и откройте заново через бота.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <a href="/" style={{ fontSize: '14px', color: '#2481cc', textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}>
        🏠 На главную
      </a>
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

      <label style={labelStyle}>Точка на карте *</label>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
        Кликните по карте: место, где вы принимаете клиентов или откуда выезжаете.
      </div>
      <LocationPicker
        latitude={latitude}
        longitude={longitude}
        onChange={(lat, lng) => {
          setLatitude(lat)
          setLongitude(lng)
        }}
      />
      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', marginBottom: '12px' }}>
        {(latitude !== '' && longitude !== '')
          ? `Координаты: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
          : '⚠️ Точка ещё не поставлена'}
      </div>

      <label style={labelStyle}>Вид услуг</label>
      <select value={serviceType} onChange={e => setServiceType(e.target.value)} style={inputStyle}>
      {professions.map(p => (
  <option key={p.code} value={p.code}>{p.name}</option>
))}
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

      <label style={labelStyle}>Тип визита</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', justifyContent: 'center' }}>
        <button
          onClick={() => {
            const incall = serviceLocationType === 'incall' || serviceLocationType === 'both'
            const outcall = serviceLocationType === 'outcall' || serviceLocationType === 'both'
            const newIncall = !incall
            if (!newIncall && !outcall) return
            setServiceLocationType(newIncall && outcall ? 'both' : newIncall ? 'incall' : 'outcall')
          }}
          style={{
            padding: '5px 14px',
            fontSize: '13px',
            borderRadius: '999px',
            border: '1px solid ' + ((serviceLocationType === 'incall' || serviceLocationType === 'both') ? '#2481cc' : '#ddd'),
            background: (serviceLocationType === 'incall' || serviceLocationType === 'both') ? '#2481cc' : 'white',
            color: (serviceLocationType === 'incall' || serviceLocationType === 'both') ? 'white' : '#333',
            cursor: 'pointer',
          }}
        >
          🏠 У меня
        </button>
        <button
          onClick={() => {
            const incall = serviceLocationType === 'incall' || serviceLocationType === 'both'
            const outcall = serviceLocationType === 'outcall' || serviceLocationType === 'both'
            const newOutcall = !outcall
            if (!incall && !newOutcall) return
            setServiceLocationType(incall && newOutcall ? 'both' : newOutcall ? 'outcall' : 'incall')
          }}
          style={{
            padding: '5px 14px',
            fontSize: '13px',
            borderRadius: '999px',
            border: '1px solid ' + ((serviceLocationType === 'outcall' || serviceLocationType === 'both') ? '#2481cc' : '#ddd'),
            background: (serviceLocationType === 'outcall' || serviceLocationType === 'both') ? '#2481cc' : 'white',
            color: (serviceLocationType === 'outcall' || serviceLocationType === 'both') ? 'white' : '#333',
            cursor: 'pointer',
          }}
        >
          🚗 Выезд
        </button>
      </div>

      {/* Согласие с документами */}
      <div
        onClick={() => setAgreedToTerms(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px',
          marginTop: '20px',
          borderRadius: '8px',
          border: '2px solid ' + (agreedToTerms ? '#22c55e' : '#ef4444'),
          background: agreedToTerms ? '#f0fdf4' : '#fef2f2',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: '22px',
            height: '22px',
            minWidth: '22px',
            borderRadius: '4px',
            border: '2px solid ' + (agreedToTerms ? '#22c55e' : '#ef4444'),
            background: agreedToTerms ? '#22c55e' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px',
            marginTop: '1px',
          }}
        >
          {agreedToTerms ? '✓' : ''}
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.4', color: '#333' }}>
          Я согласен с{' '}
          <span
            onClick={(e) => { e.stopPropagation(); setLegalModal('consent') }}
            style={{ color: '#2481cc', textDecoration: 'underline' }}
          >
            обработкой персональных данных
          </span>
          ,{' '}
          <span
            onClick={(e) => { e.stopPropagation(); setLegalModal('terms') }}
            style={{ color: '#2481cc', textDecoration: 'underline' }}
          >
            условиями использования
          </span>
          ,{' '}
          <span
            onClick={(e) => { e.stopPropagation(); setLegalModal('privacy') }}
            style={{ color: '#2481cc', textDecoration: 'underline' }}
          >
            политикой конфиденциальности
          </span>
          {' '}и{' '}
          <span
            onClick={(e) => { e.stopPropagation(); setLegalModal('offer') }}
            style={{ color: '#2481cc', textDecoration: 'underline' }}
          >
            публичной офертой
          </span>
          .
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        style={{ width: '100%', padding: '14px', background: '#2481cc', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
      >
        {saving ? 'Создаём...' : 'Создать профиль'}
      </button>

      {/* Модалка с текстом документа */}
      {legalModal && (
        <div
          onClick={() => setLegalModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '85vh',
              background: 'white',
              borderRadius: '16px 16px 0 0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{LEGAL_DOCS[legalModal].title}</h3>
              <button
                onClick={() => setLegalModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto', fontSize: '13px', lineHeight: '1.5', color: '#333', whiteSpace: 'pre-wrap' }}>
              {LEGAL_DOCS[legalModal].body}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RegisterExecutorPage