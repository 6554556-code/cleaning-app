import { LEGAL_DOCS, LEGAL_ROUTES, LEGAL_UPDATED } from '../legalDocs'
import { isWeb } from '../telegram'
import { BrandMark, WebFooter, WebBaseStyles } from '../components/WebShell'
import { ROLE_BTN, Y_DARK, INK, MUTED, LINE, LINE_2, BG } from '../webTheme'

// ─────────────────────────────────────────────────────────────────
//  ПРАВОВЫЕ ДОКУМЕНТЫ
//  Один компонент на три адреса: /terms, /privacy, /offer.
//  Тексты — в src/legalDocs.js, вёрстка веба совпадает с остальным сайтом.
//  Открытое внутри Telegram — простая мобильная колонка.
// ─────────────────────────────────────────────────────────────────

const HREF_BY_KEY = Object.fromEntries(Object.entries(LEGAL_ROUTES).map(([href, key]) => [key, href]))

export default function LegalPage({ docKey }) {
  const doc = LEGAL_DOCS[docKey]
  const others = Object.values(LEGAL_ROUTES).filter(k => k !== docKey)

  // Внутри Telegram — прежняя мобильная подача, без шапки и подвала сайта
  if (!isWeb()) {
    return (
      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        <button onClick={() => { window.location.href = '/' }}
          style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', marginBottom: '16px', color: '#2481cc' }}>
          ← Назад
        </button>
        <h2 style={{ marginTop: 0 }}>{doc?.title || 'Документ не найден'}</h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#888' }}>Редакция от {LEGAL_UPDATED}</p>
        <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#333', whiteSpace: 'pre-wrap' }}>{doc?.body}</div>
      </div>
    )
  }

  return (
    <div className="eb-web" style={{ background: BG, minHeight: '100vh', color: INK, colorScheme: 'light', textAlign: 'left' }}>
      <WebBaseStyles />
      <style>{`.ebl-link:hover{text-decoration:underline}`}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', maxWidth: 1240, margin: '0 auto' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: INK, flex: 'none' }}>
            <BrandMark size={40} />
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>ebookee</span>
          </a>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
            <a href="/" className="eb-role" style={ROLE_BTN}>← На главную</a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 40px' }}>
        {!doc ? (
          <div style={{ background: '#fff', border: `1px solid ${LINE_2}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>Документ не найден</h1>
            <p style={{ color: MUTED, margin: 0 }}>Проверьте адрес страницы или вернитесь <a href="/" style={{ color: Y_DARK }}>на главную</a>.</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-.02em' }}>{doc.title}</h1>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: MUTED }}>Редакция от {LEGAL_UPDATED}</p>

            <article style={{
              background: '#fff', border: `1px solid ${LINE_2}`, borderRadius: 16, padding: '32px 36px',
              boxShadow: '0 1px 2px rgba(30,25,10,.05)', fontSize: 15, lineHeight: 1.75, color: '#2E2E2E',
              whiteSpace: 'pre-wrap',
            }}>
              {doc.body}
            </article>

            <div style={{ marginTop: 24, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {others.map(k => (
                <a key={k} href={HREF_BY_KEY[k]} className="ebl-link"
                  style={{ color: Y_DARK, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                  {LEGAL_DOCS[k].title} →
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      <WebFooter />
    </div>
  )
}
