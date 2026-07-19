const T = {
  text: "#F2F1EC",
  accent: "#E8442E",
};

// Matches the hand-built reference exactly: a tall white delta with its
// base sitting between the plates, gapped just above the bar; barbell
// plates are bigger/taller nearest the bar and shorter on the outside,
// like a real loaded barbell.
export default function Logo({ size = 40 }) {
  const height = size * 0.7;
  return (
    <svg width={size} height={height} viewBox="0 0 100 70" style={{ display: "block" }}>
      <line x1="0" y1="55" x2="100" y2="55" stroke={T.accent} strokeWidth="3" />
      <rect x="0" y="43" width="7.5" height="24" rx="1.5" fill={T.accent} />
      <rect x="8.5" y="40" width="9.5" height="30" rx="1.5" fill={T.accent} />
      <rect x="92.5" y="43" width="7.5" height="24" rx="1.5" fill={T.accent} />
      <rect x="82" y="40" width="9.5" height="30" rx="1.5" fill={T.accent} />

      <polygon points="50,0.5 79,47 21,47" fill="none" stroke={T.text} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Two-tone wordmark to pair with the icon: "Delta" in accent, "Log" in text.
export function Wordmark({ size = 26 }) {
  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: size, fontWeight: 700, letterSpacing: 0.3 }}>
      <span style={{ color: T.accent }}>Delta</span>
      <span style={{ color: T.text }}>Log</span>
    </span>
  );
}
