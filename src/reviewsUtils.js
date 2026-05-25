import { supabase } from "./supabase.js";

// Тянет отзывы для одного или нескольких исполнителей.
// Возвращает объект: { executor_id: [reviews...] }
// Для главной — передаём массив executor_id, чтобы одним запросом получить всё.
export async function loadReviewsByExecutors(executorIds) {
  if (!executorIds || executorIds.length === 0) return {};
  const { data, error } = await supabase
    .from("reviews")
    .select("id, executor_id, client_id, rating, comment, on_time, created_at")
    .in("executor_id", executorIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("reviews load error:", error);
    return {};
  }
  // Группируем по executor_id
  const byExecutor = {};
  (data || []).forEach((r) => {
    if (!byExecutor[r.executor_id]) byExecutor[r.executor_id] = [];
    byExecutor[r.executor_id].push(r);
  });
  return byExecutor;
}

// Считает агрегаты по списку отзывов одного исполнителя.
// Возвращает: { avgRating, count, onTimePercent, alwaysOnTime }
export function calculateStats(reviews) {
  if (!reviews || reviews.length === 0) {
    return { avgRating: null, count: 0, onTimePercent: null, alwaysOnTime: false };
  }
  // Средний рейтинг — округляем до одной десятой
  const sumRating = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  const avgRating = Math.round((sumRating / reviews.length) * 10) / 10;

  // Процент "не опоздал" — считаем только среди тех, кто отметил это поле
  const withOnTime = reviews.filter((r) => r.on_time !== null && r.on_time !== undefined);
  const onTimeCount = withOnTime.filter((r) => r.on_time === true).length;
  const onTimePercent = withOnTime.length > 0
    ? Math.round((onTimeCount / withOnTime.length) * 100)
    : null;

  // "Всегда вовремя" — больше 90% и минимум 3 отзыва (чтобы один отзыв не делал героем)
  const alwaysOnTime = onTimePercent !== null && onTimePercent > 90 && withOnTime.length >= 3;

  return { avgRating, count: reviews.length, onTimePercent, alwaysOnTime };
}

// Проверяет, может ли клиент оставить отзыв на этот заказ.
// Возвращает { allowed: boolean, reason: string }
export function canLeaveReview(order) {
  if (!order) return { allowed: false, reason: "Заказ не найден" };

  // Заказ должен быть подтверждён исполнителем (или дальше по статусам)
  const allowedStatuses = ["confirmed_by_executor", "awaiting_client_confirmation", "confirmed_by_client", "in_progress", "done"];
  if (!allowedStatuses.includes(order.status)) {
    return { allowed: false, reason: "Заказ ещё не подтверждён исполнителем" };
  }

  // Время заказа должно уже пройти (scheduled_at + total_duration < сейчас)
  if (!order.scheduled_at) return { allowed: false, reason: "Нет времени заказа" };
  const orderEnd = new Date(order.scheduled_at).getTime() + (order.total_duration || 60) * 60000;
  if (orderEnd > Date.now()) {
    return { allowed: false, reason: "Заказ ещё не завершён" };
  }

  // Должен быть привязан client_id (для ручных заказов нельзя)
  if (!order.client_id) {
    return { allowed: false, reason: "Отзыв доступен только по заказам через бронирование" };
  }

  return { allowed: true, reason: "" };
}