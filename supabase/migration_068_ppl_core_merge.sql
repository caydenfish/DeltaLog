-- Fix: Push/Pull/Legs (and Lower) never included Core in the original
-- seed (migration_043) — only Full Body did. So an ab/core exercise
-- never surfaces under any PPL-day filter (generator quick-select,
-- exercise picker split filter), even though most PPL programs expect
-- core work folded into one or more of those days. Adding Core to all
-- three PPL days plus Lower, rather than picking just one, since there's
-- no single universal convention for which day owns it and this keeps
-- it available everywhere a person might look for it.
insert into split_muscles (split_id, muscle_group)
select s.id, v.muscle
from splits s
join (values
  ('Push', 'Core'),
  ('Pull', 'Core'),
  ('Legs', 'Core'),
  ('Lower', 'Core')
) as v(split_name, muscle) on v.split_name = s.name
on conflict do nothing;
