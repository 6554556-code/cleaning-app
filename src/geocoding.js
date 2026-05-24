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