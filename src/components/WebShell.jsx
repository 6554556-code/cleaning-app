import { useState } from 'react'
import { LOGO_SRC, FOOTER, Y, LINE, LINE_2 } from '../webTheme'

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
// Компактный подвал. Две колонки (Документы / Контакты) со строками-ссылками,
// под ними тонкий разделитель и строка с логотипом и реквизитами.
// На узких экранах колонки сужаются, реквизиты уезжают под логотип — всё
// управляется классами в WebBaseStyles, отдельной мобильной вёрстки не нужно.
export function WebFooter() {
  const linkRow = { display: 'flex', alignItems: 'center', color: '#2E2E2E', textDecoration: 'none', fontSize: 14, padding: '7px 0' }
  const head = { fontSize: 15, fontWeight: 800, marginBottom: 6 }
  return (
    <footer style={{ borderTop: `1px solid ${LINE}`, background: '#fff', marginTop: 32 }}>
      <div className="eb-foot" style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px 22px' }}>

        <div className="eb-foot-cols" style={{ display: 'flex', gap: 64 }}>
          {FOOTER.legal?.length > 0 && (
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <div style={head}>Документы</div>
              {FOOTER.legal.map((l, i) => (
                <a key={i} href={l.href} className="eb-foot-link" style={{ ...linkRow, justifyContent: 'space-between' }}>
                  <span>{l.label}</span>
                  <span style={{ color: '#C9C4B8', flex: 'none', marginLeft: 12 }}>›</span>
                </a>
              ))}
            </div>
          )}

          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={head}>Контакты</div>
            {FOOTER.phone && FOOTER.phone.trim() && (
              <a href={`tel:${FOOTER.phone.replace(/[^+\d]/g, '')}`} className="eb-foot-link" style={{ ...linkRow, gap: 10 }}>
                <span style={{ flex: 'none', opacity: .55 }}>✆</span>{FOOTER.phone}
              </a>
            )}
            {FOOTER.email && (
              <a href={`mailto:${FOOTER.email}`} className="eb-foot-link" style={{ ...linkRow, gap: 10 }}>
                <span style={{ flex: 'none', opacity: .55 }}>✉</span>{FOOTER.email}
              </a>
            )}
            {FOOTER.socials?.map((sc, i) => (
              <a key={i} href={sc.href} target="_blank" rel="noopener noreferrer" className="eb-foot-link" style={{ ...linkRow, gap: 10 }}>
                <span style={{ flex: 'none', opacity: .55 }}>➤</span>{sc.label}
              </a>
            ))}
          </div>
        </div>

        <div className="eb-foot-req" style={{ borderTop: `1px solid ${LINE_2}`, marginTop: 20, paddingTop: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
            <BrandMark size={30} />
            <span style={{ fontSize: 19, fontWeight: 800 }}>ebookee</span>
          </div>
          <div style={{ fontSize: 12, color: '#9A958C', lineHeight: 1.6 }}>
            {[FOOTER.company, FOOTER.inn && `ИНН ${FOOTER.inn}`].filter(Boolean).join('  •  ')}
            {(FOOTER.ogrn || FOOTER.address) && <br />}
            {[FOOTER.ogrn && `ОГРНИП ${FOOTER.ogrn}`, FOOTER.address].filter(Boolean).join('  •  ')}
          </div>
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
      .eb-foot-link:hover{color:#7A5A0A !important}
      .leaflet-container{border-radius:16px;font-family:inherit}
      @media(max-width:640px){
        .eb-foot{padding:22px 14px 18px !important}
        .eb-foot-cols{gap:28px !important}
        .eb-foot-req{flex-direction:column;align-items:flex-start !important;gap:12px !important}
      }
    `}</style>
  )
}
