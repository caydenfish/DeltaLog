// Small, stroke-only icon set — deliberately not colored emoji, so every
// icon in the app inherits its color from CSS like any other text glyph
// and renders identically across platforms instead of however each OS
// happens to draw its emoji set. Each icon is a plain inline SVG,
// `stroke="currentColor"`, sized via the `size` prop.

const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export function IconShare({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M12 15V4" />
      <polyline points="7,8.5 12,3.5 17,8.5" />
      <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

export function IconX({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export function IconCheck({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <polyline points="4,13 9,18 20,6" />
    </svg>
  );
}

export function IconStar({ size = 16, filled = false, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base} fill={filled ? "currentColor" : "none"}>
      <polygon points="12,3 14.9,9.3 21.8,9.9 16.5,14.5 18.1,21.3 12,17.6 5.9,21.3 7.5,14.5 2.2,9.9 9.1,9.3" />
    </svg>
  );
}

export function IconMenu({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function IconGear({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.4 6.4l2.1 2.1M17.5 15.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 17.6l2.1-2.1M17.5 8.5l2.1-2.1" />
    </svg>
  );
}

export function IconBolt({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <polygon points="13,2 4,14 11,14 9,22 20,9 13,9" />
    </svg>
  );
}

export function IconLink({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M9 15l6-6" />
      <path d="M11 6l1.5-1.5a4 4 0 0 1 5.7 5.7L16.5 12" />
      <path d="M13 18l-1.5 1.5a4 4 0 0 1-5.7-5.7L7.5 12" />
    </svg>
  );
}

// Dedicated superset icon: two exercise "blocks" bracketed together with
// a joining bar, read at a glance as "these two are paired" rather than
// the generic chain-link glyph (which people mistook for a URL/hyperlink
// icon at small sizes).
export function IconSuperset({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="13" width="7" height="7" rx="1.5" />
      <path d="M10 7.5h3a2 2 0 0 1 2 2V13" />
    </svg>
  );
}

export function IconPencil({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z" />
      <line x1="13.5" y1="6.5" x2="17" y2="10" />
    </svg>
  );
}

export function IconCamera({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}

export function IconImage({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M3.5 16l5-4.5 3.5 3 3-2.5 5.5 4.5" />
    </svg>
  );
}

export function IconTrash({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M5 7h14" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function IconBell({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M6 10a6 6 0 1 1 12 0c0 3 1 5 2 6.5H4C5 15 6 13 6 10z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconPlusSquare({ size = 20, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function IconDownload({ size = 20, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M12 4v11" />
      <polyline points="7,10.5 12,15.5 17,10.5" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function IconPlus({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconArchive({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export function IconClock({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconSearch({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
    </svg>
  );
}

export function IconHome({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function IconBarbell({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="3" y1="8" x2="3" y2="16" />
      <line x1="6" y1="6" x2="6" y2="18" />
      <line x1="18" y1="6" x2="18" y2="18" />
      <line x1="21" y1="8" x2="21" y2="16" />
    </svg>
  );
}

// --- The icons below round out the set with common UI concepts the app
// had been standing in for with raw text glyphs (‹ › ▲ ▼ ⠿ etc.) --
// same stroke/size/currentColor conventions as everything above, so they
// drop in anywhere those glyphs were used and inherit color/weight from
// their surrounding button instead of being visually flat black-on-dim.

export function IconChevronLeft({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <polyline points="15,5 8,12 15,19" />
    </svg>
  );
}

export function IconChevronRight({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <polyline points="9,5 16,12 9,19" />
    </svg>
  );
}

export function IconChevronUp({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <polyline points="5,15 12,8 19,15" />
    </svg>
  );
}

export function IconChevronDown({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <polyline points="5,9 12,16 19,9" />
    </svg>
  );
}

export function IconDragHandle({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} fill="currentColor">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function IconFilter({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
    </svg>
  );
}

export function IconSort({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="4" y1="6" x2="16" y2="6" />
      <line x1="4" y1="12" x2="12" y2="12" />
      <line x1="4" y1="18" x2="8" y2="18" />
      <polyline points="17,15 20,18 20,18 20,3" />
    </svg>
  );
}

export function IconCalendar({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

export function IconUpload({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M12 16V4" />
      <polyline points="7,9 12,4 17,9" />
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

export function IconInfo({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M12 3.5 L22 20.5 L2 20.5 Z" />
      <line x1="12" y1="9.5" x2="12" y2="14.5" />
      <circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFlag({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2.5 4L16 12H5" />
    </svg>
  );
}

export function IconTarget({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconRefresh({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M4 12a8 8 0 0 1 14-5.3L21 9" />
      <polyline points="21,3 21,9 15,9" />
      <path d="M20 12a8 8 0 0 1-14 5.3L3 15" />
      <polyline points="3,21 3,15 9,15" />
    </svg>
  );
}

export function IconUndo({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M7 8H17a5 5 0 0 1 0 10H9" />
      <polyline points="10,4 7,8 10,12" />
    </svg>
  );
}

export function IconEyeOpen({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17.3 17.3 0 0 1-4 4.9M6.5 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 3.4-.6" />
      <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function IconLock({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconUnlock({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9-3" />
    </svg>
  );
}

export function IconTrophy({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H4a3 3 0 0 0 3 5" />
      <path d="M17 5h3a3 3 0 0 1-3 5" />
      <line x1="12" y1="14" x2="12" y2="18" />
      <path d="M8 21h8" />
      <path d="M9 18h6l1 3H8l1-3z" />
    </svg>
  );
}

export function IconGrid({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function IconList({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSliders({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="none" />
      <circle cx="16" cy="12" r="2" fill="none" />
      <circle cx="7" cy="18" r="2" fill="none" />
    </svg>
  );
}

export function IconChartBar({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </svg>
  );
}

export function IconChartLine({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <polyline points="3,17 9,10 13,14 21,5" />
      <polyline points="15,5 21,5 21,11" />
    </svg>
  );
}

export function IconThumbsUp({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M7 11v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3z" />
      <path d="M7 11l4-7a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.5 7A2 2 0 0 1 17.5 21H7" />
    </svg>
  );
}

export function IconMoreHorizontal({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function IconMoreVertical({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export function IconExternalLink({ size = 13, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      <polyline points="14,4 20,4 20,10" />
      <line x1="20" y1="4" x2="11" y2="13" />
    </svg>
  );
}

export function IconMail({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3,7 12,13 21,7" />
    </svg>
  );
}

export function IconFire({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...base}>
      <path d="M12 3s-5 4.5-5 9.5A5 5 0 0 0 12 21a5 5 0 0 0 5-8.5C15.5 14 14 14.5 14 13c0-1.5 1-2.5 1-4.5C15 6 12 3 12 3z" />
    </svg>
  );
}

