import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";

// Модалка для оставления/редактирования отзыва.
// Пропсы:
//   order — заказ, по которому отзыв
//   existingReview — существующий отзыв (для редактирования) или null
//   onClose — закрыть модалку
//   onSaved — вызвать после успешного сохранения (родитель перезагрузит данные)
export default function ReviewModal({ order, existingReview, onClose, onSaved }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || "");
  // on_time: true / false / null (не помню)
  const [onTime, setOnTime] = useState(
    existingReview?.on_time === true ? "yes" :
    existingReview?.on_time === false ? "no" : "unknown"
  );
  const [saving, setSaving] = useState(false);

  const isEditing = !!existingReview;

  async function handleSubmit() {
    if (rating < 1 || rating > 5) {
      alert("Пожалуйста, поставь оценку от 1 до 5 звёзд");
      return;
    }
    setSaving(true);

    const onTimeValue = onTime === "yes" ? true : onTime === "no" ? false : null;

    const payload = {
      order_id: order.id,
      client_id: order.client_id,
      executor_id: order.executor_id,
      rating: rating,
      comment: comment.trim() || null,
      on_time: onTimeValue,
    };

    let error;
    if (isEditing) {
      // Редактирование — update по id отзыва
      ({ error } = await supabase.from("reviews").update(payload).eq("id", existingReview.id));
    } else {
      // Создание нового отзыва
      ({ error } = await supabase.from("reviews").insert(payload));
    }

    setSaving(false);

    if (error) {
      alert("Не удалось сохранить отзыв: " + error.message);
      return;
    }

    if (onSaved) onSaved();
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "20px",
          maxWidth: "400px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 16px 0" }}>
          {isEditing ? "Редактировать отзыв" : "Оставить отзыв"}
        </h3>

        {/* Звёзды */}
        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>Оценка</p>
          <div style={{ display: "flex", gap: "4px", fontSize: "32px", cursor: "pointer" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                onClick={() => setRating(star)}
                style={{
                  color: star <= rating ? "#ffc107" : "#ddd",
                  userSelect: "none",
                  transition: "color 0.15s",
                }}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        {/* Встреча состоялась вовремя? */}
        <div style={{ marginBottom: "16px" }}>
        <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>Встреча состоялась вовремя?</p>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { value: "yes", label: "Да" },
              { value: "no", label: "Нет" },
              { value: "unknown", label: "Не помню" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOnTime(opt.value)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  border: onTime === opt.value ? "2px solid #2481cc" : "2px solid #f0f0f0",
                  background: onTime === opt.value ? "#f0f7ff" : "white",
                  color: onTime === opt.value ? "#2481cc" : "#666",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Текст */}
        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
            Комментарий (необязательно)
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Опишите ваши впечатления..."
            style={{
              width: "100%",
              minHeight: "80px",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Кнопки */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || rating === 0}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: rating === 0 ? "#ccc" : "#2481cc",
              color: "white",
              cursor: rating === 0 ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {saving ? "Сохраняем..." : isEditing ? "Сохранить" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}