import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { getCityFromCoords, getSubwayFromCoords, isCountrySupported } from "../geocoding.js";
import { getTelegramUser } from '../telegram'
import LocationPicker from '../components/LocationPicker'

function ExecutorSettingsPage() {
  const [executor, setExecutor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')
  const [workDays, setWorkDays] = useState([])
  const [bufferTime, setBufferTime] = useState(0)
  const [travelTime, setTravelTime] = useState(0)
  const [services, setServices] = useState([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [bio, setBio] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [timezone, setTimezone] = useState('Europe/Moscow')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarBlob, setAvatarBlob] = useState(null)      // ужатое фото, ждёт кнопки "Сохранить"
  const [avatarPreview, setAvatarPreview] = useState('')  // временный URL для превью
  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      const tgUser = getTelegramUser()

      // Находим профиль исполнителя по telegram_id
      let exec = null

      if (tgUser?.telegram_id) {
        // Боевой вход — по telegram_id
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', tgUser.telegram_id)
          .eq('role', 'executor')
          .maybeSingle()

          if (user) {
            const { data } = await supabase
              .from('executors')
              .select('*, users(full_name, phone)')
              .eq('user_id', user.id)
              .maybeSingle()
            exec = data
          }
      } else {
        // Запасной вход для localhost — берём исполнителя с id = 1
        const { data } = await supabase
          .from('executors')
          .select('*, users(full_name, phone)')
          .eq('id', 1)
          .maybeSingle()
        exec = data
      }

      setExecutor(exec)
      if (exec) {
        setFullName(exec.users?.full_name || '')
        setPhone(exec.users?.phone || '')
        setAddress(exec.address || '')
        setWorkStart(exec.work_start || '09:00')
        setWorkEnd(exec.work_end || '18:00')
        setWorkDays(exec.work_days ? exec.work_days.split(',').map(Number) : [])
        setBufferTime(exec.buffer_time || 0)
        setTravelTime(exec.travel_time || 0)
        setBio(exec.bio || '')
        setAvatarUrl(exec.avatar_url || '')
        setLatitude(exec.latitude ?? '')
        setLongitude(exec.longitude ?? '')
        setTimezone(exec.timezone || 'Europe/Moscow')
        // Загружаем услуги этого исполнителя
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .eq('executor_id', exec.id)
          .order('id', { ascending: true })
        setServices(servicesData || [])
      }
      setLoading(false)
    }
    loadProfile()
  }, [])
  function toggleLocation(service, which) {
    let incall = service.location_type === 'incall' || service.location_type === 'both'
    let outcall = service.location_type === 'outcall' || service.location_type === 'both'

    if (which === 'incall') incall = !incall
    if (which === 'outcall') outcall = !outcall

    let newType = null
    if (incall && outcall) newType = 'both'
    else if (incall) newType = 'incall'
    else if (outcall) newType = 'outcall'

    if (!newType) return  // нельзя выключить обе — хотя бы одна должна быть

    updateServiceField(service.id, 'location_type', newType)
  }
  function updateServiceField(serviceId, field, value) {
    setServices(services.map(s =>
      s.id === serviceId ? { ...s, [field]: value } : s
    ))
  }
  const [savingServiceId, setSavingServiceId] = useState(null)
  async function restoreService(service) {
    const { error } = await supabase
      .from('services')
      .update({ is_archived: false })
      .eq('id', service.id)

    if (error) {
      alert('Ошибка восстановления: ' + error.message)
      return
    }

    setServices(services.map(s =>
      s.id === service.id ? { ...s, is_archived: false } : s
    ))
  }
  async function deleteService(service) {
    const isMain = service.is_main
    const subs = services.filter(s => s.parent_service_id === service.id)
    const idsToArchive = isMain ? [service.id, ...subs.map(s => s.id)] : [service.id]

    let confirmText
    if (isMain && subs.length > 0) {
      confirmText = `Скрыть «${service.name || 'без названия'}» и её допы (${subs.length} шт.)? Их можно будет восстановить из архива.`
    } else {
      confirmText = `Скрыть «${service.name || 'без названия'}»? Её можно будет восстановить из архива.`
    }

    if (!confirm(confirmText)) return

    const { error } = await supabase
      .from('services')
      .update({ is_archived: true })
      .in('id', idsToArchive)

    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }

    setServices(services.map(s =>
      idsToArchive.includes(s.id) ? { ...s, is_archived: true } : s
    ))
  }
  async function addMainService() {
    
    const { data, error } = await supabase
      .from('services')
      .insert({
        executor_id: executor.id,
        parent_service_id: null,
        is_main: true,
        name: '',
        price: 0,
        duration: 60,
        location_type: 'outcall',
      })
      .select()
      .single()

    if (error) {
      alert('Не получилось добавить: ' + error.message)
      return
    }

    setServices([...services, data])
  }
  async function addSubService(main) {
    const { data, error } = await supabase
      .from('services')
      .insert({
        executor_id: executor.id,
        parent_service_id: main.id,
        is_main: false,
        name: '',
        price: 0,
        duration: 0,
        location_type: main.location_type,
      })
      .select()
      .single()

    if (error) {
      alert('Не получилось добавить: ' + error.message)
      return
    }

    // Добавляем новую услугу в список на экране
    setServices([...services, data])
  }
  async function saveServiceGroup(main) {
    setSavingServiceId(main.id)

    // Собираем основную услугу и все её допы в один список
    const group = services.filter(s => s.id === main.id || s.parent_service_id === main.id)
// Проверки перед сохранением
for (const s of group) {
    const name = (s.name || '').trim()
    const price = Number(s.price)
    const duration = Number(s.duration)

    if (!name) {
      setSavingServiceId(null)
      alert(s.is_main
        ? 'У основной услуги пустое название'
        : 'У одной из допуслуг пустое название')
      return
    }

    if (isNaN(price) || price < 0) {
      setSavingServiceId(null)
      alert(`Неверная цена у «${name}»`)
      return
    }

    if (isNaN(duration) || duration < 0) {
      setSavingServiceId(null)
      alert(`Неверная длительность у «${name}»`)
      return
    }

    // Для основной — длительность должна быть больше нуля
    if (s.is_main && duration === 0) {
      setSavingServiceId(null)
      alert(`У основной услуги «${name}» нужна длительность больше 0 минут`)
      return
    }
  }
    // Сохраняем каждую — одна за другой
    for (const s of group) {
      const { error } = await supabase
        .from('services')
        .update({
          name: s.name,
          price: Number(s.price),
          duration: Number(s.duration),
          location_type: s.location_type,
        })
        .eq('id', s.id)

      if (error) {
        setSavingServiceId(null)
        alert('Ошибка сохранения услуги: ' + error.message)
        return
      }
    }

    setSavingServiceId(null)
    alert('Услуга сохранена ✅')
  }
  // Ужимаем картинку прямо в браузере: уменьшаем до 512px по большей стороне
  // и пересохраняем в JPEG. Это убивает разом две проблемы:
  // большой размер (ошибка 413) и HEIC с айфона (нормализуем в обычный JPEG).
  function resizeImageToJpeg(file, maxSize = 512, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        let { width, height } = img
        if (width >= height && width > maxSize) {
          height = Math.round(height * (maxSize / width))
          width = maxSize
        } else if (height > maxSize) {
          width = Math.round(width * (maxSize / height))
          height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('toBlob failed')),
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('decode failed'))
      }
      img.src = objectUrl
    })
  }

  // Шаг 1 — выбор файла. Ужимаем и показываем ТОЛЬКО превью.
  // В storage и в базу ничего не пишем, пока не нажата "Сохранить фото".
  async function handleAvatarPick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // сброс, чтобы можно было выбрать тот же файл ещё раз
    if (!file) return
    try {
      const blob = await resizeImageToJpeg(file)
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarBlob(blob)
      setAvatarPreview(URL.createObjectURL(blob))
    } catch (err) {
      alert('Не удалось прочитать изображение. Выберите фото в формате JPG или PNG.')
    }
  }

  // Шаг 2 — подтверждение. Грузим ужатый JPEG в storage и пишем ссылку в профиль.
  async function handleAvatarConfirm() {
    if (!avatarBlob || !executor) return
    setUploadingAvatar(true)

    const fileName = `executor_${executor.id}_${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarBlob, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError) {
      setUploadingAvatar(false)
      const tooBig = uploadError.statusCode === '413'
        || /exceeded the maximum/i.test(uploadError.message || '')
      alert(tooBig
        ? 'Файл слишком большой. Попробуйте фото поменьше.'
        : 'Не удалось загрузить фото. Попробуйте ещё раз.')
      return
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName)
    const url = publicData?.publicUrl

    const { error: dbError } = await supabase
      .from('executors')
      .update({ avatar_url: url })
      .eq('id', executor.id)

    setUploadingAvatar(false)
    if (dbError) {
      alert('Фото загрузилось, но не сохранилось в профиль. Попробуйте ещё раз.')
      return
    }

    // Успех: фиксируем новое фото, чистим превью
    setAvatarUrl(url)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview('')
    setAvatarBlob(null)
  }

  // Отмена выбора — возвращаем старое фото, в базе ничего не трогаем.
  function handleAvatarCancel() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview('')
    setAvatarBlob(null)
  }
  async function handleSave() {
    setSaving(true)
    // Проверка: пин в поддерживаемой стране?
    if (latitude !== '' && longitude !== '') {
      const supported = await isCountrySupported(Number(latitude), Number(longitude));
      if (!supported) {
        setSaving(false);
        alert('🌍 В этом месте мы пока не работаем\n\nПередвиньте метку на карте в Россию или страны СНГ.');
        return;
      }
    }

    // Имя и телефон лежат в таблице users
    const { error: userError } = await supabase
      .from('users')
      .update({ full_name: fullName, phone: phone })
      .eq('id', executor.user_id)
// Если есть координаты — определяем город заново (вдруг пин подвинули в другой город)
const newCity = latitude !== '' && longitude !== ''
  ? await getCityFromCoords(Number(latitude), Number(longitude))
  : null;
const newSubway = latitude !== '' && longitude !== ''
  ? await getSubwayFromCoords(Number(latitude), Number(longitude))
  : null;
    // Адрес лежит в таблице executors
    const [startH, startM] = workStart.split(':').map(Number)
const [endH, endM] = workEnd.split(':').map(Number)
const startMinutes = startH * 60 + startM
const endMinutes = endH * 60 + endM

if (endMinutes < startMinutes) {
  setWorkStart(executor.work_start)
  setWorkEnd(executor.work_end)
  setSaving(false)
  alert('Время окончания раньше времени начала — мастер станет невидимым для клиентов.\n\n🌙 Работаете по ночному графику с переходом через полночь? Укажите 00:00–23:59, а нерабочие часы закройте перерывом в расписании.')
  return
}
if (endMinutes === startMinutes) {
  setWorkStart(executor.work_start)
  setWorkEnd(executor.work_end)
  setSaving(false)
  alert('Время начала и окончания совпадают — мастер станет невидимым для клиентов.\n\n🕐 Для круглосуточной работы укажите 00:00–23:59.')
  return
}
    const { error: execError } = await supabase
      .from('executors')
      .update({
        address: address,
        work_start: workStart,
        work_end: workEnd,
        work_days: workDays.sort((a, b) => a - b).join(','),
        buffer_time: Number(bufferTime) || 0,
        travel_time: Number(travelTime) || 0,
        bio: bio,
        latitude: latitude === '' ? null : Number(latitude),
        longitude: longitude === '' ? null : Number(longitude),
        timezone: timezone,
        city: newCity,
        ...(newSubway !== null && { subway_station: newSubway }),
      })
      .eq('id', executor.id)

    setSaving(false)

    if (userError || execError) {
      alert('Ошибка сохранения: ' + (userError?.message || execError?.message))
      return
    }

    alert('Сохранено ✅')
  }
  if (loading) return <p style={{ textAlign: 'center', padding: '40px' }}>Загрузка...</p>
  if (!executor) return <p style={{ textAlign: 'center', padding: '40px' }}>Профиль исполнителя не найден</p>

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
      
      <div style={{ marginBottom: '12px' }}>
        <a href="/?executor=1" style={{ fontSize: '14px', color: '#2481cc', textDecoration: 'none' }}>
          ← Назад в кабинет
        </a>
      </div>
      <h2 style={{ textAlign: 'center' }}>⚙️ Настройки профиля</h2>
      <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0 }}>О себе</h3>

{/* Аватар: круглое фото + превью с подтверждением */}
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
  <div style={{
    width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden',
    background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid #e0e0e0', marginBottom: '8px'
  }}>
    {(avatarPreview || avatarUrl) ? (
      <img src={avatarPreview || avatarUrl} alt="Фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <span style={{ fontSize: '36px', color: '#bbb' }}>📷</span>
    )}
  </div>

  {avatarPreview ? (
    // Выбрано новое фото, но ещё не сохранено — Сохранить/Отмена прямо здесь
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={handleAvatarConfirm}
        disabled={uploadingAvatar}
        style={{
          cursor: uploadingAvatar ? 'wait' : 'pointer', fontSize: '13px',
          padding: '6px 14px', borderRadius: '8px', border: 'none',
          background: '#16a34a', color: 'white'
        }}
      >
        {uploadingAvatar ? 'Сохраняю...' : '✓ Сохранить фото'}
      </button>
      <button
        onClick={handleAvatarCancel}
        disabled={uploadingAvatar}
        style={{
          cursor: 'pointer', fontSize: '13px',
          padding: '6px 14px', borderRadius: '8px',
          border: '1px solid #ddd', background: 'white', color: '#666'
        }}
      >
        Отмена
      </button>
    </div>
  ) : (
    <label style={{
      cursor: 'pointer', fontSize: '13px', color: '#2481cc',
      padding: '6px 12px', border: '1px solid #2481cc', borderRadius: '8px'
    }}>
      {avatarUrl ? 'Заменить фото' : 'Загрузить фото'}
      <input
        type="file"
        accept="image/*"
        onChange={handleAvatarPick}
        style={{ display: 'none' }}
      />
    </label>
  )}
</div>

        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>Имя</label>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>Телефон</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', boxSizing: 'border-box' }}
        />

<label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>Адрес</label>
        <input
          value={address}
          onChange={e => setAddress(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
        />

        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '8px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            color: '#2481cc',
            fontSize: '14px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {advancedOpen ? '▼' : '▶'} Подробнее
        </button>

        {advancedOpen && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>О себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Несколько слов о себе для клиентов"
              rows={3}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />

            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>Часовой пояс</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', boxSizing: 'border-box', background: 'white' }}
            >
              <option value="Europe/Kaliningrad">Калининград (МСК-1)</option>
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

            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#666' }}>
              📍 Точка на карте
            </label>
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                setLatitude(lat)
                setLongitude(lng)
              }}
            />
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              {(latitude !== '' && longitude !== '' && latitude != null && longitude != null)
                ? `Координаты: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
                : 'Кликните по карте, чтобы поставить маркер'}
            </div>
          </div>
        )}
      </div>
      <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginTop: '16px' }}>
        <h3 style={{ marginTop: 0 }}>График работы</h3>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>Начало</label>
            <input
              type="time"
              value={workStart}
              onChange={e => setWorkStart(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>Конец</label>
            <input
              type="time"
              value={workEnd}
              onChange={e => setWorkEnd(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#666' }}>Рабочие дни</label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { num: 1, label: 'Пн' },
            { num: 2, label: 'Вт' },
            { num: 3, label: 'Ср' },
            { num: 4, label: 'Чт' },
            { num: 5, label: 'Пт' },
            { num: 6, label: 'Сб' },
            { num: 7, label: 'Вс' },
          ].map(day => (
            <button
              key={day.num}
              onClick={() => {
                if (workDays.includes(day.num)) {
                  setWorkDays(workDays.filter(d => d !== day.num))
                } else {
                  setWorkDays([...workDays, day.num])
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid ' + (workDays.includes(day.num) ? '#2481cc' : '#ddd'),
                background: workDays.includes(day.num) ? '#2481cc' : 'white',
                color: workDays.includes(day.num) ? 'white' : '#333',
                cursor: 'pointer',
              }}
            >
              {day.label}
              </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginTop: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Перерывы и дорога</h3>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>
              Буфер после заказа, мин
            </label>
            <input
              type="number"
              min="0"
              value={bufferTime}
              onChange={e => setBufferTime(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Передышка между заказами
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#666' }}>
              Время на дорогу, мин
            </label>
            <input
              type="number"
              min="0"
              value={travelTime}
              onChange={e => setTravelTime(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Учитывается только для выездных заказов
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '14px',
          borderRadius: '10px',
          border: 'none',
          background: saving ? '#9ca3af' : '#2481cc',
          color: 'white',
          fontSize: '16px',
          cursor: saving ? 'default' : 'pointer',
        }}
      >
        {saving ? 'Сохраняю...' : 'Сохранить'}
      </button>
      <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginTop: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Услуги</h3>

        {services.filter(s => s.is_main && !s.is_archived).length === 0 && (
          <p style={{ color: '#666' }}>Услуг пока нет</p>
        )}

{services.filter(s => s.is_main && !s.is_archived).map((main, mainIndex) => (
          <div key={main.id} style={{ border: '1px solid #e0e0e0', borderRadius: '10px', padding: '12px', marginBottom: '12px', background: '#f7f9fc' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2481cc', textTransform: 'uppercase' }}>
                {mainIndex + 1}. Основная услуга
              </div>
              <button
                onClick={() => deleteService(main)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>
            <input
              value={main.name}
              onChange={e => updateServiceField(main.id, 'name', e.target.value)}
              placeholder="Название услуги"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontWeight: 'bold', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Цена, ₽</label>
                <input
                  type="number"
                  value={main.price}
                  onChange={e => updateServiceField(main.id, 'price', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Длительность, мин</label>
                <input
                  type="number"
                  value={main.duration}
                  onChange={e => updateServiceField(main.id, 'duration', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => toggleLocation(main, 'incall')}
                style={{
                  padding: '5px 14px',
                  fontSize: '13px',
                  borderRadius: '999px',
                  border: '1px solid ' + ((main.location_type === 'incall' || main.location_type === 'both') ? '#2481cc' : '#ddd'),
                  background: (main.location_type === 'incall' || main.location_type === 'both') ? '#2481cc' : 'white',
                  color: (main.location_type === 'incall' || main.location_type === 'both') ? 'white' : '#333',
                  cursor: 'pointer',
                }}
              >
                🏠 У меня
              </button>
              <button
                onClick={() => toggleLocation(main, 'outcall')}
                style={{
                  padding: '5px 14px',
                  fontSize: '13px',
                  borderRadius: '999px',
                  border: '1px solid ' + ((main.location_type === 'outcall' || main.location_type === 'both') ? '#2481cc' : '#ddd'),
                  background: (main.location_type === 'outcall' || main.location_type === 'both') ? '#2481cc' : 'white',
                  color: (main.location_type === 'outcall' || main.location_type === 'both') ? 'white' : '#333',
                  cursor: 'pointer',
                }}
              >
                🚗 Выезд
              </button>
            </div>
                  
            {/* Допуслуги, привязанные к этой основной */}
            {services.filter(s => s.parent_service_id === main.id && !s.is_archived).map((sub, subIndex) => (
              <div key={sub.id} style={{ marginTop: '10px', paddingLeft: '12px', borderLeft: '2px solid #ddd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase' }}>
                    Дополнительная услуга {subIndex + 1}
                  </div>
                  <button
                    onClick={() => deleteService(sub)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '0 4px',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <input
                  value={sub.name}
                  onChange={e => updateServiceField(sub.id, 'name', e.target.value)}
                  placeholder="Название допуслуги"
                  style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ddd', marginBottom: '6px', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#666' }}>Цена, ₽</label>
                    <input
                      type="number"
                      value={sub.price}
                      onChange={e => updateServiceField(sub.id, 'price', e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#666' }}>Длительность, мин</label>
                    <input
                      type="number"
                      value={sub.duration}
                      onChange={e => updateServiceField(sub.id, 'duration', e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                    />
                  </div>
                  </div>
              </div>
            ))}

            <button
              onClick={() => addSubService(main)}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '8px',
                borderRadius: '8px',
                border: '1px dashed #2481cc',
                background: 'white',
                color: '#2481cc',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              + Добавить дополнительную услугу
            </button>

            <button
              onClick={() => saveServiceGroup(main)}
            
              disabled={savingServiceId === main.id}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: savingServiceId === main.id ? '#9ca3af' : '#16a34a',
                color: 'white',
                fontSize: '14px',
                cursor: savingServiceId === main.id ? 'default' : 'pointer',
              }}
            >
              {savingServiceId === main.id ? 'Сохраняю...' : '💾 Сохранить услугу'}
            </button>
          </div>
        ))}

        <button
          onClick={addMainService}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '12px',
            borderRadius: '10px',
            border: '2px dashed #2481cc',
            background: 'white',
            color: '#2481cc',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          + Добавить основную услугу
        </button>
      </div>
      {/* Архив */}
      {services.some(s => s.is_archived) && (
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setArchiveOpen(!archiveOpen)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid #ddd',
              background: 'white',
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {archiveOpen ? '▼' : '▶'} Архив ({services.filter(s => s.is_archived).length})
          </button>

          {archiveOpen && (
            <div style={{ background: '#f3f4f6', borderRadius: '10px', padding: '12px', marginTop: '8px' }}>
              {services.filter(s => s.is_archived).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#333' }}>{s.name || 'без названия'}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {s.is_main ? 'Основная' : 'Доп'} · {s.price} ₽ · {s.duration} мин
                    </div>
                  </div>
                  <button
                    onClick={() => restoreService(s)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      border: '1px solid #2481cc',
                      background: 'white',
                      color: '#2481cc',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    ↩ Восстановить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ExecutorSettingsPage