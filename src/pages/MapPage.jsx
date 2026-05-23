import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { supabase } from "../supabase.js";
import { useProfessions } from "../hooks/useProfessions.js";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MOSCOW_CENTER = [55.7558, 37.6173];
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
  const { professions } = useProfessions();
  const [mapCenter, setMapCenter] = useState(MOSCOW_CENTER);
  useEffect(() => {
    supabase
      .from("executors")
      .select("id, rating, price, latitude, longitude, subway_station, bio, avatar_url, service_type, is_verified, users(full_name), services(price, location_type, is_archived)")
      .then(({ data, error }) => {
        console.log("data:", data, "error:", error);
        setExecutors(data || []);
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
          top: "12px",
          left: "198px",
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
<MapContainer center={mapCenter} zoom={11} style={{ height: "100%" }} key={mapCenter.join(",")}>        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {executors
  .filter((ex) => ex.latitude != null && ex.longitude != null)
  .filter((ex) => selectedService === "all" || ex.service_type === selectedService)
  .map((ex) => (
          <Marker key={ex.id} position={[ex.latitude, ex.longitude]}>
            <Popup>
              <div style={{ minWidth: 180 }}>
              <p style={{ fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>
                  {ex.users?.full_name ?? "Исполнитель"}
                  {ex.is_verified && <span style={{ color: "#2ecc71", marginLeft: 4 }} title="Проверенный исполнитель">✓</span>}
                </p>
                <p style={{ margin: "2px 0" }}>⭐ {ex.rating ?? "—"}</p>
                {visitIcon(ex.services) && (
                  <p style={{ margin: "2px 0" }}>{visitIcon(ex.services)}</p>
                )}
                {minPrice(ex.services) != null && (
                  <p style={{ margin: "2px 0" }}>от {minPrice(ex.services)} ₽</p>
                )}
                {ex.bio && <p style={{ color: "#666", fontSize: 12, marginTop: 6 }}>{ex.bio}</p>}
                 <a
                  href={`/?executor_id=${ex.id}`}
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