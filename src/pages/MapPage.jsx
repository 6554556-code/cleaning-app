import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { supabase } from "../supabase.js";
import { useProfessions } from "../hooks/useProfessions.js";
import Avatar from "../components/Avatar";
import { loadReviewsByExecutors, calculateStats } from "../reviewsUtils.js";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MOSCOW_CENTER = [55.7558, 37.6173];
// Атрибуция без флага и без «Leaflet»: оставляем только обязательное © OpenStreetMap (требование лицензии).
function AttributionNoFlag() {
  const map = useMap()
  useEffect(() => {
    map.attributionControl?.remove()
    const ctrl = L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map)
    return () => ctrl.remove()
  }, [])
  return null
}
// Возвращает иконку типа визита по списку услуг исполнителя.
// 🏠 — принимает у себя, 🚗 — выезжает, 🏠🚗 — и то и то.
function visitIcon(services) {
  const active = (services || []).filter((s) => !s.is_archived);
  const hasIncall = active.some((s) => s.location_type === "incall" || s.location_type === "both");
  const hasOutcall = active.some((s) => s.location_type === "outcall" || s.location_type === "both");
  if (hasIncall && hasOutcall) return "🏠🚗";
  if (hasIncall) return "🏠";
  if (hasOutcall) return "🚗";
  return "";
}

// Минимальная цена среди не-архивных услуг. null, если услуг нет.
function minPrice(services) {
  const prices = (services || [])
    .filter((s) => !s.is_archived && s.price != null)
    .map((s) => s.price);
  return prices.length ? Math.min(...prices) : null;
}
const filterBtnStyle = (active) => ({
  padding: "8px 14px",
  borderRadius: "8px",
  border: "none",
  background: active ? "#2481cc" : "white",
  color: active ? "white" : "#333",
  fontSize: "14px",
  fontWeight: active ? "bold" : "normal",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  flexShrink: 0,
});

