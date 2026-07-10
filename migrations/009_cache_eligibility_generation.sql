-- Eligibility changes must invalidate cached public price and PIN results.

create or replace function bump_price_data_generation()
returns trigger
language plpgsql
as $$
begin
  insert into data_generation (namespace, generation, updated_at)
  values ('prices', 1, now())
  on conflict (namespace) do update
    set generation = data_generation.generation + 1,
        updated_at = now();
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists source_catalog_price_generation on source_catalog;
create trigger source_catalog_price_generation
after update of active, public_display_enabled, rights_status on source_catalog
for each row
when (
  old.active is distinct from new.active
  or old.public_display_enabled is distinct from new.public_display_enabled
  or old.rights_status is distinct from new.rights_status
)
execute function bump_price_data_generation();

drop trigger if exists outlet_dim_price_generation on outlet_dim;
create trigger outlet_dim_price_generation
after update of active on outlet_dim
for each row
when (old.active is distinct from new.active)
execute function bump_price_data_generation();

drop trigger if exists fuel_dim_price_generation on fuel_dim;
create trigger fuel_dim_price_generation
after update of active on fuel_dim
for each row
when (old.active is distinct from new.active)
execute function bump_price_data_generation();
