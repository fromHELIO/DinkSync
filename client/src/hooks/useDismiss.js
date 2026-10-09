import { useEffect } from "react";

// Calls onDismiss when the user clicks/taps outside `ref` or presses Escape.
export default function useDismiss(ref, onDismiss, active) {
  useEffect(() => {
    if (!active) return undefined;

    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    };
    const onKey = (event) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onDismiss, active]);
}
