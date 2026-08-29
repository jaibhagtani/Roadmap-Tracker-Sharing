create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists sessions (
  id varchar(64) primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash varchar(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_exp_idx on sessions(user_id, expires_at);
create table if not exists password_reset_tokens (
  id varchar(64) primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_user_exp_idx on password_reset_tokens(user_id, expires_at);

do $$ begin create type status as enum ('not_started','in_progress','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type privacy as enum ('private','link','public'); exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id varchar(255) primary key,
  full_name text not null default '',
  avatar_url text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  owner_id varchar(255) not null,
  title text not null,
  description text not null default '',
  privacy privacy not null default 'private',
  share_slug text not null unique default encode(gen_random_bytes(12),'hex'),
  share_password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  parent_id uuid references topics(id) on delete cascade,
  title text not null,
  description text not null default '',
  notes text not null default '',
  status status not null default 'not_started',
  progress int not null default 0 check(progress between 0 and 100),
  priority int not null default 0 check(priority between 0 and 5),
  position int not null default 0 check(position >= 0),
  tags text[] not null default '{}',
  due_date date,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table if exists topics add column if not exists share_token text;
create unique index if not exists topics_share_token_key on topics(share_token) where share_token is not null;
create table if not exists user_topic_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  status text not null default 'learning' check(status in ('learning','done','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, topic_id)
);
create index if not exists user_topic_progress_user_idx on user_topic_progress(user_id, updated_at desc);
create index if not exists user_topic_progress_topic_idx on user_topic_progress(topic_id);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  title text not null,
  url text not null,
  type text not null default 'other',
  notes text not null default '',
  completed boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id varchar(255) not null,
  log_date date not null,
  study_minutes int not null default 0 check(study_minutes between 0 and 1440),
  topics_studied text[] not null default '{}',
  resources_completed int not null default 0,
  problems_solved int not null default 0,
  learned text not null default '',
  difficulties text not null default '',
  tomorrow_goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, log_date)
);
create table if not exists goals (
  id uuid primary key default gen_random_uuid(), owner_id varchar(255) not null, roadmap_id uuid references roadmaps(id) on delete cascade,
  title text not null, description text not null default '', deadline date, progress int not null default 0 check(progress between 0 and 100), status status not null default 'in_progress', created_at timestamptz not null default now()
);
create table if not exists templates (
  id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', tree jsonb not null default '[]', created_at timestamptz not null default now()
);
create table if not exists roadmap_shares (
  id uuid primary key default gen_random_uuid(), roadmap_id uuid not null references roadmaps(id) on delete cascade, user_id varchar(255) not null, created_at timestamptz not null default now(), unique(roadmap_id,user_id)
);
create table if not exists share_requests (
  id uuid primary key default gen_random_uuid(), roadmap_id uuid not null references roadmaps(id) on delete cascade,
  sender_id varchar(255) not null, receiver_id varchar(255) not null, message text not null default '',
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(), user_id varchar(255) not null, type text not null,
  title text not null, body text not null default '', share_request_id uuid references share_requests(id) on delete cascade,
  read_at timestamptz, created_at timestamptz not null default now()
);

alter table profiles add column if not exists updated_at timestamptz not null default now();
alter table resources add column if not exists updated_at timestamptz not null default now();
alter table daily_logs add column if not exists updated_at timestamptz not null default now();
alter table todos add column if not exists visibility text not null default 'private';
alter table todos add constraint todos_visibility_check check (visibility in ('private','friends'));
alter table share_requests add column if not exists updated_at timestamptz not null default now();

create index topics_tree_idx on topics(roadmap_id,parent_id,position);
create index resources_topic_idx on resources(topic_id);
create index daily_logs_owner_date_idx on daily_logs(owner_id,log_date);
create index roadmaps_owner_updated_idx on roadmaps(owner_id,updated_at desc);
create index roadmap_shares_user_idx on roadmap_shares(user_id);
create index share_requests_receiver_idx on share_requests(receiver_id,status,created_at desc);
create index notifications_user_idx on notifications(user_id,read_at,created_at desc);

create or replace function app_user_id() returns varchar language sql stable as $$ select current_setting('app.user_id', true) $$;
create or replace function app_is_roadmap_owner(p_roadmap uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from roadmaps where id=p_roadmap and owner_id=app_user_id()) $$;
create or replace function app_is_roadmap_member(p_roadmap uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from roadmap_shares where roadmap_id=p_roadmap and user_id=app_user_id()) $$;
create or replace function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

do $$ begin
  create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
  create trigger roadmaps_touch before update on roadmaps for each row execute function touch_updated_at();
  create trigger topics_touch before update on topics for each row execute function touch_updated_at();
  create trigger resources_touch before update on resources for each row execute function touch_updated_at();
  create trigger daily_logs_touch before update on daily_logs for each row execute function touch_updated_at();
  create trigger share_requests_touch before update on share_requests for each row execute function touch_updated_at();
  create trigger user_topic_progress_touch before update on user_topic_progress for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

insert into templates(name,description,tree) values
('Software Engineer','Core software engineering path','[{"title":"DSA","children":[{"title":"Arrays"},{"title":"Trees"},{"title":"Dynamic Programming"}]},{"title":"HLD","children":[{"title":"Scalability"},{"title":"Caching"},{"title":"Message Queues"}]},{"title":"LLD","children":[{"title":"OOP"},{"title":"Design Patterns"}]},{"title":"DBMS","children":[{"title":"SQL"},{"title":"Indexes"},{"title":"Transactions"}]},{"title":"Operating Systems"},{"title":"Computer Networks"},{"title":"Backend Development","children":[{"title":"APIs"},{"title":"Authentication"},{"title":"Distributed Systems"}]},{"title":"DevOps","children":[{"title":"Docker"},{"title":"CI/CD"},{"title":"Cloud"}]}]'),
('Backend Engineer','Backend-first roadmap','[{"title":"Programming","children":[{"title":"JavaScript/TypeScript"},{"title":"Java"}]},{"title":"API Design"},{"title":"Databases","children":[{"title":"PostgreSQL"},{"title":"Redis"}]},{"title":"Caching"},{"title":"Queues"},{"title":"Distributed Systems"},{"title":"Observability"},{"title":"Cloud"}]'),
('Frontend Engineer','Modern frontend roadmap','[{"title":"HTML & CSS"},{"title":"JavaScript","children":[{"title":"Async Programming"},{"title":"DOM"}]},{"title":"React","children":[{"title":"State Management"},{"title":"Server Components"}]},{"title":"Testing"},{"title":"Performance"},{"title":"Accessibility"}]'),
('DevOps','DevOps and cloud roadmap','[{"title":"Linux"},{"title":"Git"},{"title":"Docker"},{"title":"Kubernetes"},{"title":"CI/CD"},{"title":"Cloud","children":[{"title":"AWS"},{"title":"Networking"}]},{"title":"Observability"}]'),
('System Design','HLD-focused roadmap','[{"title":"Requirements"},{"title":"Capacity Estimation"},{"title":"APIs"},{"title":"Databases"},{"title":"Caching"},{"title":"Message Queues"},{"title":"Load Balancing"},{"title":"Consistency & Availability"},{"title":"Case Studies"}]'),
('DSA','Data structures and algorithms roadmap','[{"title":"Arrays"},{"title":"Strings"},{"title":"Linked Lists"},{"title":"Stacks & Queues"},{"title":"Trees"},{"title":"Graphs"},{"title":"Heaps"},{"title":"Greedy"},{"title":"Dynamic Programming"}]')
on conflict(name) do update set description=excluded.description, tree=excluded.tree;

alter table profiles enable row level security; alter table roadmaps enable row level security; alter table topics enable row level security; alter table resources enable row level security; alter table daily_logs enable row level security; alter table goals enable row level security; alter table templates enable row level security; alter table roadmap_shares enable row level security; alter table share_requests enable row level security; alter table notifications enable row level security;
alter table profiles force row level security; alter table roadmaps force row level security; alter table topics force row level security; alter table resources force row level security; alter table daily_logs force row level security; alter table goals force row level security; alter table templates force row level security; alter table roadmap_shares force row level security; alter table share_requests force row level security; alter table notifications force row level security;

drop policy if exists profiles_owner on profiles;
drop policy if exists roadmaps_owner on roadmaps;
drop policy if exists roadmaps_public on roadmaps;
drop policy if exists roadmaps_link on roadmaps;
drop policy if exists roadmaps_member on roadmaps;
drop policy if exists topics_owner on topics;
drop policy if exists topics_shared on topics;
drop policy if exists resources_owner on resources;
drop policy if exists resources_shared on resources;
drop policy if exists logs_owner on daily_logs;
drop policy if exists goals_owner on goals;
drop policy if exists templates_read on templates;
drop policy if exists shares_owner_member_update on roadmap_shares;
drop policy if exists shares_owner_member_delete on roadmap_shares;
drop policy if exists shares_insert on roadmap_shares;
drop policy if exists shares_self_read on roadmap_shares;
drop policy if exists requests_select on share_requests;
drop policy if exists requests_insert on share_requests;
drop policy if exists requests_update on share_requests;
drop policy if exists notifications_owner_select on notifications;
drop policy if exists notifications_owner_update on notifications;
drop policy if exists notifications_owner_delete on notifications;
drop policy if exists notifications_insert_related on notifications;

create policy profiles_owner on profiles for all using (id=app_user_id()) with check (id=app_user_id());
create policy roadmaps_owner on roadmaps for all using (owner_id=app_user_id()) with check (owner_id=app_user_id());
create policy roadmaps_public on roadmaps for select using (privacy='public');
create policy roadmaps_link on roadmaps for select using (privacy='link');
create policy roadmaps_member on roadmaps for select using (app_is_roadmap_member(id));
create policy topics_owner on topics for all using (app_is_roadmap_owner(roadmap_id)) with check (app_is_roadmap_owner(roadmap_id));
create policy topics_shared on topics for select using ((exists(select 1 from roadmaps r where r.id=roadmap_id and r.privacy in ('public','link'))) or app_is_roadmap_member(roadmap_id));
create policy resources_owner on resources for all using (app_is_roadmap_owner((select roadmap_id from topics t where t.id=topic_id))) with check (app_is_roadmap_owner((select roadmap_id from topics t where t.id=topic_id)));
create policy resources_shared on resources for select using (exists(select 1 from topics t where t.id=topic_id and ((select privacy from roadmaps r where r.id=t.roadmap_id) in ('public','link') or app_is_roadmap_member(t.roadmap_id))));
create policy logs_owner on daily_logs for all using (owner_id=app_user_id()) with check (owner_id=app_user_id());
create policy goals_owner on goals for all using (owner_id=app_user_id()) with check (owner_id=app_user_id());
create policy templates_read on templates for select using (true);
create policy shares_self_read on roadmap_shares for select using (user_id=app_user_id() or app_is_roadmap_owner(roadmap_id));
create policy shares_insert on roadmap_shares for insert with check (app_is_roadmap_owner(roadmap_id) or (user_id=app_user_id() and exists(select 1 from share_requests sr where sr.roadmap_id=roadmap_shares.roadmap_id and sr.receiver_id=app_user_id() and sr.status='accepted')));
create policy shares_owner_member_update on roadmap_shares for update using (user_id=app_user_id() or app_is_roadmap_owner(roadmap_id)) with check (user_id=app_user_id() or app_is_roadmap_owner(roadmap_id));
create policy shares_owner_member_delete on roadmap_shares for delete using (user_id=app_user_id() or app_is_roadmap_owner(roadmap_id));
create policy requests_select on share_requests for select using (sender_id=app_user_id() or receiver_id=app_user_id());
create policy requests_insert on share_requests for insert with check (sender_id=app_user_id());
create policy requests_update on share_requests for update using (sender_id=app_user_id() or receiver_id=app_user_id()) with check (sender_id=app_user_id() or receiver_id=app_user_id());
create policy notifications_owner_select on notifications for select using (user_id=app_user_id());
create policy notifications_owner_update on notifications for update using (user_id=app_user_id()) with check (user_id=app_user_id());
create policy notifications_owner_delete on notifications for delete using (user_id=app_user_id());
create policy notifications_insert_related on notifications for insert with check (user_id=app_user_id() or (share_request_id is not null and exists(select 1 from share_requests sr where sr.id=notifications.share_request_id and sr.sender_id=app_user_id() and sr.receiver_id=notifications.user_id)));

-- v2: calendar todos + scoped sharing + clone support
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  owner_id varchar(255) not null,
  roadmap_id uuid references roadmaps(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  todo_date date not null,
  title text not null,
  notes text not null default '',
  completed boolean not null default false,
  priority int not null default 0 check(priority between 0 and 3),
  position int not null default 0 check(position >= 0),
  visibility text not null default 'private' check(visibility in ('private','friends')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table todos add column if not exists priority int not null default 0;
alter table todos drop constraint if exists todos_priority_check;
alter table todos add constraint todos_priority_check check(priority between 0 and 3);
create index if not exists todos_owner_date_idx on todos(owner_id,todo_date,position);

create table if not exists topic_shares (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  user_id varchar(255) not null,
  created_at timestamptz not null default now(),
  unique(topic_id,user_id)
);
create index if not exists topic_shares_user_idx on topic_shares(user_id);

create table if not exists template_shares (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  user_id varchar(255) not null,
  created_at timestamptz not null default now(),
  unique(template_id,user_id)
);
create index if not exists template_shares_user_idx on template_shares(user_id);

alter table share_requests add column if not exists root_topic_id uuid references topics(id) on delete cascade;
alter table share_requests add column if not exists template_id uuid references templates(id) on delete cascade;
alter table share_requests add column if not exists scope_type text not null default 'roadmap';
alter table share_requests alter column roadmap_id drop not null;
create index if not exists share_requests_scope_idx on share_requests(roadmap_id,root_topic_id,receiver_id,status);

-- Replace the old request FK semantics with scope-safe validation.
drop policy if exists todos_owner_select on todos;
drop policy if exists todos_owner_insert on todos;
drop policy if exists todos_owner_update on todos;
drop policy if exists todos_owner_delete on todos;
create policy todos_owner_select on todos for select using (owner_id=app_user_id() or (visibility='friends' and roadmap_id is not null and exists(select 1 from roadmap_shares rs where rs.roadmap_id=todos.roadmap_id and rs.user_id=app_user_id())));
create policy todos_owner_insert on todos for insert with check (owner_id=app_user_id());
create policy todos_owner_update on todos for update using (owner_id=app_user_id()) with check (owner_id=app_user_id());
create policy todos_owner_delete on todos for delete using (owner_id=app_user_id());

alter table todos enable row level security;
alter table topic_shares enable row level security;
alter table template_shares enable row level security;

create policy topic_shares_owner_select on topic_shares for select using (
  user_id=app_user_id() or exists(select 1 from topics t join roadmaps r on r.id=t.roadmap_id where t.id=topic_shares.topic_id and r.owner_id=app_user_id())
);
create policy topic_shares_owner_insert on topic_shares for insert with check (
  exists(select 1 from topics t join roadmaps r on r.id=t.roadmap_id where t.id=topic_shares.topic_id and r.owner_id=app_user_id())
);
create policy topic_shares_receiver_delete on topic_shares for delete using (user_id=app_user_id() or exists(select 1 from topics t join roadmaps r on r.id=t.roadmap_id where t.id=topic_shares.topic_id and r.owner_id=app_user_id()));

create policy template_shares_owner_select on template_shares for select using (user_id=app_user_id());
create policy template_shares_owner_insert on template_shares for insert with check (user_id=app_user_id());
create policy template_shares_receiver_delete on template_shares for delete using (user_id=app_user_id());

-- The Prisma server uses the same application transaction GUC for RLS.

create or replace function app_is_topic_member(p_topic uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from topic_shares ts where ts.topic_id=p_topic and ts.user_id=app_user_id())
$$;
create or replace function app_is_topic_tree_member(p_topic uuid) returns boolean language sql stable security definer set search_path=public as $$
  with recursive tree as (
    select t.id,t.parent_id from topics t where t.id in (select topic_id from topic_shares where user_id=app_user_id())
    union all
    select c.id,c.parent_id from topics c join tree p on c.parent_id=p.id
  ) select exists(select 1 from tree where id=p_topic)
$$;
drop policy if exists roadmaps_member on roadmaps;
create policy roadmaps_member on roadmaps for select using (app_is_roadmap_member(id) or exists(select 1 from topics t where t.roadmap_id=roadmaps.id and app_is_topic_tree_member(t.id)));
drop policy if exists topics_shared on topics;
create policy topics_shared on topics for select using ((exists(select 1 from roadmaps r where r.id=roadmap_id and r.privacy in ('public','link'))) or app_is_roadmap_member(roadmap_id) or app_is_topic_tree_member(id));
drop policy if exists resources_shared on resources;
create policy resources_shared on resources for select using (exists(select 1 from topics t where t.id=topic_id and ((select privacy from roadmaps r where r.id=t.roadmap_id) in ('public','link') or app_is_roadmap_member(t.roadmap_id) or app_is_topic_tree_member(t.id))));


-- Auth tables are server-only; application routes authenticate through sessions before using withRls().
-- Seed users are intentionally not created in the database.

-- v3: production collaboration, roles, versioned change log, and shared chat
alter table roadmaps add column if not exists version int not null default 0;
alter table roadmaps add column if not exists editor_state jsonb not null default '{}'::jsonb;
alter table roadmap_shares add column if not exists role text not null default 'editor';
alter table topic_shares add column if not exists role text not null default 'editor';

create table if not exists collaboration_events (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  actor_id varchar(255) not null,
  version int not null,
  operation text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(roadmap_id, version)
);
create index if not exists collaboration_events_roadmap_created_idx on collaboration_events(roadmap_id, created_at desc);

create table if not exists collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  author_id varchar(255) not null,
  body text not null check(length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collaboration_messages_roadmap_created_idx on collaboration_messages(roadmap_id, created_at desc);

alter table collaboration_events enable row level security;
alter table collaboration_messages enable row level security;

drop policy if exists collaboration_events_select on collaboration_events;
create policy collaboration_events_select on collaboration_events for select using (
  app_is_roadmap_member(roadmap_id)
  or app_is_roadmap_owner(roadmap_id)
  or exists(select 1 from topics t where t.roadmap_id=collaboration_events.roadmap_id and app_is_topic_tree_member(t.id))
);

-- API performs the final role check. RLS only allows authenticated members/owners to insert.
drop policy if exists collaboration_events_insert on collaboration_events;
create policy collaboration_events_insert on collaboration_events for insert with check (
  actor_id=app_user_id() and (
    app_is_roadmap_owner(roadmap_id)
    or app_is_roadmap_member(roadmap_id)
    or exists(select 1 from topics t where t.roadmap_id=collaboration_events.roadmap_id and app_is_topic_tree_member(t.id))
  )
);

drop policy if exists collaboration_messages_select on collaboration_messages;
create policy collaboration_messages_select on collaboration_messages for select using (
  app_is_roadmap_owner(roadmap_id) or app_is_roadmap_member(roadmap_id)
  or exists(select 1 from topics t where t.roadmap_id=collaboration_messages.roadmap_id and app_is_topic_tree_member(t.id))
);
drop policy if exists collaboration_messages_insert on collaboration_messages;
create policy collaboration_messages_insert on collaboration_messages for insert with check (
  author_id=app_user_id() and (
    app_is_roadmap_owner(roadmap_id) or app_is_roadmap_member(roadmap_id)
    or exists(select 1 from topics t where t.roadmap_id=collaboration_messages.roadmap_id and app_is_topic_tree_member(t.id))
  )
);
drop policy if exists collaboration_messages_update on collaboration_messages;
create policy collaboration_messages_update on collaboration_messages for update using (author_id=app_user_id()) with check (author_id=app_user_id());
drop policy if exists collaboration_messages_delete on collaboration_messages;
create policy collaboration_messages_delete on collaboration_messages for delete using (author_id=app_user_id());

-- Recreate share policies so recipients can store an explicit role.
drop policy if exists shares_insert on roadmap_shares;
create policy shares_insert on roadmap_shares for insert with check (
  app_is_roadmap_owner(roadmap_id) or (
    user_id=app_user_id() and exists(select 1 from share_requests sr where sr.roadmap_id=roadmap_shares.roadmap_id and sr.receiver_id=app_user_id() and sr.status='accepted')
  )
);
drop policy if exists topic_shares_owner_insert on topic_shares;
create policy topic_shares_owner_insert on topic_shares for insert with check (
  exists(select 1 from topics t join roadmaps r on r.id=t.roadmap_id where t.id=topic_shares.topic_id and r.owner_id=app_user_id())
  or (user_id=app_user_id() and exists(select 1 from share_requests sr where sr.root_topic_id=topic_shares.topic_id and sr.receiver_id=app_user_id() and sr.status='accepted'))
);
alter table share_requests add column if not exists role text not null default 'editor';

-- v3 continued: lightweight presence for live collaboration
create table if not exists collaboration_presence (
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  user_id varchar(255) not null,
  last_seen timestamptz not null default now(),
  primary key (roadmap_id, user_id)
);
create index if not exists collaboration_presence_roadmap_seen_idx on collaboration_presence(roadmap_id, last_seen desc);
alter table collaboration_presence enable row level security;
drop policy if exists collaboration_presence_select on collaboration_presence;
create policy collaboration_presence_select on collaboration_presence for select using (
  app_is_roadmap_owner(roadmap_id) or app_is_roadmap_member(roadmap_id)
  or exists(select 1 from topics t where t.roadmap_id=collaboration_presence.roadmap_id and app_is_topic_tree_member(t.id))
);
drop policy if exists collaboration_presence_upsert on collaboration_presence;
create policy collaboration_presence_upsert on collaboration_presence for insert with check (user_id=app_user_id());
drop policy if exists collaboration_presence_update on collaboration_presence;
create policy collaboration_presence_update on collaboration_presence for update using (user_id=app_user_id()) with check (user_id=app_user_id());

-- Fix scoped topic-share grants for descendants and Prisma upserts.
create or replace function app_is_accepted_topic_grant(p_topic uuid) returns boolean
language sql stable security definer set search_path=public as $$
  with recursive allowed as (
    select sr.root_topic_id as id
    from share_requests sr
    where sr.receiver_id=app_user_id() and sr.status='accepted' and sr.root_topic_id is not null
    union all
    select t.id
    from topics t join allowed a on t.parent_id=a.id
  )
  select exists(select 1 from allowed where id=p_topic)
$$;

drop policy if exists topic_shares_owner_insert on topic_shares;
create policy topic_shares_owner_insert on topic_shares for insert with check (
  exists(select 1 from topics t join roadmaps r on r.id=t.roadmap_id where t.id=topic_shares.topic_id and r.owner_id=app_user_id())
  or (user_id=app_user_id() and app_is_accepted_topic_grant(topic_shares.topic_id))
);
drop policy if exists topic_shares_receiver_update on topic_shares;
create policy topic_shares_receiver_update on topic_shares for update using (user_id=app_user_id()) with check (user_id=app_user_id() and app_is_accepted_topic_grant(topic_shares.topic_id));

drop policy if exists notifications_insert_related on notifications;
create policy notifications_insert_related on notifications for insert with check (
  user_id=app_user_id()
  or (
    share_request_id is not null and exists(
      select 1 from share_requests sr
      where sr.id=notifications.share_request_id
        and ((sr.sender_id=app_user_id() and sr.receiver_id=notifications.user_id)
          or (sr.receiver_id=app_user_id() and sr.sender_id=notifications.user_id))
    )
  )
);

-- v4: GitHub-style leader/collaborator workflow
alter table roadmap_shares add column if not exists role text not null default 'contributor';
update roadmap_shares set role='contributor' where role='editor';
alter table topic_shares add column if not exists role text not null default 'contributor';
update topic_shares set role='contributor' where role='editor';

alter table share_requests add column if not exists request_type text not null default 'share';
create index if not exists share_requests_request_type_idx on share_requests(request_type,status,created_at desc);

create table if not exists collab_branches (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  owner_id varchar(255) not null,
  name text not null,
  root_topic_id uuid references topics(id) on delete set null,
  base_version int not null,
  version int not null default 0,
  status text not null default 'open',
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(roadmap_id,owner_id,name)
);
create index if not exists collab_branches_roadmap_idx on collab_branches(roadmap_id,status,updated_at desc);
create index if not exists collab_branches_owner_idx on collab_branches(owner_id,status,updated_at desc);

create table if not exists collab_commits (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references collab_branches(id) on delete cascade,
  author_id varchar(255) not null,
  message text not null,
  base_version int not null,
  snapshot jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  merged_at timestamptz,
  merged_by varchar(255)
);
create index if not exists collab_commits_branch_idx on collab_commits(branch_id,created_at desc);
create index if not exists collab_commits_status_idx on collab_commits(status,created_at desc);

alter table collab_branches enable row level security;
alter table collab_commits enable row level security;


create policy collab_branches_select on collab_branches for select using (owner_id=app_user_id() or app_is_roadmap_member(roadmap_id));
create policy collab_branches_insert on collab_branches for insert with check (owner_id=app_user_id());
create policy collab_branches_update on collab_branches for update using (owner_id=app_user_id() or app_is_roadmap_owner(roadmap_id));
create policy collab_branches_delete on collab_branches for delete using (owner_id=app_user_id() or app_is_roadmap_owner(roadmap_id));

create policy collab_commits_select on collab_commits for select using (author_id=app_user_id() or exists(select 1 from collab_branches b where b.id=collab_commits.branch_id and app_is_roadmap_owner(b.roadmap_id)) or exists(select 1 from collab_branches b where b.id=collab_commits.branch_id and app_is_roadmap_member(b.roadmap_id)));
create policy collab_commits_insert on collab_commits for insert with check (author_id=app_user_id());
create policy collab_commits_update on collab_commits for update using (author_id=app_user_id() or exists(select 1 from collab_branches b where b.id=collab_commits.branch_id and app_is_roadmap_owner(b.roadmap_id)));

-- v4.1: contributor role and join-request acceptance direction
update roadmap_shares set role='contributor' where role='editor';
update topic_shares set role='contributor' where role='editor';
drop policy if exists shares_insert on roadmap_shares;
create policy shares_insert on roadmap_shares for insert with check (
  app_is_roadmap_owner(roadmap_id)
  or (user_id=app_user_id() and exists(select 1 from share_requests sr where sr.roadmap_id=roadmap_shares.roadmap_id and sr.receiver_id=app_user_id() and sr.status='accepted' and sr.request_type='share'))
  or (exists(select 1 from share_requests sr where sr.roadmap_id=roadmap_shares.roadmap_id and sr.sender_id=user_id and sr.receiver_id=app_user_id() and sr.status='accepted' and sr.request_type='join'))
);

drop policy if exists collab_branches_select on collab_branches;
create policy collab_branches_select on collab_branches for select using (
  owner_id=app_user_id() or app_is_roadmap_member(roadmap_id) or (root_topic_id is not null and app_is_topic_tree_member(root_topic_id)) or app_is_roadmap_owner(roadmap_id)
);
drop policy if exists collab_commits_select on collab_commits;
create policy collab_commits_select on collab_commits for select using (
  author_id=app_user_id()
  or exists(select 1 from collab_branches b where b.id=collab_commits.branch_id and (app_is_roadmap_owner(b.roadmap_id) or app_is_roadmap_member(b.roadmap_id) or (b.root_topic_id is not null and app_is_topic_tree_member(b.root_topic_id))))
);

-- v5: roadmap community groups (one owner-led community per roadmap)
create table if not exists collab_groups (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null unique references roadmaps(id) on delete cascade,
  owner_id varchar(255) not null,
  name text not null,
  description text not null default '',
  max_members int not null default 10,
  discoverable boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  invite_token text not null unique default md5(random()::text || clock_timestamp()::text),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collab_groups_max_members_ck check (max_members between 2 and 100)
);
alter table collab_groups add column if not exists settings jsonb not null default '{}'::jsonb;
alter table collab_groups add column if not exists invite_token text;
update collab_groups set invite_token=coalesce(invite_token, md5(random()::text || clock_timestamp()::text));
alter table collab_groups alter column invite_token set default md5(random()::text || clock_timestamp()::text);
alter table collab_groups alter column invite_token set not null;
create unique index if not exists collab_groups_invite_token_uidx on collab_groups(invite_token);
create index if not exists collab_groups_discoverable_idx on collab_groups(discoverable,created_at desc);
create index if not exists collab_groups_owner_idx on collab_groups(owner_id);

create table if not exists collab_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references collab_groups(id) on delete cascade,
  user_id varchar(255) not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(group_id,user_id)
);
create index if not exists collab_group_members_user_idx on collab_group_members(user_id);

create table if not exists collab_group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references collab_groups(id) on delete cascade,
  requester_id varchar(255) not null,
  message text not null default '',
  status text not null default 'pending',
  reviewed_by varchar(255),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collab_group_join_requests_group_idx on collab_group_join_requests(group_id,status,created_at desc);
create index if not exists collab_group_join_requests_requester_idx on collab_group_join_requests(requester_id,status,created_at desc);

alter table collab_groups enable row level security;
alter table collab_group_members enable row level security;
alter table collab_group_join_requests enable row level security;

drop policy if exists collab_groups_select on collab_groups;
create policy collab_groups_select on collab_groups for select using (
  invite_token is not null or owner_id=app_user_id()
  or exists(select 1 from collab_group_members m where m.group_id=collab_groups.id and m.user_id=app_user_id())
  or (discoverable=true and exists(select 1 from roadmaps r where r.id=collab_groups.roadmap_id and r.privacy in ('public','link')))
);
drop policy if exists collab_groups_insert on collab_groups;
create policy collab_groups_insert on collab_groups for insert with check (owner_id=app_user_id() and app_is_roadmap_owner(roadmap_id));
drop policy if exists collab_groups_update on collab_groups;
create policy collab_groups_update on collab_groups for update using (owner_id=app_user_id()) with check (owner_id=app_user_id() and app_is_roadmap_owner(roadmap_id));
drop policy if exists collab_groups_delete on collab_groups;
create policy collab_groups_delete on collab_groups for delete using (owner_id=app_user_id());

drop policy if exists collab_group_members_select on collab_group_members;
create policy collab_group_members_select on collab_group_members for select using (
  user_id=app_user_id()
  or exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
  or exists(select 1 from collab_groups g join roadmaps r on r.id=g.roadmap_id where g.id=group_id and g.discoverable=true and r.privacy in ('public','link'))
);
drop policy if exists collab_group_members_insert on collab_group_members;
create policy collab_group_members_insert on collab_group_members for insert with check (
  exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
);
drop policy if exists collab_group_members_delete on collab_group_members;
create policy collab_group_members_delete on collab_group_members for delete using (
  user_id=app_user_id()
  or exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
);

drop policy if exists collab_group_join_requests_select on collab_group_join_requests;
create policy collab_group_join_requests_select on collab_group_join_requests for select using (
  requester_id=app_user_id()
  or exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
);
drop policy if exists collab_group_join_requests_insert on collab_group_join_requests;
create policy collab_group_join_requests_insert on collab_group_join_requests for insert with check (
  requester_id=app_user_id()
  and exists(select 1 from collab_groups g join roadmaps r on r.id=g.roadmap_id where g.id=group_id and g.discoverable=true and r.privacy in ('public','link'))
);
drop policy if exists collab_group_join_requests_update on collab_group_join_requests;
create policy collab_group_join_requests_update on collab_group_join_requests for update using (
  exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
) with check (
  exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
);

drop policy if exists notifications_insert_group_related on notifications;
create policy notifications_insert_group_related on notifications for insert with check (
  user_id=app_user_id()
  or (
    collab_group_join_request_id is not null and exists(
      select 1 from collab_group_join_requests qr join collab_groups g on g.id=qr.group_id
      where qr.id=notifications.collab_group_join_request_id
        and (g.owner_id=app_user_id() or qr.requester_id=app_user_id())
    )
  )
);

-- Keep the roadmap group's owner in sync with the roadmap owner.
insert into collab_groups(roadmap_id,owner_id,name,description,max_members,discoverable)
select r.id,r.owner_id,coalesce(nullif(r.title,''),'Roadmap Community'),'Community for '||coalesce(nullif(r.title,''),'this roadmap'),10,true
from roadmaps r
where false;

-- v5: roadmap community groups (one owner-led community per roadmap)
create table if not exists collab_groups (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null unique references roadmaps(id) on delete cascade,
  owner_id varchar(255) not null,
  name text not null,
  description text not null default '',
  max_members int not null default 10,
  discoverable boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  invite_token text not null unique default md5(random()::text || clock_timestamp()::text),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collab_groups_max_members_ck check (max_members between 2 and 100)
);
alter table collab_groups add column if not exists settings jsonb not null default '{}'::jsonb;
alter table collab_groups add column if not exists invite_token text;
update collab_groups set invite_token=coalesce(invite_token, md5(random()::text || clock_timestamp()::text));
alter table collab_groups alter column invite_token set default md5(random()::text || clock_timestamp()::text);
alter table collab_groups alter column invite_token set not null;
create unique index if not exists collab_groups_invite_token_uidx on collab_groups(invite_token);
create index if not exists collab_groups_discoverable_idx on collab_groups(discoverable,created_at desc);
create index if not exists collab_groups_owner_idx on collab_groups(owner_id);

create table if not exists collab_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references collab_groups(id) on delete cascade,
  user_id varchar(255) not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(group_id,user_id)
);
create index if not exists collab_group_members_user_idx on collab_group_members(user_id);

create table if not exists collab_group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references collab_groups(id) on delete cascade,
  requester_id varchar(255) not null,
  message text not null default '',
  status text not null default 'pending',
  reviewed_by varchar(255),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collab_group_join_requests_group_idx on collab_group_join_requests(group_id,status,created_at desc);
create index if not exists collab_group_join_requests_requester_idx on collab_group_join_requests(requester_id,status,created_at desc);

alter table collab_groups enable row level security;
alter table collab_group_members enable row level security;
alter table collab_group_join_requests enable row level security;

drop policy if exists collab_groups_select on collab_groups;
create policy collab_groups_select on collab_groups for select using (
  invite_token is not null or owner_id=app_user_id()
  or exists(select 1 from collab_group_members m where m.group_id=collab_groups.id and m.user_id=app_user_id())
  or (discoverable=true and exists(select 1 from roadmaps r where r.id=collab_groups.roadmap_id and r.privacy in ('public','link')))
);
drop policy if exists collab_groups_insert on collab_groups;
create policy collab_groups_insert on collab_groups for insert with check (owner_id=app_user_id() and app_is_roadmap_owner(roadmap_id));
drop policy if exists collab_groups_update on collab_groups;
create policy collab_groups_update on collab_groups for update using (owner_id=app_user_id()) with check (owner_id=app_user_id() and app_is_roadmap_owner(roadmap_id));
drop policy if exists collab_groups_delete on collab_groups;
create policy collab_groups_delete on collab_groups for delete using (owner_id=app_user_id());

drop policy if exists collab_group_members_select on collab_group_members;
create policy collab_group_members_select on collab_group_members for select using (
  user_id=app_user_id()
  or exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
  or exists(select 1 from collab_groups g join roadmaps r on r.id=g.roadmap_id where g.id=group_id and g.discoverable=true and r.privacy in ('public','link'))
);
drop policy if exists collab_group_members_insert on collab_group_members;
create policy collab_group_members_insert on collab_group_members for insert with check (exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id()));
drop policy if exists collab_group_members_delete on collab_group_members;
create policy collab_group_members_delete on collab_group_members for delete using (user_id=app_user_id() or exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id()));

drop policy if exists collab_group_join_requests_select on collab_group_join_requests;
create policy collab_group_join_requests_select on collab_group_join_requests for select using (requester_id=app_user_id() or exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id()));
drop policy if exists collab_group_join_requests_insert on collab_group_join_requests;
create policy collab_group_join_requests_insert on collab_group_join_requests for insert with check (
  requester_id=app_user_id() and exists(select 1 from collab_groups g join roadmaps r on r.id=g.roadmap_id where g.id=group_id and g.discoverable=true and r.privacy in ('public','link'))
);
drop policy if exists collab_group_join_requests_update on collab_group_join_requests;
create policy collab_group_join_requests_update on collab_group_join_requests for update using (exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())) with check (exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id()));

