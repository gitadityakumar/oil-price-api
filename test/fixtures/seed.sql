-- Minimal idempotent fixture entrypoint for Task 10 integration tests.
-- The full fixture dataset lives in migrations/002, 004, and 005.

insert into fuel_dim (fuel_code, display_name, retail_unit, active)
values
  ('PETROL', 'Petrol', 'LTR', true),
  ('DIESEL', 'Diesel', 'LTR', true),
  ('CNG', 'CNG', 'KG', true),
  ('PNG', 'PNG', 'SCM', true)
on conflict (fuel_code) do update set
  display_name = excluded.display_name,
  retail_unit = excluded.retail_unit,
  active = excluded.active;
