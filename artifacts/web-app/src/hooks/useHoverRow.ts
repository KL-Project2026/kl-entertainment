import { useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { HOVER_BG, HOVER_TRANSITION } from "../utils/constants";

export function useHoverRow() {
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);

  const hoverProps = useCallback(
    (id: string | number) => ({
      onMouseEnter: () => setHoveredId(id),
      onMouseLeave: () => setHoveredId(null),
    }),
    []
  );

  const rowStyle = useCallback(
    (id: string | number, base: CSSProperties = {}): CSSProperties => ({
      ...base,
      backgroundColor: hoveredId === id ? HOVER_BG : (base.backgroundColor ?? "transparent"),
      transition: HOVER_TRANSITION,
      cursor: "pointer",
    }),
    [hoveredId]
  );

  const cardStyle = useCallback(
    (id: string | number, base: CSSProperties = {}): CSSProperties => ({
      ...base,
      backgroundColor: hoveredId === id ? HOVER_BG : (base.backgroundColor ?? "#ffffff"),
      boxShadow:
        hoveredId === id
          ? "0 4px 16px rgba(209,174,56,0.2)"
          : (base.boxShadow ?? "0 1px 3px rgba(0,0,0,0.05)"),
      transform: hoveredId === id ? "translateY(-1px)" : "none",
      transition: HOVER_TRANSITION,
      cursor: "pointer",
    }),
    [hoveredId]
  );

  return { hoveredId, hoverProps, rowStyle, cardStyle };
}
