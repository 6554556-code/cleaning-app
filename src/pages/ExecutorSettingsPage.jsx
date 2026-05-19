import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { getTelegramUser } from '../telegram'

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
  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      const tgUser = getTelegramUser()

      // Находим профиль исполнителя по telegram_id
      let exec = null

      if (tgUser?.id) {
        // Боевой вход — по telegram_id
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', tgUser.id)
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
      }
      setLoading(false)
    }
    loadProfile()
  }, [])
  async function handleSave() {
    setSaving(true)
    

    // Имя и телефон лежат в таблице users
    const { error: userError } = await supabase
      .from('users')
      .update({ full_name: fullName, phone: phone })
      .eq('id', executor.user_id)

    // Адрес лежит в таблице executors
    const { error: execError } = await supabase
      .from('executors')
      .update({
        address: address,
        work_start: workStart,
        work_end: workEnd,
        work_days: workDays.sort((a, b) => a - b).join(','),
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
      <h2 style={{ textAlign: 'center' }}>⚙️ Настройки профиля</h2>
      <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>О себе</h3>

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
    </div>
  )
}

export default ExecutorSettingsPage