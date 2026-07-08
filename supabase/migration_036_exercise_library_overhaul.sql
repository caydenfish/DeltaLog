-- Migration: full exercise library overhaul.
-- Replaces exercise metadata (muscle tagging, equipment, mechanics,
-- pattern, plus three new fields) from a fresh 260-exercise spreadsheet.
-- Existing rows are matched by name and UPDATED IN PLACE (same id), so
-- every workout_exercises/template_exercises/exercise_defaults row that
-- already points at them keeps working automatically -- no history is
-- touched. Exercises in the new sheet with no existing match are
-- inserted fresh. Custom (user-submitted) exercises are matched by name
-- against the new library and, where found, have their history
-- reassigned to the matching system exercise before being removed --
-- unmatched ones are left alone rather than guessed at; see the report
-- queries at the bottom.

-- 1. New columns this sheet introduces that didn't exist before.
alter table exercises add column if not exists laterality text;
alter table exercises add column if not exists grip text;
alter table exercises add column if not exists skill_level text;

-- 2. Replace the generic muscle-group taxonomy. The old 14-bucket list
-- (Quads, Hamstrings, Biceps, Triceps, Forearms, Rear Delts, Traps, etc)
-- is replaced by this sheet's coarser 8-value "Level 1" list -- delete
-- child taxonomy rows first (FK to muscle_groups).
delete from muscle_taxonomy;
delete from muscle_groups;

insert into muscle_groups (key, label) values
  ('Arms', 'Arms'), ('Back', 'Back'), ('Chest', 'Chest'), ('Core', 'Core'),
  ('Full Body', 'Full Body'), ('Legs', 'Legs'), ('Neck', 'Neck'), ('Shoulders', 'Shoulders');

insert into muscle_taxonomy (scientific_name, detailed_name, generic_group) values
  ('Adductor Longus/Magnus', 'Adductors', 'Legs'),
  ('Anterior Deltoid', 'Front Delts', 'Shoulders'),
  ('Biceps Brachii', 'Biceps', 'Arms'),
  ('Biceps Femoris', 'Hamstrings', 'Legs'),
  ('Brachialis', 'Brachialis', 'Arms'),
  ('Brachioradialis', 'Forearm Extensors', 'Arms'),
  ('Erector Spinae', 'Lower Back', 'Back'),
  ('External Obliques', 'Obliques', 'Core'),
  ('Flexor Carpi Radialis', 'Forearm Flexors', 'Arms'),
  ('Flexor Digitorum', 'Forearm Flexors', 'Arms'),
  ('Gastrocnemius', 'Calves', 'Legs'),
  ('Gluteus Max. & Erector', 'Glutes & Lower Back', 'Full Body'),
  ('Gluteus Max. & Quads', 'Glutes & Quads', 'Full Body'),
  ('Gluteus Max. & Trapezius', 'Glutes, Hams, Back', 'Full Body'),
  ('Gluteus Maximus', 'Glutes', 'Legs'),
  ('Gluteus Medius', 'Glutes', 'Legs'),
  ('Lateral Deltoid', 'Side Delts', 'Shoulders'),
  ('Latissimus Dorsi', 'Lats', 'Back'),
  ('Multiple', 'Full Body', 'Full Body'),
  ('Pect. Major (Clavicular)', 'Upper Chest', 'Chest'),
  ('Pect. Major (Costal)', 'Lower Chest', 'Chest'),
  ('Pectoralis Major', 'Chest', 'Chest'),
  ('Posterior Deltoid', 'Rear Delts', 'Shoulders'),
  ('Quadriceps Femoris', 'Quads', 'Legs'),
  ('Quads & Anterior Delt', 'Quads & Shoulders', 'Full Body'),
  ('Rectus Abdominis', 'Abs', 'Core'),
  ('Rectus Femoris', 'Quads', 'Legs'),
  ('Rhomboid Major/Minor', 'Rhomboids', 'Back'),
  ('Soleus', 'Calves', 'Legs'),
  ('Sternocleidomastoid', 'Neck Flexors', 'Neck'),
  ('Tibialis Anterior', 'Shins', 'Legs'),
  ('Transverse Abdominis', 'Deep Core', 'Core'),
  ('Trapezius', 'Traps', 'Back'),
  ('Triceps Brachii', 'Triceps', 'Arms')
on conflict (scientific_name) do nothing;

-- 3. The new library itself, staged in a temp table so the update/insert
-- split below can both reference it, and so the gap report at the end
-- can too before it's dropped.
create temporary table _new_exercises (
  name text, aliases text[], muscle_group text, primary_muscle text,
  equipment text[], equipment_type text, mechanism text, pattern text,
  laterality text, grip text, skill_level text
);

