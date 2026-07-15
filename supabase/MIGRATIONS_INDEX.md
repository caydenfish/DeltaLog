# DeltaLog Supabase migration index

Full chronological list, current as of `migration_058`. Pair with
`README.md` for the folder conventions, known gaps, and the process
rule. Each row below is short enough to use as the description when you
save the matching file as a Favorite in the Supabase SQL Editor —
Favorite name = filename (minus `.sql`), description = the text here.

## Pre-sequence (run once, before numbering existed)

| File | What it does |
|---|---|
| `migration_001_initial_schema.sql` | The original full schema — exercises, workouts, sets, profiles, auth. Everything starts here. |
| `seed_exercises.sql` | One-time seed: 252 exercises from the source spreadsheet. Run right after 001. |

## Sequential migrations

| # | File | What it does |
|---|---|---|
| 002 | `migration_002_workout_summary.sql` | Post-workout capture fields; speeds up dashboard queries. |
| 003 | `migration_003_templates.sql` | Workout templates (`workout_templates`, `template_exercises`). |
| 004 | `migration_004_custom_exercises_and_rest.sql` | User-created custom exercises + persistent per-exercise rest timers. |
| 005 | `migration_005_profiles.sql` | Profile fields: gender, date of birth, weight, for onboarding. |
| 006 | `migration_006_favorites.sql` | Favorite exercises. |
| 007 | `migration_007_height.sql` | Height field on profiles. |
| 008 | `migration_008_dots_percentile.sql` | DOTS score + real percentile ranking against other users. |
| 009 | `migration_009_feedback.sql` | Feedback table (in-app bug reports / feature requests). |
| 010 | `migration_010_admin_exercises.sql` | Admin visibility into user-submitted custom exercises. |
| 011 | `migration_011_exercise_media.sql` | Exercise demo photos/gifs, replacing the colored muscle dot. |
| 012 | `migration_012_supersets.sql` | Supersets — exercises sharing a `superset_group`. |
| 013 | `migration_013_admin_dismiss_and_feedback.sql` | Admin can dismiss a custom exercise from the review queue. |
| 014 | `migration_014_auto_promote.sql` | Auto-promote to shared library after 3+ independent submitters. **Removed in 031.** |
| 015 | `migration_015_delete_own_exercise.sql` | Lets a user delete their own custom exercise. |
| 016 | `migration_016_archive_exercise.sql` | Archiving a custom exercise (deletion is blocked once logged). |
| 017 | `migration_017_template_ordering.sql` | Manual reordering of the template list. |
| 018 | `migration_018_archive_template.sql` | Archiving templates, mirroring exercise archiving. |
| 019 | `migration_019_profile_name.sql` | Requires first + last name on profiles. |
| 020 | `migration_020_terms_acceptance.sql` | Terms & Conditions acceptance gate. |
| 021 | `migration_021_progress_photos.sql` | Optional progress photos alongside a bodyweight entry. |
| 022 | `migration_022_privacy_and_account_deletion.sql` | Privacy-request feedback type; self-service account deletion (`delete_own_account`). |
| 023 | `migration_023_feedback_management.sql` | Admin can actually manage/resolve feedback submissions. |
| 024 | `migration_024_exercise_aliases.sql` | Exercise search aliases; auto-dismiss known-alias submissions. |
| 025 | `migration_025_warmup_sets.sql` | Warmup sets. |
| 026 | `migration_026_announcements.sql` | Announcements system. |
| 027 | `migration_027_shared_templates.sql` | Template export/import via a short share code. |
| 028 | `migration_028_shared_workouts.sql` | Share a completed workout as a public link. |
| 029 | `migration_029_muscle_groups.sql` | Admin-managed muscle group taxonomy (Tier 1 / Generic). |
| 030 | `migration_030_admin_permissions.sql` | Admin user-permission management (`admin_search_users`, `admin_set_is_admin`). |
| 031 | `migration_031_remove_auto_promote.sql` | Removes 014's auto-promote trigger — promotion is admin-only now. |
| 032 | `migration_032_primary_muscles_array.sql` | Primary muscles become a multi-value array instead of one text field. |
| 033 | `migration_033_promote_consolidation.sql` | Personal notifications + full duplicate-promotion consolidation. |
| 034 | `migration_034_muscle_taxonomy.sql` | Scientific muscle taxonomy (Tier 3). |
| 035 | `migration_035_admin_insert_exercise.sql` | Admin can create a new exercise straight into the shared library. |
| 036 | `migration_036_exercise_library_overhaul.sql` | Full exercise library overhaul (CSV reimport, new columns). |
| 037 | `migration_037_exercise_library_column_reconciliation.sql` | Reconciles exercises table shape after the July 2026 CSV import. |
| — | *(038, 039 — unresolved gap, see README.md)* | |
| 040 | `migration_040_muscle_detailed_tier.sql` | Promotes "Detailed" into its own table — Tier 2 taxonomy. |
| 041 | `migration_041_rename_muscle_scientific.sql` | Safe rename-with-cascade RPC for scientific muscle names. |
| 042 | `migration_042_announcement_polls_archive.sql` | Announcement polls + archiving. |
| 043 | `migration_043_splits.sql` | Admin-managed workout splits (Push/Pull/Legs/Upper/Lower/etc). |
| 044 | `migration_044_referral_source.sql` | Optional "how did you hear about us?" field. |
| — | *(045 — superseded by 046, confirmed harmless, see README.md)* | |
| 046 | `migration_046_muscle_specific_tier.sql` | Fourth taxonomy tier ("Specific"), between Detailed and Scientific. |
| 047 | `migration_047_collapse_specific_tier.sql` | Collapses back to 3 taxonomy tiers (Specific tier removed). |
| 048 | `migration_048_user_activity.sql` | User activity tracking for the admin dashboard (`admin_get_user_activity`). |
| 049 | `migration_049_creator_role.sql` | Adds a Creator tier above Admin (only Creator can grant Admin). |
| 050 | `migration_050_fix_email_type_mismatch.sql` | Fixes a query-type-mismatch error in an admin RPC. |
| 051 | `migration_051_warmup_rest_seconds.sql` | Separate rest-timer override specifically for warmup sets. |
| 052 | `migration_052_referral_sources.sql` | Admin-only aggregate view of referral-source responses. |
| 053 | `migration_053_fix_activity_log_rls.sql` | Fixes a 403 on `log_app_open` (RLS policy gap). |
| 054 | `migration_054_exercise_submissions.sql` | Exercise submission history log (audit trail). |
| 055 | `migration_055_review_notifications.sql` | Admin review notifications; notified merge-as-alias. |
| 056 | `migration_056_backfill_via_aliases.sql` | Broadens the exercise_submissions backfill logic. |
| 057 | `migration_057_security_hardening.sql` | Security Advisor fixes — dropped an exposed view, closed two enumerable share tables, pinned a missing search_path, tightened admin RPC grants. **Not yet run live as of this index — see README.md.** |
| 058 | `migration_058_fix_muscle_group_sync.sql` | Fixes the (previously undocumented) `sync_exercise_muscle_group` trigger — removes the "3+ buckets = auto Full Body" rule and the invalid "X / Y" bucket string, backfills existing rows. |
| 059 | `migration_059_drop_metrics_table.sql` | Drops the empty, unreferenced `Metrics` table found during the live reconciliation. |

## Tools (not part of the sequence — never run automatically, no number)

| File | What it does |
|---|---|
| `tools/reset_templates_tables.sql` | Break-glass recovery for migration_003 only — drops + recreates `workout_templates`/`template_exercises`. |
| `tools/diagnostics_taxonomy_audit.sql` | Read-only — verifies the 4-tier muscle taxonomy after migration_046. |
| `tools/report_exercise_gaps.sql` | Read-only — finds exercises with no equivalent after migration_036's reimport. |

## Resolved / closed

- **`Metrics` table** — confirmed empty (0 rows) via live query, dropped in migration_059.
- **038, 039 gap** — no memory of them, nothing else references them. Closed as "claimed and abandoned before ever running." No action needed.
