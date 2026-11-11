// Shared status-color logic for "My Plan" (weekly set targets per muscle
// group) -- used by both MyPlan.jsx (the sliders/progress list) and
// BodyMap.jsx (the "My Plan" body-map coloring mode), so the two always
// agree on what counts as gray/orange/green.
// v1.26.0: muted and darkened so the body map reads calmly on both
// themes; Chalk gets deeper versions since its page is light.
import { IS_LIGHT, tc } from "./theme";
export const PLAN_NEUTRAL = IS_LIGHT ? "#8E887B" : "#3A404B";
export const PLAN_ORANGE = IS_LIGHT ? "#A3561F" : "#B8652E";
export const PLAN_GREEN = IS_LIGHT ? "#2F6B4A" : "#3F8A5E";
export const PLAN_BLUE = IS_LIGHT ? "#3D5E9E" : "#4F72B5"; // over the top of a target range

// gray: nothing logged yet this week: orange: some sets in, short of
// target; green: target met or beaten. No target set (0) falls back to
// a dim neutral rather than false-green/false-orange.
// `max` (optional): the top of a target range. Over it is blue -- not a
// warning, just visibly past where extra sets pay off much.
export function statusColorFor(total, target, dimColor = tc("#8F949C"), max = null) {
  if (!target) return dimColor;
  if (total <= 0) return PLAN_NEUTRAL;
  if (total < target) return PLAN_ORANGE;
  if (max && total > max) return PLAN_BLUE;
  return PLAN_GREEN;
}
