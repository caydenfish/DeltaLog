import { useState, useEffect } from "react";
import { fetchMuscleGroups, fetchMuscleDetailed, fetchMuscleTaxonomy } from "./lib/queries";
import { setMuscleTaxonomyCache } from "./lib/muscleNomenclature";
import { InlineLoading } from "./LoadingSpinner";
import MuscleTaxonomyManager from "./MuscleTaxonomyManager";

const T = {
  bg: "#101216",
  dim: "#8B919D",
};

// Self-sufficient wrapper around MuscleTaxonomyManager so it can be
// opened straight from the Admin menu without depending on Exercise
// Library already being open (which previously supplied its
// muscleGroups/muscleDetailed/taxonomy state as props, since it needed
// that same data for its own exercise-tagging UI anyway -- that fetch
// stays in ExerciseLibraryView.jsx for that purpose, this component just
// duplicates the same three read calls for its own independent use).
//
// Also fixes a real gap in the old wiring: ExerciseLibraryView's
// reloadTaxonomyData only ever refreshed its own local state, never the
// app-wide dbTaxonomy cache muscleLabel()/resolveRegions() actually read
// from everywhere else (Home, SetLogger, Templates, BodyMap) -- so an
// admin's taxonomy edit wouldn't actually take effect app-wide until a
// full reload. onReload here re-fetches all three AND calls
// setMuscleTaxonomyCache with the fresh taxonomy rows, same as App.jsx's
// own boot-time fetch, so edits propagate live immediately.
export default function AdminTaxonomyManager({ onClose }) {
  const [muscleGroups, setMuscleGroups] = useState(undefined);
  const [muscleDetailed, setMuscleDetailed] = useState(undefined);
  const [taxonomy, setTaxonomy] = useState(undefined);

  function reload() {
    fetchMuscleGroups().then(setMuscleGroups).catch(() => setMuscleGroups([]));
    fetchMuscleDetailed().then(setMuscleDetailed).catch(() => setMuscleDetailed([]));
    fetchMuscleTaxonomy().then((rows) => {
      setTaxonomy(rows);
      setMuscleTaxonomyCache(rows);
    }).catch(() => setTaxonomy([]));
  }

  useEffect(reload, []);

  const loading = muscleGroups === undefined || muscleDetailed === undefined || taxonomy === undefined;

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <InlineLoading label="Loading taxonomy…" />
      </div>
    );
  }

  return (
    <MuscleTaxonomyManager
      muscleGroups={muscleGroups}
      muscleDetailed={muscleDetailed}
      taxonomy={taxonomy}
      onReload={reload}
      onClose={onClose}
    />
  );
}
