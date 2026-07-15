// Small, stroke-only icon set — deliberately not colored emoji, so every
// icon in the app inherits its color from CSS like any other text glyph
// and renders identically across platforms instead of however each OS
// happens to draw its emoji set. Each icon is a plain inline SVG,
// `stroke="currentColor"`, sized via the `size` prop.

const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

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
