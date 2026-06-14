import { useState } from 'react'

// ⚠️ ЗАМЕНИ на актуальный username бота (без @)
const BOT_USERNAME = 'Ebookee777_bot'

// Конфиг — при изменении тарифов править здесь
const FREE_LEADS_LIMIT = 10
const LEAD_COST = 100

export default function BalanceBlock({ executor }) {
  const [showModal, setShowModal] = useState(false)

  const freeLeadsUsed = executor?.free_leads_used ?? 0
  const balance = Number(executor?.balance ?? 0)

  const freeRemaining = Math.max(0, FREE_LEADS_LIMIT - freeLeadsUsed)
  const hasFreeLeads = freeRemaining > 0
  const canPay = balance >= LEAD_COST

  // Сколько ещё заказов доступно: бесплатные + куплено за баланс
  const paidLeadsAvailable = Math.floor(balance / LEAD_COST)
  const totalLeadsAvailable = freeRemaining + paidLeadsAvailable

  // Состояние мини-блока рядом с кнопкой видимости
  let big, small, bg, fg
  if (totalLeadsAvailable > 0) {
    big = totalLeadsAvailable
    small = 'заказов'
    if (hasFreeLeads) {
      bg = '#fef3c7' // мягкий жёлтый — есть бесплатные
      fg = '#92400e'
    } else {
      bg = '#dbeafe' // мягкий синий — только за деньги
      fg = '#1e40af'
    }
  } else {
    big = 'Пополнить'
    small = `${balance} ₽ на счету`
    bg = '#fee2e2' // мягкий красный — пора пополнить
    fg = '#991b1b'
  }

  const handleTopup = () => {
    setShowModal(false)
    const link = `https://t.me/${BOT_USERNAME}?start=topup`
    const tg = window.Telegram?.WebApp
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(link)
      // Сворачиваем мини-апп, чтобы вернуться в чат с ботом
      tg.close()
    } else {
      window.open(link, '_blank')
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          padding: '4px 12px',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          background: bg,
          color: fg,
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
          verticalAlign: 'middle',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 700 }}>{big}</span>
        <span style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>{small}</span>
      </button>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}
          >
            <h3 style={{ margin: '0 0 14px', fontSize: '18px', textAlign: 'center' }}>
              Баланс
            </h3>

            <div style={{
              background: '#f3f4f6',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>На счету</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{balance} ₽</span>
            </div>

            <div style={{
              background: hasFreeLeads ? '#fef3c7' : '#f3f4f6',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Доступно заказов</span>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>
                {totalLeadsAvailable}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5, margin: '0 0 16px' }}>
              За каждый заказ с главной страницы списывается {LEAD_COST}&nbsp;₽.
              Первые {FREE_LEADS_LIMIT} заказов&nbsp;— бесплатно.
            </p>

            <button
              onClick={handleTopup}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: '#2481cc',
                color: 'white',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '6px',
              }}
            >
              Пополнить баланс
            </button>

            <button
              onClick={() => setShowModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: '#666',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  )
}
