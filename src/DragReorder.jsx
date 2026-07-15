import { useState, useRef } from "react";

const ACCENT = "#E8442E";

// Renders a thin accent-colored line at the exact insertion point for a
// dragged row, instead of highlighting the row being hovered over.
export function InsertionLine({ drag, i }) {
  if (drag.dragIndex === null || drag.dragOverIndex !== i) return null;
  if (drag.dragIndex > i) return <div style={{ position: "absolute", left: 8, right: 8, top: -6, height: 3, borderRadius: 2, background: ACCENT }} />;
  if (drag.dragIndex < i) return <div style={{ position: "absolute", left: 8, right: 8, bottom: -6, height: 3, borderRadius: 2, background: ACCENT }} />;
  return null;
}

// Pointer-based drag reorder, works for touch and mouse alike (a single
// pointermove/pointerup listener pair rather than separate touch/mouse
// handling). Originally lived in Templates.jsx (template list + template
// exercise list); pulled out here so any other reorderable list --
// Home's Customize dashboard list included -- can use the same
// touch-and-mouse drag behavior instead of arrow buttons. Call once per
// list, at the top of the component (rules of hooks).
export function useDragReorder(setItems) {
  const rowRefs = useRef([]);
  const dragOverRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function startRowDrag(i, e) {
    e.preventDefault();
    setDragIndex(i);
    setDragOverIndex(i);
    dragOverRef.current = i;
    const onMove = (ev) => {
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      let closest = i;
      let closestDist = Infinity;
      rowRefs.current.forEach((el, idx) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(y - mid);
        if (dist < closestDist) { closestDist = dist; closest = idx; }
      });
      dragOverRef.current = closest;
      setDragOverIndex(closest);
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      const to = dragOverRef.current;
      setItems((prev) => {
        if (i === to) return prev;
        const next = [...prev];
        const [item] = next.splice(i, 1);
        next.splice(to, 0, item);
        return next;
      });
      setDragIndex(null);
      setDragOverIndex(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
  }

  return { rowRefs, dragIndex, dragOverIndex, startRowDrag };
}
