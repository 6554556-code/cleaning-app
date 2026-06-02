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
    const query = `[out:json];node[station=subway](around:800,${lat},${lng});out 1;`;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const node = data.elements?.[0];
    if (!node) return null;
    // Предпочитаем русское название, fallback на любое
    return node.tags?.['name:ru'] || node.tags?.['name'] || null;
  } catch (err) {
    console.error("Поиск метро не удался:", err);
    return null;
  }
}