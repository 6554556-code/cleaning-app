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
    // Ищем станции метро рядом через Nominatim lookup по bbox вокруг точки
    const delta = 0.007; // ~800м
    const viewbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ru&station=subway&viewbox=${viewbox}&bounded=1`;
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'ru' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.length === 0) return null;
    const name = data[0]?.display_name?.split(',')[0] || null;
    return name;
  } catch (err) {
    console.error("Поиск метро не удался:", err);
    return null;
  }
}