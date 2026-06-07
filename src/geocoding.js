import { supabase } from './supabase'

// Список стран, где мы работаем. Коды по ISO 3166-1 alpha-2 (lowercase).
// Чтобы добавить страну — допиши её код. Грузия — 'ge', Эстония — 'ee' и т.д.
const SUPPORTED_COUNTRIES = ['ru', 'by', 'kz', 'am', 'az', 'kg', 'tj', 'uz', 'md'];

// Таймаут-обёртка: если промис не успел за `ms` мс — отдаём `fallback`
// и не блокируем сохранение. Зависший запрос продолжит крутиться в фоне,
// но нам уже всё равно — главное, что приложение не висит.
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ОДИН запрос к Nominatim возвращает сразу и город, и код страны.
// Раньше город и страну дёргали двумя отдельными запросами и упирались
// в лимит Nominatim (1 запрос/сек) — отсюда были зависания. Теперь один.
//
// Возвращает объект { city, isSupported }:
//   city        — строка ("Москва") или null
//   isSupported — true, если страна в списке (или не определилась — пускаем)
export async function getLocationFromCoords(lat, lng) {
  if (lat == null || lng == null) return { city: null, isSupported: true };
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru&zoom=10`;
    const response = await withTimeout(fetch(url), 8000, null);
    if (!response || !response.ok) return { city: null, isSupported: true };
    const data = await response.json();
    // Nominatim возвращает разные поля в зависимости от типа места.
    // Перебираем по приоритету: город → посёлок → район → область.
    const addr = data.address || {};
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      addr.state ||
      null;
    const country = addr.country_code || null;
    // fail-open: если страна не определилась — лучше пустить, чем ложно заблокировать
    const isSupported = !country || SUPPORTED_COUNTRIES.includes(country);
    return { city, isSupported };
  } catch (err) {
    console.error("Геокодирование не удалось:", err);
    return { city: null, isSupported: true };
  }
}

// Находит ближайшую станцию метро по координатам через Overpass (OpenStreetMap).
// Overpass бывает очень медленным и может держать соединение до минуты.
// Поэтому ставим таймаут: не ответил — возвращаем null и сохраняемся без метро.
//
// timeoutMs управляет терпением:
//   - регистрация: 8000 (быстро, метро как повезёт — это ок)
//   - настройки кабинета: 20000 (ждём подольше, чтобы метро точно нашлось)
//
// Возвращает строку ("Китай-город") или null.
export async function getSubwayFromCoords(lat, lng, timeoutMs = 8000) {
  if (lat == null || lng == null) return null;
  try {
    const result = await withTimeout(
      supabase.functions.invoke('get-subway', { body: { lat, lng } }),
      timeoutMs,
      null
    );
    if (!result) return null; // таймаут — метро не дождались
    const { data, error } = result;
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
