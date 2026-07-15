import { useState, useEffect, useCallback } from "react";
import { startWorkout, addWorkoutExercise, fetchProfile } from "./lib/queries";
import { getPrefs } from "./lib/prefs";
import { toCanonical, toDisplay } from "./lib/weight";
import {
  fetchActiveProgram,
  fetchProgramSessionCount,
  fetchRecentSessions,
  fetchFallbackWeightEstimate,
  tagWorkoutExerciseWithProgram,
  updateProgramStatus,
} from "./lib/programQueries";
import { computePrescription, computeTodaysProgramDay, estimateFallbackE1RM, defaultModelForFocus, PROGRESSION_MODELS } from "./lib/programEngine";
import { InlineLoading } from "./LoadingSpinner";
import { IconX, IconSearch } from "./Icons";
import ProgramSetup from "./ProgramSetup";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  green: "#3BA55D",
};

export default function ProgramView({ user, onClose, onWorkoutStarted }) {
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [week, setWeek] = useState(1);
  const [deload, setDeload] = useState(false);
  const [todaysExercises, setTodaysExercises] = useState([]); // [{ ...programExerciseRow, prescription }]
  const [showSetup, setShowSetup] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = await fetchActiveProgram(user.id);
      setProgram(active);
      if (!active) { setLoading(false); return; }

      const [completed, profile] = await Promise.all([
        fetchProgramSessionCount(active.id),
        fetchProfile(user.id),
      ]);
      const { dayIndex: todayDayIndex, week: currentWeek, deload: deloadWeek } = computeTodaysProgramDay(active, completed);
      setWeek(currentWeek);
      setDeload(deloadWeek);

      const unit = getPrefs().units;
      const bodyweightDisplay = profile?.weight ? toDisplay(toCanonical(profile.weight, profile.weight_unit || "lb"), unit) : null;
      const todays = active.exercises.filter((pe) => pe.dayIndex === todayDayIndex);
      const withPrescriptions = await Promise.all(
        todays.map(async (pe) => {
          const sessions = await fetchRecentSessions(user.id, pe.exercise.id, 3);

          // No history at all on this exact exercise -- try the
          // person's own recent training on similar exercises first,
          // then a conservative bodyweight-based guess, before ever
          // falling back to the library's target_weight (0 for nearly
          // everything, which is how "Arnold Press: 0lb x 10" happened).
          let fallbackEstimate;
          if (sessions.length === 0) {
            const similar = await fetchFallbackWeightEstimate(user.id, { muscleGroup: pe.exercise.muscle, mechanism: pe.exercise.mechanism });
            if (similar) {
              fallbackEstimate = { e1RM: similar, source: "similar_exercises" };
            } else {
              const bodyweightGuess = estimateFallbackE1RM({ mechanism: pe.exercise.mechanism, bodyweightDisplay });
              if (bodyweightGuess) fallbackEstimate = { e1RM: bodyweightGuess, source: "bodyweight" };
            }
          }

          const prescription = computePrescription({
            trainingFocus: active.trainingFocus,
            progressionModel: pe.progressionModel,
            weekNumber: currentWeek,
            durationWeeks: active.durationWeeks,
            isDeloadWeek: deloadWeek,
            sessions,
            unit,
            fallbackWeight: pe.exercise.targetWeight,
            fallbackEstimate,
          });
          return { ...pe, prescription };
        })
      );
      setTodaysExercises(withPrescriptions);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function startSession() {
    setStarting(true);
    try {
      const unit = getPrefs().units;
      const workoutId = await startWorkout(user.id, program.trainingFocus);
      for (const item of todaysExercises) {
        const weId = await addWorkoutExercise(workoutId, item.exercise.id, item.position, item.plannedSets);
        await tagWorkoutExerciseWithProgram(weId, {
          programId: program.id,
          programWeek: week,
          prescribedWeight: toCanonical(item.prescription.weight, unit),
          prescribedReps: item.prescription.reps,
          progressionReason: item.prescription.reasonText,
        });
      }
      onWorkoutStarted();
    } finally {
      setStarting(false);
    }
  }

  async function abandonProgram() {
    setAbandoning(true);
    try {
      await updateProgramStatus(program.id, "abandoned");
      setConfirmingAbandon(false);
      await load();
    } finally {
      setAbandoning(false);
    }
  }

  const unit = getPrefs().units;

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 2000, display: "flex", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26 }} />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text, textAlign: "center" }}>PROGRAM</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T.dim, justifySelf: "end" }}><IconX size={20} /></button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><InlineLoading /></div>
        ) : !program ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <div style={{ color: T.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No active program</div>
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 20 }}>
              Build a multi-week program and get a prescribed weight and reps for every session, with progression built in.
            </div>
            <button onClick={() => setShowSetup(true)} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14 }}>
              Build a Program
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {program.trainingFocus} · {program.splitName}
                </div>
                <div style={{ color: T.dim, fontSize: 12 }}>
                  Week {week} of {program.durationWeeks}{deload ? " · Deload week" : ""}
                </div>
              </div>

              {deload && (
                <div style={{ background: "rgba(232,168,46,0.12)", border: "1px solid rgba(232,168,46,0.35)", borderRadius: 10, padding: 12, marginBottom: 16, color: "#E8A82E", fontSize: 12 }}>
                  This is the block's deload week. Volume and intensity are cut on purpose so you recover before the next program.
                </div>
              )}

              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Today's session</div>
              {todaysExercises.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>No exercises scheduled for today.</div>}
              {todaysExercises.map((item) => (
                <div key={item.programExerciseId} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ color: T.text, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.exercise.short || item.exercise.name}</span>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${item.exercise.name} exercise how to`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Search how to do ${item.exercise.name}`}
                        title="Search how to do this exercise"
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", color: T.dim, padding: 2 }}
                      >
                        <IconSearch size={13} />
                      </a>
                    </span>
                    <span style={{ color: T.text, fontSize: 13, flexShrink: 0 }}>{item.plannedSets} sets</span>
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 600, color: T.text, marginTop: 4 }}>
                    {item.prescription.weight} <span style={{ color: T.dim, fontSize: 15 }}>{unit} ×</span> {item.prescription.reps}
                  </div>
                  <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>{item.prescription.reasonText}</div>
                  <div style={{ color: "#5B6270", fontSize: 10, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {PROGRESSION_MODELS[item.progressionModel || defaultModelForFocus(program.trainingFocus)]}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 24, textAlign: "center" }}>
                {confirmingAbandon ? (
                  <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ color: T.dim, fontSize: 12, marginBottom: 10 }}>Abandon this program? Your progress on it won't be recoverable.</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmingAbandon(false)} disabled={abandoning} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.text, fontSize: 12, fontWeight: 600 }}>
                        Keep going
                      </button>
                      <button onClick={abandonProgram} disabled={abandoning} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 12, fontWeight: 600, opacity: abandoning ? 0.6 : 1 }}>
                        {abandoning ? "Abandoning…" : "Yes, abandon it"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmingAbandon(true)} style={{ padding: "6px 4px", border: "none", background: "none", color: "#5B6270", fontSize: 11.5, textDecoration: "underline" }}>
                    Abandon this program
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: 16, borderTop: `1px solid ${T.line}` }}>
              <button
                onClick={startSession}
                disabled={starting || todaysExercises.length === 0}
                style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontWeight: 700, fontSize: 15, opacity: starting || todaysExercises.length === 0 ? 0.6 : 1 }}
              >
                {starting ? "Starting…" : "Start Today's Session"}
              </button>
            </div>
          </>
        )}

        {showSetup && (
          <ProgramSetup
            user={user}
            onClose={() => setShowSetup(false)}
            onCreated={() => { setShowSetup(false); load(); }}
          />
        )}
      </div>
    </div>
  );
}
