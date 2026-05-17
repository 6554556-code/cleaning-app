import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { supabase } from "../supabase.js";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MOSCOW_CENTER = [55.7558, 37.6173];

export default function MapPage() {
  const [executors, setExecutors] = useState([]);
  const [mapCenter, setMapCenter] = useState(MOSCOW_CENTER);
  useEffect(() => {
    supabase
      .from("executors")
      .select("id, rating, price, latitude, longitude, subway_station, bio, avatar_url, users(full_name)")
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
    <div style={{ height: "100vh" }}>
<MapContainer center={mapCenter} zoom={11} style={{ height: "100%" }} key={mapCenter.join(",")}>        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {executors.filter((ex) => ex.latitude != null && ex.longitude != null).map((ex) => (
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