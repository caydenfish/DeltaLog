import { IconImage } from "./Icons";

// Small square thumbnail showing the exercise's demo photo/gif. Falls
// back to a neutral stroke-only image-placeholder icon when no media has
// been set yet, so the exercise library keeps working before every entry
// has a photo. No muscle-based color coding here anymore.
export default function ExerciseThumb({ muscle, mediaUrl, size = 28 }) {
  if (mediaUrl) {
    return (
      <img
        src={mediaUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "#22262E" }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: "#22262E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8B919D",
        flexShrink: 0,
      }}
    >
      <IconImage size={Math.round(size * 0.55)} />
    </span>
  );
}
