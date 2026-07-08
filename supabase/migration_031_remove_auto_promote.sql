-- Migration: remove auto-promotion.
-- Custom exercises should never reach the shared library except by an
-- admin explicitly promoting them (AdminExercises' review queue) — the
-- old 3-independent-creators auto-promote trigger bypassed that review
-- entirely. promoteExerciseToLibrary() already does exactly what
-- promotion should (created_by -> null, admin_reviewed -> true), so
-- nothing else changes; this just removes the automatic path.
drop trigger if exists trg_auto_promote_custom_exercise on exercises;
drop function if exists auto_promote_custom_exercise();