drop policy if exists notifications_insert_group_related on notifications;
create policy notifications_insert_group_related on notifications for insert with check (
  user_id=app_user_id()
  or (collab_group_join_request_id is not null and exists(
    select 1 from collab_group_join_requests qr join collab_groups g on g.id=qr.group_id
    where qr.id=notifications.collab_group_join_request_id and (g.owner_id=app_user_id() or qr.requester_id=app_user_id())
  ))
);

-- v5.1: discoverable communities can accept join requests even when the underlying roadmap is private.
drop policy if exists collab_groups_select on collab_groups;
create policy collab_groups_select on collab_groups for select using (
  invite_token is not null or owner_id=app_user_id()
  or exists(select 1 from collab_group_members m where m.group_id=collab_groups.id and m.user_id=app_user_id())
  or discoverable=true
);

drop policy if exists collab_group_members_select on collab_group_members;
create policy collab_group_members_select on collab_group_members for select using (
  user_id=app_user_id()
  or exists(select 1 from collab_groups g where g.id=group_id and g.owner_id=app_user_id())
  or exists(select 1 from collab_groups g where g.id=group_id and g.discoverable=true)
);

drop policy if exists collab_group_join_requests_insert on collab_group_join_requests;
create policy collab_group_join_requests_insert on collab_group_join_requests for insert with check (
  requester_id=app_user_id()
  and exists(select 1 from collab_groups g where g.id=group_id and g.discoverable=true)
);
