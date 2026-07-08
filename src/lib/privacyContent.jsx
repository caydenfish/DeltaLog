// Single source of truth for the privacy policy text, shown in
// PrivacyPolicy.jsx (reachable from Settings).
//
// IMPORTANT — read before publishing: this is a plain-language draft
// based on what Cayden described about DeltaLog's actual data handling.
// It is NOT a substitute for review by an actual lawyer, especially once
// there's a real user base beyond friends/testers.
export const PRIVACY_LAST_UPDATED = "2026-07-06";

export function PrivacyBody({ T }) {
  return (
    <>
      <p style={{ color: T.text, fontWeight: 700, marginTop: 0 }}>DeltaLog Privacy Policy</p>
      <p style={{ color: T.dim, fontSize: 11, marginTop: -8 }}>Last updated {PRIVACY_LAST_UPDATED}</p>

      <p><strong style={{ color: T.text }}>What we collect.</strong> Your email address (for login), and whatever you choose to enter into the app: gender, date of birth, body weight and height, workout history (exercises, sets, weights, reps), templates, notes, and any progress photos you optionally upload.</p>

      <p><strong style={{ color: T.text }}>Where it lives.</strong> Everything is stored with Supabase (database and file storage) and served through Vercel (hosting). Our source code lives on GitHub, but GitHub never has access to your personal data — only the app's code.</p>

      <p><strong style={{ color: T.text }}>How it's used.</strong> Your data is used only to run the app for you: showing your history, computing your strength score, and generating your DOTS percentile ranking. That percentile is computed as an aggregate comparison against other users' best lifts — it never exposes any other individual user's raw numbers, identity, or data to you, and your data is never exposed to them the same way. We don't run analytics or tracking beyond what's needed to operate the app.</p>

      <p><strong style={{ color: T.text }}>Progress photos.</strong> These are private to your account. No one else, including other users, can see them.</p>

      <p><strong style={{ color: T.text }}>Sharing.</strong> We do not sell or share your data with third parties, advertisers, or data brokers. If that ever changes, this policy will be updated first.</p>

      <p><strong style={{ color: T.text }}>Your control over your data.</strong> You can delete your account and every piece of data associated with it at any time, permanently, from Settings — no need to email anyone or wait on a request. This includes your profile, workout history, templates, custom exercises, and progress photos.</p>

      <p><strong style={{ color: T.text }}>Age.</strong> DeltaLog doesn't currently restrict use by age.</p>

      <p><strong style={{ color: T.text }}>Where you are.</strong> DeltaLog is available regardless of location, with data stored and processed in Supabase's infrastructure.</p>

      <p><strong style={{ color: T.text }}>Questions or requests.</strong> Use the request form below.</p>

      <p><strong style={{ color: T.text }}>Changes.</strong> This policy may be updated as the app changes. Meaningful changes will be reflected here with an updated date.</p>
    </>
  );
}
