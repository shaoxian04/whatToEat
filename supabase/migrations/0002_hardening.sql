-- whatToEat hardening: atomic session creation, per-browser voter ids,
-- expired-session cleanup, and no direct browser reads.

-- 1) Per-browser voter id. A name alone let anyone vote as someone else, and
--    let one person vote again under a new name. Legacy rows get a synthetic id.
alter table votes add column if not exists voter_id text;
update votes set voter_id = 'legacy:' || voter_name where voter_id is null;
alter table votes alter column voter_id set not null;
alter table votes drop constraint if exists votes_session_id_option_id_voter_name_key;
alter table votes add constraint votes_session_option_voter_key unique (session_id, option_id, voter_id);
create index if not exists idx_votes_session_name on votes(session_id, voter_name);

-- 2) Browsers no longer read Supabase directly: the app polls its own API
--    (service role). Drop the anon read policies so the anon key cannot list
--    every session and voter name.
drop policy if exists "anon read sessions" on sessions;
drop policy if exists "anon read options"  on session_options;
drop policy if exists "anon read votes"    on votes;
revoke all on sessions, session_options, votes from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and tablename = 'votes') then
    alter publication supabase_realtime drop table votes;
  end if;
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and tablename = 'sessions') then
    alter publication supabase_realtime drop table sessions;
  end if;
end $$;

-- 3) Atomic session creation (session + options + host secret in one
--    transaction), with opportunistic cleanup of sessions expired > 7 days.
create or replace function create_vote_session(p_host_name text, p_options jsonb)
returns table (session_id uuid, host_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_host_token uuid;
begin
  delete from sessions where expires_at < now() - interval '7 days';

  insert into sessions (host_name) values (p_host_name) returning id into v_session_id;

  insert into session_options (session_id, name, place_id, snapshot)
  select v_session_id, o->>'name', o->>'placeId', nullif(o->'snapshot', 'null'::jsonb)
  from jsonb_array_elements(p_options) as o;

  insert into session_secrets (session_id) values (v_session_id)
  returning session_secrets.host_token into v_host_token;

  return query select v_session_id, v_host_token;
end;
$$;

revoke execute on function create_vote_session(text, jsonb) from public, anon, authenticated;
grant execute on function create_vote_session(text, jsonb) to service_role;
