import { useState } from 'react'
import { LOGO_SRC, FOOTER, Y, MUTED, LINE, LINE_2 } from '../webTheme'

// Общие блоки веб-версии: логотип, подвал, базовые стили.
// Настройки (реквизиты, палитра, путь к логотипу) — в src/webTheme.js

// Логотип: картинка из public/, при ошибке загрузки — встроенная иконка.
export function BrandMark({ size = 40 }) {
  const [failed, setFailed] = useState(false)
  if (LOGO_SRC && !failed) {
    return (
      <img
        src={LOGO_SRC}
        alt="ebookee"
        onError={() => setFailed(true)}
        style={{ display: 'block', width: size, height: size, objectFit: 'contain', flex: 'none' }}
      />
    )
  }
  return (
    <span style={{ width: size, height: size, background: Y, borderRadius: size * 0.22, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24"><path d="M6 13.4c0-3.7 2.6-6.4 6.1-6.4 3.4 0 5.6 2.4 5.6 5.7 0 .6-.05 1-.13 1.5H9.1c.3 1.9 1.7 3 3.7 3 1.4 0 2.5-.5 3.4-1.4l1.8 1.9C16.6 18.6 14.8 19.4 12.6 19.4 8.8 19.4 6 16.9 6 13.4Zm3.2-1.3h5.6c-.15-1.6-1.2-2.6-2.7-2.6-1.5 0-2.6 1-2.9 2.6Z" fill="#1A1A1A"/></svg>
    </span>
  )
}

// Подвал сайта. Данные — из FOOTER выше.
export function WebFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${LINE}`, background: '#fff', marginTop: 32 }}>
      <div style={{ maxWidth: 1560, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'space-between' }}>

          <div style={{ minWidth: 260, flex: '1 1 300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <BrandMark size={32} />
              <span style={{ fontSize: 19, fontWeight: 800 }}>ebookee</span>
            </div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
              {FOOTER.company && <div>{FOOTER.company}</div>}
              {FOOTER.inn && <div>ИНН {FOOTER.inn}</div>}
              {FOOTER.ogrn && <div>ОГРНИП {FOOTER.ogrn}</div>}
              {FOOTER.address && <div>{FOOTER.address}</div>}
            </div>
          </div>

          <div style={{ minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Контакты</div>
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              {FOOTER.phone && FOOTER.phone.trim() && <div><a href={`tel:${FOOTER.phone.replace(/[^+\d]/g, '')}`} style={{ color: '#3E3E3E', textDecoration: 'none' }}>{FOOTER.phone}</a></div>}
              {FOOTER.email && <div><a href={`mailto:${FOOTER.email}`} style={{ color: '#3E3E3E', textDecoration: 'none' }}>{FOOTER.email}</a></div>}
              {FOOTER.socials?.map((sc, i) => (
                <div key={i}><a href={sc.href} target="_blank" rel="noopener noreferrer" style={{ color: '#3E3E3E', textDecoration: 'none' }}>{sc.label}</a></div>
              ))}
            </div>
          </div>

          {FOOTER.legal?.length > 0 && (
            <div style={{ minWidth: 240 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Документы</div>
              <div style={{ fontSize: 14, lineHeight: 2 }}>
                {FOOTER.legal.map((l, i) => (
                  <div key={i}><a href={l.href} style={{ color: '#3E3E3E', textDecoration: 'none' }}>{l.label}</a></div>
                ))}
              </div>
            </div>
          )}

          <div style={{ minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Исполнителям</div>
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <div><a href="?executor=1" style={{ color: '#3E3E3E', textDecoration: 'none' }}>Стать исполнителем</a></div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${LINE_2}`, marginTop: 26, paddingTop: 18, fontSize: 13, color: '#A0A0A0' }}>
          © {new Date().getFullYear()} TM ebookee. Сервис бронирования услуг. Онлайн расписание для исполнителей.
        </div>
      </div>
    </footer>
  )
}

// Снимает ограничения шаблонного #root (max-width:500px, центрирование) —
// они нужны мини-аппу, но ломают широкую вёрстку. Действует, только пока
// смонтирован веб-экран.
export function WebBaseStyles() {
  return (
    <style>{`
      #root{max-width:none !important;width:100% !important;margin:0 !important;padding:0 !important;text-align:left !important;word-break:normal !important;font-size:15px}
      body{overflow-x:auto}
      .eb-web *{overflow-wrap:normal;word-break:normal}
      .eb-role:hover{background:#EEEBE4 !important}
      .leaflet-container{border-radius:16px;font-family:inherit}
    `}</style>
  )
}
