import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

// Хук возвращает список активных профессий из таблицы professions.
// Используется в регистрации, на главной, на карте — везде, где нужны профессии.
export function useProfessions() {
  const [professions, setProfessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("professions")
      .select("code, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("professions error:", error);
        setProfessions(data || []);
        setLoading(false);
      });
  }, []);

  return { professions, loading };
}