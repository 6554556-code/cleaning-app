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
      .select("id, rating, price, latitude, longitude, subway_station, bio, avatar_url, service_type, users(full_name)")
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
              <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: "bold", marginBottom: 4 }}>
  {ex.users?.full_name ?? "Исполнитель"}
</p>
                <p>⭐ {ex.rating ?? "—"}</p>
                <p>💰 {ex.price ?? "—"} ₽</p>
                <p>🚇 {ex.subway_station ?? "—"}</p>
                {ex.bio && <p style={{ color: "#666", fontSize: 12 }}>{ex.bio}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}