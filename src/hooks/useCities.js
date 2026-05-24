import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

// Хук возвращает список городов, в которых есть хотя бы один видимый исполнитель.
// Сортирует по алфавиту.
export function useCities() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("executors")
      .select("city")
      .eq("is_visible", true)
      .not("city", "is", null)
      .then(({ data, error }) => {
        if (error) {
          console.error("cities error:", error);
          setLoading(false);
          return;
        }
        // Уникальные города + сортировка по алфавиту
        const unique = [...new Set((data || []).map((row) => row.city))].sort((a, b) =>
          a.localeCompare(b, "ru")
        );
        setCities(unique);
        setLoading(false);
      });
  }, []);

  return { cities, loading };
}