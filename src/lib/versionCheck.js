// Simple dot-separated version comparison — good enough for our own
// "1.6.2"-style versioning, no need for a full semver library.
export function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

// Every changelog entry strictly newer than `sinceVersion`, oldest first —
// so if someone skipped several releases between logins, the popup can
// show everything they missed in chronological order. Pass a falsy
// `sinceVersion` to get every entry that exists (not used for the
// automatic popup — see the "brand new user" guard in Home.jsx — but
// useful if that ever changes).
export function versionsSince(changelog, sinceVersion) {
  return Object.keys(changelog)
    .filter((v) => !sinceVersion || compareVersions(v, sinceVersion) > 0)
    .sort(compareVersions)
    .map((v) => ({ version: v, ...changelog[v] }));
}
