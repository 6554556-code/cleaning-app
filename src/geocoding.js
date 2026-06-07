import { supabase } from './supabase'

// Превращает координаты в название города через Nominatim (OpenStreetMap).
// Бесплатно, без ключей. Лимит ~1 запрос в секунду — нам хватит, мы вызываем
// только при регистрации / смене адреса.
//
// Возвращает строку с городом ("Москва") или null, если не получилось.
export async function getCityFromCoords(lat, lng) {
    if (lat == null || lng == null) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru&zoom=10`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      // Nominatim возвращает разные поля в зависимости от типа места.
      // Перебираем по приоритету: город → посёлок → район → область.
      const addr = data.address || {};
      return (
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        addr.state ||
        null
      );
    } catch (err) {
      console.error("Геокодирование не удалось:", err);
      return null;
    }
  }

// Находит ближайшую станцию метро по координатам через Overpass (OpenStreetMap).
// Бесплатно, без ключей. Работает надёжно для Москвы и Питера.
// Для городов без метро вернёт null — поле subway_station просто не заполнится.
//
// Возвращает строку ("Китай-город") или null.
export async function getSubwayFromCoords(lat, lng) {
  if (lat == null || lng == null) return null;
  try {
    const { data, error } = await supabase.functions.invoke('get-subway', {
      body: { lat, lng }
    });
    if (error) {
      console.error("Поиск метро не удался:", error);
      return null;
    }
    return data?.subway || null;
  } catch (err) {
    console.error("Поиск метро не удался:", err);
    return null;
  }
}
// Список стран, где мы работаем. Коды по ISO 3166-1 alpha-2 (lowercase).
const SUPPORTED_COUNTRIES = ['ru', 'by', 'kz', 'am', 'az', 'kg', 'tj', 'uz', 'md'];

// Проверяет, что координаты находятся в поддерживаемой стране.
// На любых ошибках/неопределённости возвращает true (fail-open) —
// лучше дать сохранить, чем ложно заблокировать из-за сбоя сети.
export async function isCountrySupported(lat, lng) {
  if (lat == null || lng == null) return true;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru&zoom=3`;
    const response = await fetch(url);
    if (!response.ok) return true;
    const data = await response.json();
    const country = data.address?.country_code;
    if (!country) return true;
    return SUPPORTED_COUNTRIES.includes(country);
  } catch (err) {
    console.error("Проверка страны не удалась:", err);
    return true;
  }
}