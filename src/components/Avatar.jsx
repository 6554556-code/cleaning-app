// Круглый аватар исполнителя: фото, если есть, иначе — инициал имени на нейтральном фоне.

// Фотографии лежат в Supabase Storage, а прямые ссылки на supabase.co в РФ режутся.
// Поэтому на проде такие ссылки на лету переводим на наш прокси (/supabase/...),
// через который уже ходят все остальные запросы к базе.
// На localhost (разработка) ничего не трогаем — там фото грузятся напрямую.
function proxied(url) {
  if (!url) return url
  if (window.location.hostname === 'localhost') return url
  return url.replace(/^https?:\/\/[a-z0-9]+\.supabase\.co/i, window.location.origin + '/supabase')
}

export default function Avatar({ url, name, size = 48 }) {
    const initial = (name || '').trim().charAt(0).toUpperCase() || '?'
    const src = proxied(url)
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        flexShrink: 0, background: '#e8eef5', display: 'flex',
        alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e0e0'
      }}>
        {src ? (
          <img src={src} alt={name || 'Фото'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#2481cc', fontWeight: 'bold', fontSize: size * 0.42 }}>{initial}</span>
        )}
      </div>
    )
  }