-- whatToEat group voting schema
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  host_name text not null,
  status text not null default 'open' check (status in ('open','closed')),
  winner_option_id uuid,
  expires_at timestamptz not null default (now() + interval '1 day'),
  user_id uuid -- nullable: accounts-ready hook, unused in this plan
);

create table if not exists session_options (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  place_id text,            -- nullable: free-text Quick-vote options have none
  name text not null,
  snapshot jsonb
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  option_id uuid not null references session_options(id) on delete cascade,
  voter_name text not null,
  type text not null check (type in ('up','veto')),
  created_at timestamptz not null default now(),
  unique (session_id, option_id, voter_name)
);

create index if not exists idx_options_session on session_options(session_id);
create index if not exists idx_votes_session on votes(session_id);

-- winner references a real option (added post-creation: session_options is defined after sessions)
alter table sessions
  add constraint sessions_winner_option_fk
  foreign key (winner_option_id) references session_options(id) on delete set null;

create index if not exists idx_votes_option on votes(option_id);

-- Row Level Security: anonymous users may READ only. No anon write policies exist,
-- so INSERT/UPDATE/DELETE are denied for anon. The service-role key bypasses RLS.
alter table sessions enable row level security;
alter table session_options enable row level security;
alter table votes enable row level security;

create policy "anon read sessions"  on sessions        for select to anon using (true);
create policy "anon read options"   on session_options for select to anon using (true);
create policy "anon read votes"     on votes           for select to anon using (true);

-- Realtime: browsers subscribe to vote inserts and session status changes.
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table sessions;
