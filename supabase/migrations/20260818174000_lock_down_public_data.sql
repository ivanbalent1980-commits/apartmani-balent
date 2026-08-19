begin;

do $$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array[
    'airbnb_ical_sources',
    'atrakcije',
    'cjenik',
    'popup_akcije',
    'poruke',
    'pravila_kalendara',
    'rashodi',
    'recenzije',
    'rezervacije',
    'sadrzaj',
    'uplate',
    'vrste_rashoda',
    'rezervacije_audit'
  ] loop
    if to_regclass('public.' || target_table) is not null then
      for policy_row in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = target_table
      loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, target_table);
      end loop;

      execute format('alter table public.%I enable row level security', target_table);
      execute format('revoke all on table public.%I from anon', target_table);
      execute format('grant select, insert, update, delete on table public.%I to authenticated', target_table);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin())',
        'balent_dashboard_admin_all',
        target_table
      );
    end if;
  end loop;
end
$$;

grant select on table public.atrakcije to anon;
grant select on table public.cjenik to anon;
grant select on table public.popup_akcije to anon;
grant select on table public.pravila_kalendara to anon;
grant select on table public.recenzije to anon;
grant select on table public.sadrzaj to anon;

create policy balent_public_read_active_attractions
  on public.atrakcije for select to anon using (aktivan = true);
create policy balent_public_read_active_prices
  on public.cjenik for select to anon using (aktivan = true);
create policy balent_public_read_active_popup
  on public.popup_akcije for select to anon using (aktivan = true);
create policy balent_public_read_active_calendar_rules
  on public.pravila_kalendara for select to anon using (aktivan = true);
create policy balent_public_read_active_reviews
  on public.recenzije for select to anon using (aktivan = true);
create policy balent_public_read_content
  on public.sadrzaj for select to anon using (true);

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

commit;
