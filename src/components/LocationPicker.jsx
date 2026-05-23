import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Фикс иконок маркера для leaflet (та же история, что в MapPage)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const MOSCOW_CENTER = [55.7558, 37.6173]

// Внутренний компонент: слушает клик по карте и сообщает наверх
function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

// Внутренний компонент: центрирует карту при изменении координат
function Recenter({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, map.getZoom())
  }, [position])
  return null
}

export default function LocationPicker({ latitude, longitude, onChange }) {
  // Стартовая позиция: сохранённые координаты или Москва
  const hasSaved = latitude !== '' && longitude !== '' && latitude != null && longitude != null
  const initialCenter = hasSaved ? [Number(latitude), Number(longitude)] : MOSCOW_CENTER
  const [marker, setMarker] = useState(hasSaved ? initialCenter : null)

  function handlePick(coords) {
    setMarker(coords)
    onChange(coords[0], coords[1])
  }

  return (
    <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer
        center={initialCenter}
        zoom={hasSaved ? 15 : 10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='© OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={handlePick} />
        {marker && <Marker position={marker} />}
      </MapContainer>
    </div>
  )
}