export default function MapPage() {
  const [executors, setExecutors] = useState([]);
  const [selectedService, setSelectedService] = useState("all");
  const [reviewStats, setReviewStats] = useState({});
  const { professions } = useProfessions();
  const [mapCenter, setMapCenter] = useState(MOSCOW_CENTER);
  const [expandedBios, setExpandedBios] = useState([]);
  useEffect(() => {
    supabase
      .from("executors")
      .select("id, rating, price, latitude, longitude, subway_station, bio, avatar_url, service_type, is_verified, users(full_name), services(price, location_type, is_archived)")
      .eq("is_visible", true)
      .then(({ data, error }) => {
        console.log("data:", data, "error:", error);
        setExecutors(data || []);
        // Считаем статистику отзывов для всех загруженных исполнителей
        const ids = (data || []).map((e) => e.id);
        loadReviewsByExecutors(ids).then((reviewsByExec) => {
          const statsMap = {};
          ids.forEach((id) => {
            statsMap[id] = calculateStats(reviewsByExec[id] || []);
          });
          setReviewStats(statsMap);
        });
      });
  }, []);
// Запрашиваем геолокацию пользователя
useEffect(() => {
    if (!navigator.geolocation) return; // браузер не умеет — остаёмся на Москве
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Успех — центрируем на пользователе
        setMapCenter([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        // Отказ или ошибка — остаёмся на Москве
        console.log("Геолокация недоступна:", error.message);
      }
    );
  }, []);
  return (
    <div style={{ height: "100vh", position: "relative" }}>
      
      <a href="/"
        style={{
          position: "absolute", top: "12px", left: "60px", zIndex: 1000,
          background: "white", padding: "8px 14px", borderRadius: "8px",
          textDecoration: "none", color: "#2481cc", fontSize: "14px",
          fontWeight: "bold", boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
        }}
      >
        🏠 На главную
      </a>
      <div
        style={{
          position: "absolute",
          top: "56px",
          left: "60px",
          right: "12px",
          zIndex: 1000,
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          padding: "4px",
          scrollbarWidth: "none",
        }}
      >
        <button
          onClick={() => setSelectedService("all")}
          style={filterBtnStyle(selectedService === "all")}
        >
          Все
        </button>
        {professions.map((p) => (
          <button
            key={p.code}
            onClick={() => setSelectedService(p.code)}
            style={filterBtnStyle(selectedService === p.code)}
          >
            {p.icon} {p.name}
          </button>
        ))}
      </div>
      <MapContainer center={mapCenter} zoom={11} style={{ height: "100%" }} key={mapCenter.join(",")} attributionControl={false}>
        <AttributionNoFlag />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {executors
  .filter((ex) => ex.latitude != null && ex.longitude != null)
  .filter((ex) => selectedService === "all" || ex.service_type === selectedService)
  .map((ex) => (
          <Marker key={ex.id} position={[ex.latitude, ex.longitude]}>
            <Popup>
              <div style={{ minWidth: 180 }}>
              <div style={{ marginBottom: 8 }}>
  {/* Строка 1: плашка профессии + иконка визита */}
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
    {(() => {
      const prof = professions.find(p => p.code === ex.service_type)
      if (!prof) return null
      return <span style={{ display:'inline-block', padding:'2px 8px', background:'#f0f7ff', color:'#2481cc', borderRadius:'12px', fontSize:'11px' }}>{prof.icon} {prof.name}</span>
    })()}
    {visitIcon(ex.services) && (
      <span style={{ fontSize: 13 }}>{visitIcon(ex.services)}</span>
    )}
  </div>
  {/* Строка 2: аватар + имя + рейтинг */}
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <Avatar url={ex.avatar_url} name={ex.users?.full_name ?? "Исполнитель"} size={44} />
    <div>
      <p style={{ fontWeight: "bold", margin: 0, fontSize: 14 }}>
        {ex.users?.full_name ?? "Исполнитель"}
        {ex.is_verified && <span style={{ color: "#2ecc71", marginLeft: 4 }} title="Проверенный исполнитель">✓</span>}
      </p>
      {(() => {
        const stats = reviewStats[ex.id];
        if (!stats || stats.count === 0) {
          return <p style={{ margin: "2px 0", color: "#999", fontSize: 12 }}>Новый исполнитель</p>;
        }
        return (
          <div>
            <p style={{ margin: "2px 0", fontSize: 12 }}>
              ⭐ {stats.avgRating}
              <span style={{ color: "#666", fontSize: 11, marginLeft: 4 }}>
                ({stats.count} {stats.count === 1 ? 'отзыв' : stats.count < 5 ? 'отзыва' : 'отзывов'})
              </span>
            </p>
            {stats.alwaysOnTime && (
              <p style={{ margin: "2px 0", color: "#2ecc71", fontSize: 11, fontWeight: "bold" }}>✓ Всегда вовремя</p>
            )}
          </div>
        );
      })()}
    </div>
  </div>
</div>
                {minPrice(ex.services) != null && (
                  <p style={{ margin: "2px 0" }}>от {minPrice(ex.services)} ₽</p>
                )}
                {ex.bio && (() => {
                  const LIMIT = 150
                  const isOpen = expandedBios.includes(ex.id)
                  const isLong = ex.bio.length > LIMIT
                  const shown = isOpen || !isLong ? ex.bio : ex.bio.slice(0, LIMIT).trimEnd() + '…'
                  return (
                    <div
                      style={{
                        color: "#666",
                        fontSize: 12,
                        marginTop: 6,
                        whiteSpace: 'pre-wrap',
                        maxHeight: isOpen ? 180 : 'none',
                        overflowY: isOpen ? 'auto' : 'visible',
                      }}
                    >
                      {shown}
                      {isLong && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedBios(prev =>
                              isOpen ? prev.filter(id => id !== ex.id) : [...prev, ex.id]
                            )
                          }}
                          style={{ color: '#2481cc', cursor: 'pointer', marginLeft: 4 }}
                        >
                          {isOpen ? ' Свернуть ▴' : ' Развернуть ▾'}
                        </span>
                      )}
                    </div>
                  )
                })()}
                 <a
                  href={`/?executor_id=${ex.id}&book=1&from=map`}
                  style={{
                    display: "block",
                    marginTop: 10,
                    padding: "8px 12px",
                    background: "#2481cc",
                    color: "white",
                    textAlign: "center",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: 13,
                  }}
                >
                  Записаться
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}