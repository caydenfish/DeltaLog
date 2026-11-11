// Button language (v1.31.0). Every labeled action button uses the "stamped"
// treatment: Saira Condensed, uppercase, light tracking, 4px corners. The
// single main action on a key screen (start/resume/finish a workout,
// sign in) is notched instead: two cut corners echoing the logo triangle,
// label in Chakra Petch. Spread these at the END of a button's style so
// they win over anything earlier in the object.

export const BTN_RADIUS = 4;

export const BTN_TEXT = {
  fontFamily: "'Saira Condensed', sans-serif",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

// Cut top-left and bottom-right corners.
export const notch = (n = 12) =>
  `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`;

export const BTN_HERO = {
  fontFamily: "'Chakra Petch', sans-serif",
  textTransform: "uppercase",
  letterSpacing: 1,
  borderRadius: 0,
  clipPath: notch(12),
};