insert into _new_exercises (name, aliases, muscle_group, primary_muscle, equipment, equipment_type, mechanism, pattern, laterality, grip, skill_level) values
  ('Barbell Flat Bench Press', ARRAY['Bench Press']::text[], 'Chest', 'Pectoralis Major', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Flat Bench Press', ARRAY['DB Bench']::text[], 'Chest', 'Pectoralis Major', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Machine Flat Chest Press', ARRAY['Chest Press']::text[], 'Chest', 'Pectoralis Major', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Smith Machine Flat Press', ARRAY['Smith Bench']::text[], 'Chest', 'Pectoralis Major', ARRAY['Smith Machine','Bench']::text[], 'Machine', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Barbell Incline Bench Press', ARRAY['Incline Bench']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Barbell','Incline Bench']::text[], 'Barbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Incline Bench Press', ARRAY['Incline DB Press']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Dumbbells','Incline Bench']::text[], 'Dumbbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Machine Incline Chest Press', ARRAY['Incline Machine Press']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Smith Machine Incline Press', ARRAY['Smith Incline']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Smith Machine','Bench']::text[], 'Machine', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Barbell Decline Bench Press', ARRAY['Decline Bench']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Barbell','Decline Bench']::text[], 'Barbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Decline Bench Press', ARRAY['Decline DB Press']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Dumbbells','Decline Bench']::text[], 'Dumbbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated/Neutral', 'Intermediate'),
  ('Machine Decline Chest Press', ARRAY['Decline Machine Press']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Barbell Floor Press', ARRAY['Floor Press']::text[], 'Chest', 'Pectoralis Major', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Floor Press', ARRAY['DB Floor Press']::text[], 'Chest', 'Pectoralis Major', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Flat Dumbbell Fly', ARRAY['DB Flys']::text[], 'Chest', 'Pectoralis Major', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Incline Dumbbell Fly', ARRAY['Incline DB Flys']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Dumbbells','Incline Bench']::text[], 'Dumbbell', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Decline Dumbbell Fly', ARRAY['Decline DB Flys']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Dumbbells','Decline Bench']::text[], 'Dumbbell', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Intermediate'),
  ('High-to-Low Cable Fly', ARRAY['High Cable Flys']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Mid-Level Cable Fly', ARRAY['Cable Flys']::text[], 'Chest', 'Pectoralis Major', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Low-to-High Cable Fly', ARRAY['Low Cable Flys']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Cable Crossover [NEW]', ARRAY['Standing Cable Fly']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Machine Pec Deck Fly', ARRAY['Pec Deck']::text[], 'Chest', 'Pectoralis Major', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Bodyweight Push-Up', ARRAY['Push-Ups']::text[], 'Chest', 'Pectoralis Major', ARRAY['Bodyweight']::text[], 'Bodyweight', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Deficit Push-Up', ARRAY['Deep Push-Ups']::text[], 'Chest', 'Pectoralis Major', ARRAY['Plates / Blocks']::text[], 'Other', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Weighted Push-Up', ARRAY['Weighted Push-Ups']::text[], 'Chest', 'Pectoralis Major', ARRAY['Weight Plate / Vest']::text[], 'Other', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Incline Push-Up', ARRAY['Easy Push-Ups']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Bench / Box']::text[], 'Other', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Decline Push-Up', ARRAY['Feet Elevated Push-Ups']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Bench / Box']::text[], 'Other', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Diamond Push-Up', ARRAY['Triangle Push-Ups']::text[], 'Chest', 'Pectoralis Major', ARRAY['Bodyweight']::text[], 'Bodyweight', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Bodyweight Chest Dip', ARRAY['Dips']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Dip Station']::text[], 'Machine', 'Compound', 'Vert. Push', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Weighted Chest Dip', ARRAY['Weighted Dips']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Dip Station','Belt']::text[], 'Machine', 'Compound', 'Vert. Push', 'Bilateral', 'Neutral', 'Advanced'),
  ('Machine Assisted Dip', ARRAY['Assisted Dips']::text[], 'Chest', 'Pect. Major (Costal)', ARRAY['Assisted Dip Machine']::text[], 'Machine', 'Compound', 'Vert. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Dumbbell Squeeze Press', ARRAY['Hex Press']::text[], 'Chest', 'Pectoralis Major', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Plate Svend Press', ARRAY['Svend Press']::text[], 'Chest', 'Pectoralis Major', ARRAY['Weight Plate']::text[], 'Other', 'Isolation', 'Horiz. Push', 'Bilateral', 'Neutral', 'Beginner'),
  ('Landmine Chest Press', ARRAY['Landmine Press']::text[], 'Chest', 'Pect. Major (Clavicular)', ARRAY['Barbell','Landmine']::text[], 'Barbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Dumbbell Pullover', ARRAY['DB Pullovers']::text[], 'Chest', 'Pectoralis Major', ARRAY['Dumbbell','Bench']::text[], 'Dumbbell', 'Isolation', 'Vert. Pull', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Standing Barbell Overhead Press', ARRAY['OHP','Strict Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Seated Barbell Overhead Press', ARRAY['Seated OHP']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Standing Dumbbell Press', ARRAY['DB Shoulder Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Seated Dumbbell Press', ARRAY['Seated DB Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Arnold Press', ARRAY['Arnolds']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Compound', 'Vert. Push', 'Bilateral', 'Supinating', 'Intermediate'),
  ('Machine Shoulder Press', ARRAY['Shoulder Press Machine']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Smith Machine Shoulder Press', ARRAY['Smith OHP']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Smith Machine','Bench']::text[], 'Machine', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Barbell Push Press', ARRAY['Push Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Advanced'),
  ('Dumbbell Push Press', ARRAY['DB Push Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Vert. Push', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Dumbbell Lateral Raise', ARRAY['Side Raises']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Cable Lateral Raise', ARRAY['Cable Side Raises']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', 'Pronated', 'Beginner'),
  ('Machine Lateral Raise', ARRAY['Machine Side Raises']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Dumbbell Front Raise', ARRAY['DB Front Raises']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Barbell Front Raise', ARRAY['BB Front Raises']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Barbell']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Cable Front Raise', ARRAY['Cable Front Raises']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Plate Front Raise', ARRAY['Plate Raises']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Weight Plate']::text[], 'Other', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Seated Dumbbell Lateral Raise', ARRAY['Seated Side Raises']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Egyptian Cable Lateral Raise', ARRAY['Egyptian Raises']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', 'Pronated', 'Intermediate'),
  ('Leaning Dumbbell Lateral Raise', ARRAY['Leaning Side Raises']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Dumbbell','Squat Rack']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Pronated', 'Intermediate'),
  ('Barbell Upright Row', ARRAY['BB Upright Rows']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Upright Row', ARRAY['DB Upright Rows']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Cable Upright Row', ARRAY['Cable Upright Rows']::text[], 'Shoulders', 'Lateral Deltoid', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Barbell Z-Press', ARRAY['BB Z-Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Advanced'),
  ('Dumbbell Z-Press', ARRAY['DB Z-Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Single-Arm Landmine Press', ARRAY['1-Arm Landmine']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Barbell','Landmine']::text[], 'Barbell', 'Compound', 'Vert. Push', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Kettlebell Overhead Press', ARRAY['KB Press']::text[], 'Shoulders', 'Anterior Deltoid', ARRAY['Kettlebells']::text[], 'Kettlebell', 'Compound', 'Vert. Push', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Close-Grip Barbell Bench Press', ARRAY['Close-Grip Bench']::text[], 'Arms', 'Triceps Brachii', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Smith Close-Grip Press', ARRAY['Smith Close-Grip']::text[], 'Arms', 'Triceps Brachii', ARRAY['Smith Machine','Bench']::text[], 'Machine', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('EZ-Bar Skullcrusher', ARRAY['Lying Tricep Ext.']::text[], 'Arms', 'Triceps Brachii', ARRAY['EZ-Bar','Bench']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Skullcrusher', ARRAY['DB Skullcrushers']::text[], 'Arms', 'Triceps Brachii', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Cable Lying Tricep Extension', ARRAY['Lying Cable Ext.']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine','Bench']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Seated Dumbbell Overhead Ext.', ARRAY['French Press']::text[], 'Arms', 'Triceps Brachii', ARRAY['Dumbbell','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Standing Single-Arm DB Ext.', ARRAY['1-Arm Tricep Ext.']::text[], 'Arms', 'Triceps Brachii', ARRAY['Dumbbell']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Neutral', 'Beginner'),
  ('Cable Rope Overhead Ext.', ARRAY['Rope Overhead Ext.']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('EZ-Bar Overhead Ext.', ARRAY['EZ Overhead Ext.']::text[], 'Arms', 'Triceps Brachii', ARRAY['EZ-Bar','Bench']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Cable Rope Tricep Pushdown', ARRAY['Rope Pushdowns']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Cable Straight Bar Pushdown', ARRAY['Bar Pushdowns']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Cable V-Bar Pushdown', ARRAY['V-Bar Pushdowns']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Cable Reverse-Grip Pushdown', ARRAY['Reverse Pushdowns']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('Single-Arm Cable Pushdown', ARRAY['1-Arm Pushdowns']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', 'Supinated/Pronated', 'Beginner'),
  ('Dumbbell Tricep Kickback', ARRAY['Kickbacks']::text[], 'Arms', 'Triceps Brachii', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Neutral', 'Beginner'),
  ('Cable Tricep Kickback', ARRAY['Cable Kickbacks']::text[], 'Arms', 'Triceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', 'Neutral', 'Beginner'),
  ('Tate Press', ARRAY['DB Tate Press']::text[], 'Arms', 'Triceps Brachii', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Intermediate'),
  ('JM Press', ARRAY['Barbell JM Press']::text[], 'Arms', 'Triceps Brachii', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Compound', 'Horiz. Push', 'Bilateral', 'Pronated', 'Advanced'),
  ('Bodyweight Bench Dip', ARRAY['Bench Dips']::text[], 'Arms', 'Triceps Brachii', ARRAY['Bench']::text[], 'Other', 'Compound', 'Vert. Push', 'Bilateral', 'Pronated', 'Beginner'),
  ('Machine Tricep Extension', ARRAY['Tricep Machine']::text[], 'Arms', 'Triceps Brachii', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Bodyweight Pull-Up', ARRAY['Pull-Ups']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Pull-Up Bar']::text[], 'Bodyweight', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Weighted Pull-Up', ARRAY['Weighted Pull-Ups']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Bar','Belt/Vest']::text[], 'Other', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Advanced'),
  ('Machine Assisted Pull-Up', ARRAY['Assisted Pull-Ups']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Assisted Machine']::text[], 'Machine', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Bodyweight Chin-Up', ARRAY['Chin-Ups']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Pull-Up Bar']::text[], 'Bodyweight', 'Compound', 'Vert. Pull', 'Bilateral', 'Supinated', 'Intermediate'),
  ('Weighted Chin-Up', ARRAY['Weighted Chin-Ups']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Bar','Belt/Vest']::text[], 'Other', 'Compound', 'Vert. Pull', 'Bilateral', 'Supinated', 'Advanced'),
  ('Wide-Grip Lat Pulldown', ARRAY['Pulldowns']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Close-Grip Neutral Pulldown', ARRAY['V-Bar Pulldowns']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Vert. Pull', 'Bilateral', 'Neutral', 'Beginner'),
  ('Underhand Lat Pulldown', ARRAY['Reverse Pulldowns']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Vert. Pull', 'Bilateral', 'Supinated', 'Beginner'),
  ('Single-Arm Cable Pulldown', ARRAY['1-Arm Pulldowns']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Vert. Pull', 'Unilateral', 'Neutral/Pronated', 'Intermediate'),
  ('Machine Lat Pulldown', ARRAY['Pulldown Machine']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Barbell Bent-Over Row', ARRAY['Barbell Row']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Barbell Pendlay Row', ARRAY['Pendlay Rows']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Advanced'),
  ('Barbell Yates Row', ARRAY['Yates Rows']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Supinated/Pronated', 'Intermediate'),
  ('Barbell Underhand Row', ARRAY['Reverse BB Row']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Supinated', 'Intermediate'),
  ('Single-Arm Dumbbell Row', ARRAY['1-Arm DB Row']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Dumbbell','Bench']::text[], 'Dumbbell', 'Compound', 'Horiz. Pull', 'Unilateral', 'Neutral', 'Beginner'),
  ('Dumbbell Chest-Supported Row', ARRAY['Chest-Supp. Row']::text[], 'Back', 'Rhomboid Major/Minor', ARRAY['Dumbbells','Incline Bench']::text[], 'Dumbbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Dumbbell Seal Row', ARRAY['Seal Rows']::text[], 'Back', 'Rhomboid Major/Minor', ARRAY['Dumbbells','High Bench']::text[], 'Dumbbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated/Neutral', 'Intermediate'),
  ('Renegade Row', ARRAY['Plank Rows']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Horiz. Pull', 'Unilateral', 'Neutral', 'Advanced'),
  ('Seated Cable Row (Narrow)', ARRAY['Seated Rows']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Bilateral', 'Neutral', 'Beginner'),
  ('Seated Cable Row (Wide)', ARRAY['Wide Seated Rows']::text[], 'Back', 'Rhomboid Major/Minor', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Single-Arm Cable Row', ARRAY['1-Arm Cable Row']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Unilateral', 'Neutral', 'Beginner'),
  ('T-Bar Row (Chest-Supported)', ARRAY['T-Bar Rows']::text[], 'Back', 'Rhomboid Major/Minor', ARRAY['T-Bar Machine']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('T-Bar Row (Landmine)', ARRAY['Landmine Rows']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Barbell','Landmine']::text[], 'Barbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Machine High Row', ARRAY['High Rows']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Machine Mid Row', ARRAY['Mid Rows']::text[], 'Back', 'Rhomboid Major/Minor', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Machine Low Row', ARRAY['Low Rows']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Bilateral', 'Neutral', 'Beginner'),
  ('Cable Straight-Arm Pulldown', ARRAY['Straight-Arm Lat Pull']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Cable Straight-Arm Pullover [NEW]', ARRAY['Lat Prayers']::text[], 'Back', 'Latissimus Dorsi', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Vert. Pull', 'Bilateral', 'Pronated/Neutral', 'Intermediate'),
  ('Rack Pull', ARRAY['Block Pulls']::text[], 'Back', 'Erector Spinae', ARRAY['Barbell','Power Rack']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated/Mixed', 'Intermediate'),
  ('Bodyweight Back Extension', ARRAY['Hyperextensions']::text[], 'Back', 'Erector Spinae', ARRAY['Roman Chair']::text[], 'Machine', 'Isolation', 'Hinge', 'Bilateral', 'Neutral', 'Beginner'),
  ('Weighted Back Extension', ARRAY['Weighted Hypers']::text[], 'Back', 'Erector Spinae', ARRAY['Roman Chair','Plate']::text[], 'Machine', 'Isolation', 'Hinge', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Machine Back Extension', ARRAY['Back Ext. Machine']::text[], 'Back', 'Erector Spinae', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Hinge', 'Bilateral', 'Neutral', 'Beginner'),
  ('Barbell Good Morning', ARRAY['Good Mornings']::text[], 'Back', 'Erector Spinae', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Seated Barbell Good Morning', ARRAY['Seated Good Mornings']::text[], 'Back', 'Erector Spinae', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated', 'Advanced'),
  ('Machine Reverse Pec Deck', ARRAY['Reverse Fly Machine']::text[], 'Shoulders', 'Posterior Deltoid', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Horiz. Pull', 'Bilateral', 'Pronated/Neutral', 'Beginner'),
  ('Cable Face Pull', ARRAY['Face Pulls']::text[], 'Shoulders', 'Posterior Deltoid', ARRAY['Cable Machine','Rope']::text[], 'Machine', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Bent-Over Dumbbell Reverse Fly', ARRAY['DB Rear Delt Flys']::text[], 'Shoulders', 'Posterior Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Standing Cable Reverse Fly', ARRAY['Cable Rear Delt Flys']::text[], 'Shoulders', 'Posterior Deltoid', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Wide-Grip Barbell Rear Delt Row', ARRAY['BB Rear Delt Rows']::text[], 'Shoulders', 'Posterior Deltoid', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Wide-Grip Dumbbell Rear Delt Row', ARRAY['DB Rear Delt Rows']::text[], 'Shoulders', 'Posterior Deltoid', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Horiz. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Barbell Shrug', ARRAY['BB Shrugs']::text[], 'Back', 'Trapezius', ARRAY['Barbell']::text[], 'Barbell', 'Isolation', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Dumbbell Shrug', ARRAY['DB Shrugs']::text[], 'Back', 'Trapezius', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Vert. Pull', 'Bilateral', 'Neutral', 'Beginner'),
  ('Trap Bar Shrug', ARRAY['Hex Bar Shrugs']::text[], 'Back', 'Trapezius', ARRAY['Trap Bar']::text[], 'Barbell', 'Isolation', 'Vert. Pull', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Smith Machine Shrug', ARRAY['Smith Shrugs']::text[], 'Back', 'Trapezius', ARRAY['Smith Machine']::text[], 'Machine', 'Isolation', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Cable Shrug', ARRAY['Cable Shrugs']::text[], 'Back', 'Trapezius', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Vert. Pull', 'Bilateral', 'Pronated', 'Beginner'),
  ('Machine Shrug', ARRAY['Shrug Machine']::text[], 'Back', 'Trapezius', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Vert. Pull', 'Bilateral', 'Neutral', 'Beginner'),
  ('Barbell Bicep Curl', ARRAY['Straight Bar Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Barbell']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('EZ-Bar Bicep Curl', ARRAY['EZ Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['EZ-Bar']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('Alternating Dumbbell Curl', ARRAY['Alt DB Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Supinated', 'Beginner'),
  ('Supinating Dumbbell Curl', ARRAY['DB Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Supinating', 'Beginner'),
  ('Seated Incline Dumbbell Curl', ARRAY['Incline DB Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Dumbbells','Incline Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('Dumbbell Concentration Curl', ARRAY['Concentration Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Dumbbell','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Supinated', 'Beginner'),
  ('Dumbbell Hammer Curl', ARRAY['Hammer Curls']::text[], 'Arms', 'Brachialis', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Cable Rope Hammer Curl', ARRAY['Rope Curls']::text[], 'Arms', 'Brachialis', ARRAY['Cable Machine','Rope']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Cable Straight Bar Curl', ARRAY['Cable Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('High Cable Double Bicep Curl', ARRAY['Front Double Bicep']::text[], 'Arms', 'Biceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Intermediate'),
  ('Single-Arm Cable Curl', ARRAY['1-Arm Cable Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', 'Supinated', 'Beginner'),
  ('EZ-Bar Preacher Curl', ARRAY['Preacher Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['EZ-Bar','Preacher Bench']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('Dumbbell Preacher Curl', ARRAY['DB Preacher Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Dumbbell','Preacher Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Supinated', 'Beginner'),
  ('Machine Preacher Curl', ARRAY['Preacher Machine']::text[], 'Arms', 'Biceps Brachii', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('Dumbbell Spider Curl', ARRAY['DB Spider Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Dumbbells','Incline Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Intermediate'),
  ('EZ-Bar Spider Curl', ARRAY['EZ Spider Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['EZ-Bar','Incline Bench']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Intermediate'),
  ('Barbell Drag Curl', ARRAY['Drag Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Barbell']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Intermediate'),
  ('Zottman Curl', ARRAY['Zottmans']::text[], 'Arms', 'Biceps Brachii', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', 'Mixed', 'Intermediate'),
  ('Reverse Barbell Curl', ARRAY['BB Reverse Curls']::text[], 'Arms', 'Brachioradialis', ARRAY['Barbell']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Reverse EZ-Bar Curl', ARRAY['EZ Reverse Curls']::text[], 'Arms', 'Brachioradialis', ARRAY['EZ-Bar']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Barbell Wrist Curl', ARRAY['Wrist Curls']::text[], 'Arms', 'Flexor Carpi Radialis', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Supinated', 'Beginner'),
  ('Dumbbell Wrist Curl', ARRAY['DB Wrist Curls']::text[], 'Arms', 'Flexor Carpi Radialis', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Supinated', 'Beginner'),
  ('Barbell Reverse Wrist Curl', ARRAY['Reverse Wrist Curls']::text[], 'Arms', 'Brachioradialis', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Plate Pinch Hold', ARRAY['Plate Pinches']::text[], 'Arms', 'Flexor Digitorum', ARRAY['Weight Plates']::text[], 'Other', 'Isolation', 'Isometric', 'Unilateral', 'Neutral', 'Beginner'),
  ('Farmer''s Walk', ARRAY['Farmer Carries']::text[], 'Arms', 'Flexor Digitorum', ARRAY['Dumbbells / Kettlebells']::text[], 'Kettlebell', 'Compound', 'Carry', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Suitcase Carry [NEW]', ARRAY['Single-Arm Carry']::text[], 'Core', 'External Obliques', ARRAY['Dumbbell / Kettlebell']::text[], 'Kettlebell', 'Compound', 'Carry', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Barbell High-Bar Back Squat', ARRAY['Back Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Rack']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Barbell Low-Bar Back Squat', ARRAY['Low-Bar Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Rack']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Barbell Front Squat', ARRAY['Front Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Rack']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Supinated/Cross', 'Advanced'),
  ('Barbell Zercher Squat', ARRAY['Zercher Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Rack']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Neutral (Crook)', 'Advanced'),
  ('Barbell Box Squat', ARRAY['Box Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Box']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Barbell Pause Squat', ARRAY['Pause Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Rack']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Pronated', 'Advanced'),
  ('Barbell Overhead Squat', ARRAY['OH Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Rack']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Pronated', 'Advanced'),
  ('Smith Machine Squat', ARRAY['Smith Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Smith Machine']::text[], 'Machine', 'Compound', 'Squat', 'Bilateral', 'Pronated', 'Beginner'),
  ('Dumbbell Goblet Squat', ARRAY['DB Goblet Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbell']::text[], 'Dumbbell', 'Compound', 'Squat', 'Bilateral', 'Neutral', 'Beginner'),
  ('Kettlebell Goblet Squat', ARRAY['KB Goblet Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Kettlebell']::text[], 'Kettlebell', 'Compound', 'Squat', 'Bilateral', 'Neutral', 'Beginner'),
  ('Dumbbell Bulgarian Split Squat', ARRAY['BSS']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbells','Bench']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Barbell Bulgarian Split Squat', ARRAY['Barbell BSS']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Compound', 'Lunge', 'Unilateral', 'Pronated', 'Advanced'),
  ('Dumbbell Standard Split Squat', ARRAY['Static Lunges']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Beginner'),
  ('DB Front-Foot Elevated Split', ARRAY['Deficit Split Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbells','Plate/Block']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Dumbbell Walking Lunge', ARRAY['DB Lunges']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Beginner'),
  ('Barbell Walking Lunge', ARRAY['BB Lunges']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Lunge', 'Unilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Reverse Lunge', ARRAY['DB Reverse Lunges']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Beginner'),
  ('Barbell Reverse Lunge', ARRAY['BB Reverse Lunges']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Lunge', 'Unilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Forward Lunge', ARRAY['DB Forward Lunges']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Beginner'),
  ('Machine Leg Press', ARRAY['Leg Press']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Leg Press Machine']::text[], 'Machine', 'Compound', 'Squat', 'Bilateral', null, 'Beginner'),
  ('Single-Leg Leg Press', ARRAY['1-Leg Press']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Leg Press Machine']::text[], 'Machine', 'Compound', 'Squat', 'Unilateral', null, 'Beginner'),
  ('Machine Hack Squat', ARRAY['Hack Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Hack Squat Machine']::text[], 'Machine', 'Compound', 'Squat', 'Bilateral', null, 'Beginner'),
  ('Barbell Hack Squat', ARRAY['BB Hack Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Squat', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Machine Pendulum Squat', ARRAY['Pendulum Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Pendulum Machine']::text[], 'Machine', 'Compound', 'Squat', 'Bilateral', null, 'Intermediate'),
  ('Machine V-Squat', ARRAY['V-Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['V-Squat Machine']::text[], 'Machine', 'Compound', 'Squat', 'Bilateral', null, 'Beginner'),
  ('Machine Leg Extension', ARRAY['Leg Ext.']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Leg Extension Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Single-Leg Leg Extension', ARRAY['1-Leg Ext.']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Leg Extension Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Bodyweight Sissy Squat', ARRAY['Sissy Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Bodyweight']::text[], 'Bodyweight', 'Isolation', 'Squat', 'Bilateral', null, 'Advanced'),
  ('Weighted Sissy Squat', ARRAY['Weighted Sissy Squat']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Plate / Vest']::text[], 'Other', 'Isolation', 'Squat', 'Bilateral', null, 'Advanced'),
  ('Dumbbell Step-Up', ARRAY['DB Step-Ups']::text[], 'Legs', 'Quadriceps Femoris', ARRAY['Dumbbells','Box']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Beginner'),
  ('Reverse Nordic Curl [NEW]', ARRAY['Bodyweight Leg Ext.']::text[], 'Legs', 'Rectus Femoris', ARRAY['Bodyweight / Mat']::text[], 'Bodyweight', 'Isolation', 'Isolation', 'Bilateral', null, 'Intermediate'),
  ('Barbell Romanian Deadlift', ARRAY['BB RDLs']::text[], 'Legs', 'Biceps Femoris', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated/Mixed', 'Intermediate'),
  ('Dumbbell Romanian Deadlift', ARRAY['DB RDLs']::text[], 'Legs', 'Biceps Femoris', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Hinge', 'Bilateral', 'Neutral/Pronated', 'Beginner'),
  ('Single-Leg Dumbbell RDL', ARRAY['1-Leg RDL']::text[], 'Legs', 'Biceps Femoris', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Hinge', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Trap Bar Romanian Deadlift', ARRAY['Hex Bar RDLs']::text[], 'Legs', 'Biceps Femoris', ARRAY['Trap Bar']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Cable Pull-Through', ARRAY['Pull-Throughs']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Hinge', 'Bilateral', 'Neutral', 'Beginner'),
  ('Barbell Stiff-Leg Deadlift', ARRAY['SLDL']::text[], 'Legs', 'Biceps Femoris', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Dumbbell Stiff-Leg Deadlift', ARRAY['DB SLDL']::text[], 'Legs', 'Biceps Femoris', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Hinge', 'Bilateral', 'Neutral/Pronated', 'Beginner'),
  ('Machine Lying Leg Curl', ARRAY['Lying Ham Curls']::text[], 'Legs', 'Biceps Femoris', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Machine Seated Leg Curl', ARRAY['Seated Ham Curls']::text[], 'Legs', 'Biceps Femoris', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Standing Single-Leg Curl', ARRAY['1-Leg Ham Curl']::text[], 'Legs', 'Biceps Femoris', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Nordic Hamstring Curl', ARRAY['Nordics']::text[], 'Legs', 'Biceps Femoris', ARRAY['Pad / Partner']::text[], 'Other', 'Isolation', 'Isolation', 'Bilateral', null, 'Advanced'),
  ('Glute-Ham Raise (GHR)', ARRAY['GHR']::text[], 'Legs', 'Biceps Femoris', ARRAY['GHR Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Advanced'),
  ('Dumbbell Leg Curl', ARRAY['DB Ham Curls']::text[], 'Legs', 'Biceps Femoris', ARRAY['Dumbbell','Bench']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Swiss Ball Hamstring Curl', ARRAY['Stability Ball Curls']::text[], 'Legs', 'Biceps Femoris', ARRAY['Swiss Ball']::text[], 'Other', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Kettlebell Swing', ARRAY['KB Swings']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Kettlebell']::text[], 'Kettlebell', 'Compound', 'Hinge', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Barbell Hip Thrust', ARRAY['BB Hip Thrust']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Barbell','Bench']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Machine Hip Thrust', ARRAY['Hip Thrust Machine']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Machine']::text[], 'Machine', 'Compound', 'Hinge', 'Bilateral', null, 'Beginner'),
  ('Single-Leg Dumbbell Thrust', ARRAY['1-Leg Thrust']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Dumbbell','Bench']::text[], 'Dumbbell', 'Compound', 'Hinge', 'Unilateral', null, 'Intermediate'),
  ('Bodyweight Glute Bridge', ARRAY['Glute Bridges']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Floor']::text[], 'Other', 'Compound', 'Hinge', 'Bilateral', null, 'Beginner'),
  ('Barbell Glute Bridge', ARRAY['BB Glute Bridges']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Barbell','Floor']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Cable Glute Kickback', ARRAY['Cable Kickbacks']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Cable Machine','Ankle Cuff']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Machine Glute Kickback', ARRAY['Kickback Machine']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Banded Glute Kickback', ARRAY['Band Kickbacks']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Resistance Band']::text[], 'Other', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Machine Seated Hip Abduction', ARRAY['Abductor Machine']::text[], 'Legs', 'Gluteus Medius', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Cable Standing Hip Abduction', ARRAY['Cable Abductions']::text[], 'Legs', 'Gluteus Medius', ARRAY['Cable Machine','Ankle Cuff']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Banded Clamshell', ARRAY['Clamshells']::text[], 'Legs', 'Gluteus Medius', ARRAY['Resistance Band']::text[], 'Other', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Dumbbell Curtsy Lunge', ARRAY['Curtsy Lunges']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Deficit Reverse Lunge', ARRAY['Elevated Lunges']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Dumbbells','Plate']::text[], 'Dumbbell', 'Compound', 'Lunge', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Frog Pumps', ARRAY['Frog Bridges']::text[], 'Legs', 'Gluteus Maximus', ARRAY['Floor']::text[], 'Other', 'Isolation', 'Hinge', 'Bilateral', null, 'Beginner'),
  ('Machine Standing Calf Raise', ARRAY['Standing Calves']::text[], 'Legs', 'Gastrocnemius', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Smith Standing Calf Raise', ARRAY['Smith Calves']::text[], 'Legs', 'Gastrocnemius', ARRAY['Smith Machine','Block']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', 'Pronated', 'Beginner'),
  ('Dumbbell Standing Calf Raise', ARRAY['DB Calves']::text[], 'Legs', 'Gastrocnemius', ARRAY['Dumbbells','Block']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Unilateral', 'Neutral', 'Beginner'),
  ('Single-Leg Bodyweight Raise', ARRAY['1-Leg Calf Raises']::text[], 'Legs', 'Gastrocnemius', ARRAY['Block / Step']::text[], 'Other', 'Isolation', 'Isolation', 'Unilateral', null, 'Beginner'),
  ('Machine Seated Calf Raise', ARRAY['Seated Calves']::text[], 'Legs', 'Soleus', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Dumbbell Seated Calf Raise', ARRAY['DB Seated Calves']::text[], 'Legs', 'Soleus', ARRAY['Dumbbells','Bench','Block']::text[], 'Dumbbell', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Leg Press Calf Raise', ARRAY['Leg Press Calves']::text[], 'Legs', 'Gastrocnemius', ARRAY['Leg Press Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Machine Donkey Calf Raise', ARRAY['Donkey Calves']::text[], 'Legs', 'Gastrocnemius', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Tibialis Raise', ARRAY['Tib Raises']::text[], 'Legs', 'Tibialis Anterior', ARRAY['Wall / Tib Bar']::text[], 'Other', 'Isolation', 'Isolation', 'Bilateral', null, 'Beginner'),
  ('Copenhagen Plank [NEW]', ARRAY['Adductor Plank']::text[], 'Legs', 'Adductor Longus/Magnus', ARRAY['Bench / Box']::text[], 'Other', 'Isolation', 'Isometric', 'Unilateral', null, 'Advanced'),
  ('Bodyweight Crunch', ARRAY['Crunches']::text[], 'Core', 'Rectus Abdominis', ARRAY['Floor']::text[], 'Other', 'Isolation', 'Flexion', 'Bilateral', null, 'Beginner'),
  ('Decline Bench Crunch', ARRAY['Decline Crunches']::text[], 'Core', 'Rectus Abdominis', ARRAY['Decline Bench']::text[], 'Other', 'Isolation', 'Flexion', 'Bilateral', null, 'Intermediate'),
  ('Cable Crunch', ARRAY['Rope Crunches']::text[], 'Core', 'Rectus Abdominis', ARRAY['Cable Machine','Rope']::text[], 'Machine', 'Isolation', 'Flexion', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Machine Crunch', ARRAY['Ab Machine']::text[], 'Core', 'Rectus Abdominis', ARRAY['Machine']::text[], 'Machine', 'Isolation', 'Flexion', 'Bilateral', null, 'Beginner'),
  ('Bodyweight Sit-Up', ARRAY['Sit-Ups']::text[], 'Core', 'Rectus Abdominis', ARRAY['Floor']::text[], 'Other', 'Compound', 'Flexion', 'Bilateral', null, 'Beginner'),
  ('Decline Weighted Sit-Up', ARRAY['Weighted Sit-Ups']::text[], 'Core', 'Rectus Abdominis', ARRAY['Decline Bench','Plate']::text[], 'Other', 'Compound', 'Flexion', 'Bilateral', null, 'Intermediate'),
  ('Hanging Straight Leg Raise', ARRAY['Leg Raises']::text[], 'Core', 'Rectus Abdominis', ARRAY['Pull-Up Bar']::text[], 'Bodyweight', 'Compound', 'Flexion', 'Bilateral', 'Pronated', 'Advanced'),
  ('Hanging Knee Raise', ARRAY['Knee Raises']::text[], 'Core', 'Rectus Abdominis', ARRAY['Pull-Up Bar']::text[], 'Bodyweight', 'Compound', 'Flexion', 'Bilateral', 'Pronated', 'Intermediate'),
  ('Captain''s Chair Leg Raise', ARRAY['Captain''s Chair']::text[], 'Core', 'Rectus Abdominis', ARRAY['Captain''s Chair']::text[], 'Machine', 'Compound', 'Flexion', 'Bilateral', 'Neutral', 'Beginner'),
  ('Lying Leg Raise', ARRAY['Lying Leg Lifts']::text[], 'Core', 'Rectus Abdominis', ARRAY['Floor']::text[], 'Other', 'Compound', 'Flexion', 'Bilateral', null, 'Beginner'),
  ('Bodyweight Plank', ARRAY['Front Plank']::text[], 'Core', 'Transverse Abdominis', ARRAY['Floor']::text[], 'Other', 'Compound', 'Isometric', 'Bilateral', null, 'Beginner'),
  ('Weighted Plank', ARRAY['Weighted Planks']::text[], 'Core', 'Transverse Abdominis', ARRAY['Floor','Plate']::text[], 'Other', 'Compound', 'Isometric', 'Bilateral', null, 'Intermediate'),
  ('Side Plank', ARRAY['Side Planks']::text[], 'Core', 'External Obliques', ARRAY['Floor']::text[], 'Other', 'Isolation', 'Isometric', 'Unilateral', null, 'Beginner'),
  ('Ab Wheel Rollout', ARRAY['Ab Rollouts']::text[], 'Core', 'Rectus Abdominis', ARRAY['Ab Wheel']::text[], 'Other', 'Compound', 'Flexion', 'Bilateral', 'Pronated', 'Advanced'),
  ('Weight Plate Russian Twist', ARRAY['Russian Twists']::text[], 'Core', 'External Obliques', ARRAY['Weight Plate']::text[], 'Other', 'Compound', 'Rotation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Medicine Ball Russian Twist', ARRAY['Med Ball Twists']::text[], 'Core', 'External Obliques', ARRAY['Medicine Ball']::text[], 'Other', 'Compound', 'Rotation', 'Bilateral', 'Neutral', 'Beginner'),
  ('Cable Woodchopper', ARRAY['Woodchops']::text[], 'Core', 'External Obliques', ARRAY['Cable Machine']::text[], 'Machine', 'Compound', 'Rotation', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Medicine Ball Woodchopper', ARRAY['Med Ball Woodchops']::text[], 'Core', 'External Obliques', ARRAY['Medicine Ball']::text[], 'Other', 'Compound', 'Rotation', 'Unilateral', 'Neutral', 'Beginner'),
  ('Bodyweight V-Up', ARRAY['V-Ups']::text[], 'Core', 'Rectus Abdominis', ARRAY['Floor']::text[], 'Other', 'Compound', 'Flexion', 'Bilateral', null, 'Intermediate'),
  ('Hollow Body Hold', ARRAY['Hollow Holds']::text[], 'Core', 'Transverse Abdominis', ARRAY['Floor']::text[], 'Other', 'Compound', 'Isometric', 'Bilateral', null, 'Intermediate'),
  ('Cable Pallof Press', ARRAY['Pallof Press']::text[], 'Core', 'External Obliques', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isometric', 'Unilateral', 'Neutral', 'Intermediate'),
  ('Bodyweight Dead Bug', ARRAY['Dead Bugs']::text[], 'Core', 'Transverse Abdominis', ARRAY['Floor']::text[], 'Other', 'Compound', 'Flexion', 'Bilateral', null, 'Beginner'),
  ('Bicycle Crunch', ARRAY['Bicycles']::text[], 'Core', 'External Obliques', ARRAY['Floor']::text[], 'Other', 'Compound', 'Flexion/Rot.', 'Bilateral', null, 'Beginner'),
  ('Toes to Bar', ARRAY['T2B']::text[], 'Core', 'Rectus Abdominis', ARRAY['Pull-Up Bar']::text[], 'Bodyweight', 'Compound', 'Flexion', 'Bilateral', 'Pronated', 'Advanced'),
  ('Windshield Wipers', ARRAY['Wipers']::text[], 'Core', 'External Obliques', ARRAY['Floor / Pull-Up Bar']::text[], 'Bodyweight', 'Compound', 'Rotation', 'Bilateral', 'Pronated', 'Advanced'),
  ('Neck Curl [NEW]', ARRAY['Neck Flexion']::text[], 'Neck', 'Sternocleidomastoid', ARRAY['Weight Plate','Bench']::text[], 'Other', 'Isolation', 'Flexion', 'Bilateral', null, 'Intermediate'),
  ('Barbell Conventional Deadlift', ARRAY['Deadlift']::text[], 'Full Body', 'Gluteus Max. & Erector', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated/Mixed', 'Intermediate'),
  ('Barbell Sumo Deadlift', ARRAY['Sumo Deadlift']::text[], 'Full Body', 'Gluteus Max. & Quads', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated/Mixed', 'Intermediate'),
  ('Trap Bar Deadlift', ARRAY['Hex Bar Deadlift']::text[], 'Full Body', 'Gluteus Max. & Quads', ARRAY['Trap Bar']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Neutral', 'Beginner'),
  ('Barbell Deficit Deadlift', ARRAY['Deficit Deadlifts']::text[], 'Full Body', 'Gluteus Max. & Erector', ARRAY['Barbell','Plate/Block']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated/Mixed', 'Advanced'),
  ('Barbell Block Pull', ARRAY['Block Pulls']::text[], 'Full Body', 'Gluteus Max. & Erector', ARRAY['Barbell','Blocks/Rack']::text[], 'Barbell', 'Compound', 'Hinge', 'Bilateral', 'Pronated/Mixed', 'Intermediate'),
  ('Barbell Power Clean', ARRAY['Cleans']::text[], 'Full Body', 'Gluteus Max. & Trapezius', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Explosive', 'Bilateral', 'Pronated', 'Advanced'),
  ('Dumbbell Power Clean', ARRAY['DB Cleans']::text[], 'Full Body', 'Gluteus Max. & Trapezius', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Explosive', 'Bilateral', 'Neutral', 'Intermediate'),
  ('Barbell Clean and Jerk', ARRAY['Clean & Jerk']::text[], 'Full Body', 'Multiple', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Explosive', 'Bilateral', 'Pronated', 'Advanced'),
  ('Barbell Snatch', ARRAY['Snatch']::text[], 'Full Body', 'Multiple', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Explosive', 'Bilateral', 'Pronated (Wide)', 'Advanced'),
  ('Dumbbell Thruster', ARRAY['DB Thrusters']::text[], 'Full Body', 'Quads & Anterior Delt', ARRAY['Dumbbells']::text[], 'Dumbbell', 'Compound', 'Squat/Push', 'Bilateral', 'Neutral/Pronated', 'Intermediate'),
  ('Barbell Thruster', ARRAY['BB Thrusters']::text[], 'Full Body', 'Quads & Anterior Delt', ARRAY['Barbell']::text[], 'Barbell', 'Compound', 'Squat/Push', 'Bilateral', 'Pronated', 'Advanced'),
  ('Bayesian Cable Curl', ARRAY['Bayesian Curls']::text[], 'Arms', 'Biceps Brachii', ARRAY['Cable Machine']::text[], 'Machine', 'Isolation', 'Isolation', 'Unilateral', 'Supinated', 'Intermediate');

-- 4a. Update existing system exercises matched by name -- same id, so
-- all historical references keep resolving correctly.
update exercises e set
  aliases = n.aliases,
  muscle_group = n.muscle_group,
  primary_muscles = array[n.primary_muscle],
  secondary_muscles = '{}',
  equipment = n.equipment,
  equipment_type = n.equipment_type,
  mechanism = n.mechanism,
  pattern = n.pattern,
  laterality = n.laterality,
  grip = n.grip,
  skill_level = n.skill_level,
  archived = false,
  admin_reviewed = true
from _new_exercises n
where lower(trim(e.name)) = lower(trim(n.name)) and e.created_by is null;

-- 4b. Insert new-sheet exercises that had no existing match.
insert into exercises (name, aliases, muscle_group, primary_muscles, secondary_muscles, equipment, equipment_type, mechanism, pattern, laterality, grip, skill_level, target_weight, setup_fields, created_by, admin_reviewed)
select n.name, n.aliases, n.muscle_group, array[n.primary_muscle], '{}', n.equipment, n.equipment_type, n.mechanism, n.pattern, n.laterality, n.grip, n.skill_level, 0, '[]'::jsonb, null, true
from _new_exercises n
where not exists (
  select 1 from exercises e where lower(trim(e.name)) = lower(trim(n.name)) and e.created_by is null
);

-- 5. Reconcile custom (user-submitted) exercises against the new
-- library by name. Matched ones get their history repointed to the
-- matching system exercise, then removed. Unmatched ones are left
-- completely alone -- see the leftover-custom report below.
do $$
declare
  cust record;
  target_id uuid;
begin
  for cust in select id, name from exercises where created_by is not null loop
    select id into target_id from exercises
    where created_by is null and lower(trim(name)) = lower(trim(cust.name))
    limit 1;

    if target_id is not null then
      update workout_exercises set exercise_id = target_id where exercise_id = cust.id;
      update template_exercises set exercise_id = target_id where exercise_id = cust.id;

      insert into exercise_defaults (user_id, exercise_id, setup, notes, rest_seconds, is_favorite)
      select user_id, target_id, setup, notes, rest_seconds, is_favorite
      from exercise_defaults where exercise_id = cust.id
      on conflict (user_id, exercise_id) do nothing;
      delete from exercise_defaults where exercise_id = cust.id;

      delete from exercises where id = cust.id;
    end if;
  end loop;
end $$;

-- Reconciliation done. The temp table is intentionally NOT dropped here
-- -- it stays alive for the rest of this database session so the two
-- report queries below can use it. Run this whole migration first, then
-- run the two SELECT queries below as SEPARATE queries in the same SQL
-- editor session (same connection) afterward, and send me both results.