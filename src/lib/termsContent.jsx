// Single source of truth for the terms text so the first-run acceptance
// gate (TermsGate.jsx) and the anytime viewer (TermsViewer.jsx, reachable
// from Settings) never drift out of sync. Bump LAST_UPDATED whenever the
// wording changes meaningfully — that's what re-triggers acceptance for
// everyone (see TermsGate/App.jsx).
export const TERMS_LAST_UPDATED = "2026-07-06";

export function TermsBody({ T }) {
  return (
    <>
      <p style={{ color: T.text, fontWeight: 700, marginTop: 0 }}>DeltaLog Terms & Conditions</p>
      <p style={{ color: T.dim, fontSize: 11, marginTop: -8 }}>Last updated {TERMS_LAST_UPDATED}</p>

      <p><strong style={{ color: T.text }}>1. Not medical or professional advice.</strong> DeltaLog is a workout tracking tool. It does not provide medical, fitness, or health advice, and nothing in the app should be treated as a substitute for guidance from a qualified physician, physical therapist, or certified trainer. Consult a medical professional before beginning any exercise program, especially if you have a pre-existing condition.</p>

      <p><strong style={{ color: T.text }}>2. Assumption of risk.</strong> Physical exercise carries inherent risk of injury. By using this app, you acknowledge that you are voluntarily participating in physical activity and assume full responsibility for any injury, loss, or damage that may result.</p>

      <p><strong style={{ color: T.text }}>3. No warranty.</strong> DeltaLog is provided "as is," without warranties of any kind, express or implied, including accuracy of calculated values such as strength scores, percentiles, plate math, or muscle coverage estimates. Always use your own judgment.</p>

      <p><strong style={{ color: T.text }}>4. Limitation of liability.</strong> To the fullest extent permitted by law, the developer of DeltaLog is not liable for any direct, indirect, incidental, or consequential damages arising from use of the app, including personal injury.</p>

      <p><strong style={{ color: T.text }}>5. Your data.</strong> Workout data, body weight, and any progress photos you upload are stored to provide the app's features and are treated as private to your account, not shared with or sold to third parties. See the Privacy Policy in Settings for full detail.</p>

      <p><strong style={{ color: T.text }}>6. Changes.</strong> These terms may be updated from time to time. Continued use of the app after a change constitutes acceptance of the updated terms.</p>
    </>
  );
}
