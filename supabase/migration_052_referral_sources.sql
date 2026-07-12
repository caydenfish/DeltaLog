-- Admin-only aggregate view of "how did you hear about us?" responses,
-- so marketing spend can be pointed at whatever's actually converting
-- instead of guessing. Same security-definer pattern as
-- admin_get_user_activity (migration_048): profiles has no public select
-- policy for other people's rows, so reading everyone's heard_about_us
-- has to go through a function that bypasses RLS after checking is_admin.
--
-- Grouping is case/whitespace-normalized (trim + lower) so "Reddit",
-- "reddit ", and "REDDIT" roll up into one bucket instead of splintering
-- the count across near-duplicates, while still displaying a clean,
-- human-cased label (the most common original casing for that bucket).
create or replace function admin_get_referral_sources()
returns table (
  source text,
  count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      (array_agg(p.heard_about_us order by p.created_at))[1] as source,
      count(*) as count
    from profiles p
    where p.heard_about_us is not null and trim(p.heard_about_us) <> ''
    group by lower(trim(p.heard_about_us))
    union all
    select 'Not specified' as source, count(*) as count
    from profiles p
    where p.heard_about_us is null or trim(p.heard_about_us) = ''
    having count(*) > 0
    order by count desc;
end;
$$;

grant execute on function admin_get_referral_sources() to authenticated;
