// Круглый аватар исполнителя: фото, если есть, иначе — инициал имени на нейтральном фоне.
export default function Avatar({ url, name, size = 48 }) {
    const initial = (name || '').trim().charAt(0).toUpperCase() || '?'
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        flexShrink: 0, background: '#e8eef5', display: 'flex',
        alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e0e0'
      }}>
        {url ? (
          <img src={url} alt={name || 'Фото'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#2481cc', fontWeight: 'bold', fontSize: size * 0.42 }}>{initial}</span>
        )}
      </div>
    )
  }