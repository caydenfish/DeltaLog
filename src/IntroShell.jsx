// Shared full-screen frame for every pre-app screen (Welcome, Onboarding,
// TermsGate, SetupWizard). Why this exists: html/body/#root are locked to
// height:100% + overflow:hidden (index.html) so the main app can manage its
// own scroll regions, which meant any intro screen taller than the
// viewport -- the profile form on every iPhone, the wizard's longer steps
// on smaller ones -- was simply clipped, with its Continue button
// unreachable. This frame is its own fixed, scrollable layer, pads for the
// notch/Dynamic Island and home indicator (the viewport is viewport-fit=
// cover, so nothing else does), and centers with margin:auto instead of
// justify-content:center -- the latter pushes overflowing content above
// the top edge where it can't be scrolled back into view.
//
// `footer` renders pinned to the bottom (primary action), outside the
// scrolling content, so the main button is always reachable.
export default function IntroShell({ children, footer, maxWidth = 380, zIndex = 45, center = true }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex, background: "#101216",
        display: "flex", flexDirection: "column",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", display: "flex", flexDirection: "column" }}>
        <div style={{ width: "100%", maxWidth, margin: center ? "auto" : "0 auto", padding: "20px 20px 24px", boxSizing: "border-box", minWidth: 0 }}>
          {children}
        </div>
      </div>
      {footer && (
        <div style={{ flexShrink: 0, borderTop: "1px solid #2C313B", background: "#101216", padding: "12px 20px calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ width: "100%", maxWidth, margin: "0 auto" }}>{footer}</div>
        </div>
      )}
    </div>
  );
}
