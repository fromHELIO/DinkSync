import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchCourtAvailability, setBookmark } from "../api/index.js";
import { todayISO } from "../utils/dateTime.js";

const CourtsContext = createContext(null);

const initialSearch = () => ({ date: todayISO(), timeRange: "15:00-17:00" });

export function CourtsProvider({ children }) {
  const [rawCourts, setRawCourts] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set());
  const [search, setSearch] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refetch availability and sync bookmarks whenever the user changes the date or time range.
  // Refetch availability and sync bookmarks whenever the user changes the date or time range.
  useEffect(() => {
    let cancelled = false; 
    setLoading(true);
    setError(null);

    fetchCourtAvailability(search.date, search.timeRange)
      .then((data) => {
        if (cancelled) return;
        setRawCourts(data);
        
        // SYNC BOOKMARKS FROM BACKEND RESPONSE
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          data.forEach((c) => {
            if (c.bookmarked) next.add(c.id);
          });
          return next;
        });
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
  }, [search.date, search.timeRange]);
  const courts = useMemo(
    () => rawCourts.map((c) => ({ ...c, bookmarked: bookmarkedIds.has(c.id) })),
    [rawCourts, bookmarkedIds]
  );

  const toggleBookmark = useCallback(
    async (courtId) => {
      const next = !bookmarkedIds.has(courtId);
      const apply = (value) =>
        setBookmarkedIds((prev) => {
          const copy = new Set(prev);
          if (value) copy.add(courtId);
          else copy.delete(courtId);
          return copy;
        });

      apply(next);
      try {
        await setBookmark(courtId, next);
      } catch (err) {
        apply(!next);
        setError(err.message);
      }
    },
    [bookmarkedIds]
  );

  const value = { courts, search, setSearch, toggleBookmark, loading, error };

  return <CourtsContext.Provider value={value}>{children}</CourtsContext.Provider>;
}

export function useCourts() {
  const ctx = useContext(CourtsContext);
  if (!ctx) throw new Error("useCourts must be used inside <CourtsProvider>");
  return ctx;
}