import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listCourts, setBookmark } from "../api/index.js";

const CourtsContext = createContext(null);

// Edit these defaults, or wire them to real inputs later.
const DEFAULT_SEARCH = { date: "2026/10/05", timeRange: "07:00-09:00" };

export function CourtsProvider({ children }) {
  const [courts, setCourts] = useState([]);
  const [search, setSearch] = useState(DEFAULT_SEARCH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listCourts()
      .then((data) => {
        if (!cancelled) {
          setCourts(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistic update: flip the heart immediately, roll back if the API fails.
  const toggleBookmark = useCallback(
    async (courtId) => {
      const target = courts.find((c) => c.id === courtId);
      if (!target) return;
      const next = !target.bookmarked;

      const apply = (value) =>
        setCourts((prev) =>
          prev.map((c) => (c.id === courtId ? { ...c, bookmarked: value } : c))
        );

      apply(next);
      try {
        await setBookmark(courtId, next);
      } catch (err) {
        apply(!next);
        setError(err.message);
      }
    },
    [courts]
  );

  const value = { courts, search, setSearch, toggleBookmark, loading, error };

  return <CourtsContext.Provider value={value}>{children}</CourtsContext.Provider>;
}

export function useCourts() {
  const ctx = useContext(CourtsContext);
  if (!ctx) throw new Error("useCourts must be used inside <CourtsProvider>");
  return ctx;
}