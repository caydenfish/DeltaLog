import { useState, useEffect } from "react";
import { fetchExercises } from "./lib/queries";
import { getSplits } from "./lib/splits";
import { muscleLabel, scientificNameOf, getMuscleTaxonomyEntries } from "./lib/muscleNomenclature";
import { InlineLoading } from "./LoadingSpinner";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// Builds the per-split muscle breakdown from the actual exercise library
// rather than the full taxonomy table wholesale. Two reasons: (1) the
// taxonomy table's generic_group is the only correctly-current mapping
// (bucket names embedded directly in SPLITS/MUSCLE_COLORS have been the
// source of drift before), and (2) restricting to primary-muscle tags
// only keeps the list to what someone would actually call a "primary
// muscle" for that split -- pulling in secondary/stabilizer tags (e.g.
// Serratus Anterior, Rotator Cuff) would pad every split with muscles
// nobody thinks of as the target.
function SplitBreakdown() {
  const [perSplit, setPerSplit] = useState(null); // null = still loading

  useEffect(() => {
    let cancelled = false;
    fetchExercises()
      .then((lib) => {
        if (cancelled) return;
        const taxonomy = getMuscleTaxonomyEntries();
        const byScientific = new Map(taxonomy.map((e) => [e.scientific, e]));
        const primaryOnly = new Map(); // scientific name -> {generic, detailed, scientific}
        for (const ex of lib) {
          for (const raw of ex.rawPrimaryMuscles || []) {
            const sci = scientificNameOf(raw);
            const entry = byScientific.get(sci);
            if (entry && !primaryOnly.has(sci)) primaryOnly.set(sci, entry);
          }
        }
        const result = {};
        for (const [name, buckets] of Object.entries(getSplits())) {
          result[name] = [...primaryOnly.values()]
            .filter((e) => buckets.includes(e.generic))
            .sort((a, b) => a.detailed.localeCompare(b.detailed));
        }
        setPerSplit(result);
      })
      .catch(() => { if (!cancelled) setPerSplit({}); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        How your weekly training is divided by muscle group or movement pattern. These are the same splits available as quick filters when picking exercises — tap Filters in any exercise picker to jump straight to one. Only muscles the exercise library tags as a primary target somewhere in that split are listed; a muscle can appear under more than one split (e.g. Shoulders under both Push and Pull) when it's a primary target on both sides.
      </div>
      {!perSplit && <InlineLoading size={16} padding="0" />}
      {perSplit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(perSplit).map(([name, entries]) => (
            <div key={name} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10 }}>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{name}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {entries.length === 0 && <span style={{ fontSize: 11, color: T.dim }}>No primary-muscle data yet.</span>}
                {entries.map((e) => (
                  <span key={e.scientific} style={{ fontSize: 11, fontWeight: 600, color: T.text, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 9px" }}>{muscleLabel(e.scientific)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Grouped so beginners can scan by category instead of one long list.
// Keep entries short — this is a quick-reference, not a textbook.
const SECTIONS = [
  {
    title: "Training Concepts",
    items: [
      {
        term: "RIR (Reps in Reserve)",
        body: "How many more reps you could have done before failure. RIR 2 means you stopped with 2 good reps left in the tank. Most working sets in DeltaLog target RIR 1–3.",
      },
      {
        term: "RPE (Rate of Perceived Exertion)",
        body: "A 1–10 scale for how hard a set felt, with 10 being max effort. RPE and RIR describe the same idea from opposite directions — RPE 9 is roughly the same as RIR 1.",
      },
      {
        term: "Progressive Overload",
        body: "Gradually increasing the demand on your muscles over time — more weight, more reps, more sets, or better form — so they're forced to keep adapting. It's the core driver of long-term strength and muscle gain.",
      },
      {
        term: "Hypertrophy",
        body: "Muscle growth in size. Hypertrophy training typically uses moderate weight, higher reps (roughly 6–20), and stops a couple reps shy of failure.",
      },
      {
        term: "Volume",
        body: "The total amount of work done for a muscle, usually counted in hard sets per week. More volume generally drives more growth, up to a point where recovery becomes the limit.",
      },
      {
        term: "Failure",
        body: "The point in a set where you physically cannot complete another rep with good form. Training to failure isn't required every set — it's one tool, not the only one.",
      },
      {
        term: "Deload",
        body: "A planned week of reduced volume or intensity that lets your body recover before fatigue starts hurting performance. Usually done every 4–8 weeks of hard training.",
      },
      {
        term: "Mind-Muscle Connection",
        body: "Deliberately focusing on the target muscle while it works, rather than just moving the weight. Can improve how well a muscle is activated during a lift.",
      },
    ],
  },
  {
    title: "Movement & Programming",
    items: [
      {
        term: "Compound Exercise",
        body: "A movement that works multiple joints and muscle groups at once, like a squat or bench press. Efficient for building overall strength.",
      },
      {
        term: "Isolation Exercise",
        body: "A movement that targets one joint and mostly one muscle, like a bicep curl or leg extension. Useful for bringing up a specific muscle.",
      },
      {
        term: "Superset",
        body: "Two exercises performed back-to-back with no rest in between, then rested as a pair. Saves time and can add extra fatigue to a muscle group.",
      },
      {
        term: "Working Set",
        body: "A set that's hard enough to count toward your training goal, as opposed to a warm-up set. Warm-ups don't count toward volume.",
      },
      {
        term: "Split",
        body: <SplitBreakdown />,
        // A function, not a plain string: SECTIONS is a module-level
        // constant evaluated once at import time, before the splits
        // cache has necessarily loaded from the DB (and before any admin
        // edit made later in the session). Computing this lazily at
        // filter-time instead keeps search in sync with live edits.
        searchText: () => `push pull legs upper lower full body ${Object.values(getSplits()).flat().join(" ")}`,
      },
      {
        term: "Primary / Secondary Muscle",
        body: "The primary muscle does most of the work in an exercise; secondary muscles assist. A bench press primarily hits chest, with triceps and shoulders as secondary.",
      },
    ],
  },
  {
    title: "Tracking & Scoring",
    items: [
      {
        term: "PR (Personal Record)",
        body: "Your best-ever result on an exercise, whether that's heaviest weight, most reps, or best estimated one-rep max.",
      },
      {
        term: "DOTS Score",
        body: "A formula that adjusts your lift total for bodyweight and gender, letting you compare relative strength across different body sizes. Used mainly by powerlifters.",
      },
      {
        term: "Percentile",
        body: "Where your strength on a lift ranks compared to other DeltaLog users of similar bodyweight and gender. DeltaLog's default strength metric — easier to read at a glance than DOTS.",
      },
      {
        term: "1RM (One-Rep Max)",
        body: "The most weight you can lift for a single rep with good form. Often estimated from a higher-rep set rather than tested directly, since true max attempts carry more injury risk.",
      },
    ],
  },
];

export default function FAQ({ onClose }) {
  const [open, setOpen] = useState(() => new Set());
  const [search, setSearch] = useState("");

  const toggle = (key) => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const q = search.trim().toLowerCase();
  const filteredSections = SECTIONS.map((section) => ({
    ...section,
    items: q
      ? section.items.filter(
          (item) =>
            item.term.toLowerCase().includes(q) ||
            (typeof item.body === "string" && item.body.toLowerCase().includes(q)) ||
            (item.searchText && (typeof item.searchText === "function" ? item.searchText() : item.searchText).toLowerCase().includes(q))
        )
      : section.items,
  })).filter((section) => section.items.length > 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>FAQ & GLOSSARY</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a term…"
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 20 }}
          />

          {filteredSections.length === 0 && (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No matches for "{search}".</div>
          )}

          {filteredSections.map((section) => (
            <div key={section.title} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{section.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {section.items.map((item) => {
                  const key = `${section.title}:${item.term}`;
                  const isOpen = open.has(key);
                  return (
                    <div key={key} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
                      <button
                        onClick={() => toggle(key)}
                        style={{ width: "100%", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", background: "none", border: "none" }}
                      >
                        <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{item.term}</div>
                        <div style={{ color: T.dim, fontSize: 14, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
                      </button>
                      {isOpen && (
                        <div style={{ padding: "0 14px 14px", color: T.dim, fontSize: 13, lineHeight: 1.5 }}>{item.body}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
