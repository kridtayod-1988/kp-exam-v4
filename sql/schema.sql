-- sql/schema.sql

create table if not exists public.taxonomy_nodes (

  code text primary key, parent_code text references public.taxonomy_nodes(code),

  level int not null, name_th text not null, name_en text, sort int default 0

);


create table if not exists public.profiles (

  id uuid primary key references auth.users on delete cascade,

  email text unique not null, display_name text,

  role text not null default 'user' check (role in ('user','admin')),

  exp int not null default 0, level int not null default 1,

  created_at timestamptz default now()

);


create table if not exists public.questions (

  id bigint primary key generated always as identity,

  question_text text not null, choices jsonb not null,

  answer_key text not null, explanation text,

  subject_code text, area_code text, topic_code text,

  difficulty text default 'medium' check (difficulty in ('easy','medium','hard')),

  exam_year int, classify_confidence numeric, classify_source text,

  needs_review boolean default true, is_active boolean default true,

  created_at timestamptz default now()

);

create index on public.questions (subject_code, area_code, is_active);


create table if not exists public.attempts (

  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  mode text default 'full', filter_code text,

  total int, score int, exp_gained int,

  started_at timestamptz default now(), submitted_at timestamptz

);


create table if not exists public.attempt_items (

  attempt_id uuid references public.attempts(id) on delete cascade,

  question_id bigint references public.questions(id),

  user_answer text, is_correct boolean, order_no int,

  primary key (attempt_id, question_id)

);


-- helper: เช็คแอดมิน

create or replace function public.is_admin() returns boolean

language sql security definer stable as $

  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');

$;


-- 🔑 สร้าง profile อัตโนมัติ + ตั้งแอดมินคนแรก

create or replace function public.handle_new_user() returns trigger

language plpgsql security definer as $

begin

  insert into public.profiles (id, email, display_name, role)

  values (new.id, new.email,

          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),

          case when lower(new.email) = lower('CHANGE_ME@example.com')  -- ⬅️ ใส่อีเมลแอดมินแรกตรงนี้

               then 'admin' else 'user' end);

  return new;

end $;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created after insert on auth.users

  for each row execute function public.handle_new_user();


-- RLS

alter table public.profiles enable row level security;

alter table public.questions enable row level security;

alter table public.attempts enable row level security;

alter table public.attempt_items enable row level security;

alter table public.taxonomy_nodes enable row level security;


create policy "own profile"      on public.profiles for select using (id = auth.uid() or public.is_admin());

create policy "update own"       on public.profiles for update using (id = auth.uid()) with check (role = (select role from public.profiles where id = auth.uid()));

create policy "admin all profile"on public.profiles for all    using (public.is_admin());

create policy "read taxonomy"    on public.taxonomy_nodes for select using (true);

create policy "read questions"   on public.questions for select using (is_active or public.is_admin());

create policy "admin questions"  on public.questions for all using (public.is_admin()) with check (public.is_admin());

create policy "own attempts"     on public.attempts for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());

create policy "own items"        on public.attempt_items for all

  using (exists(select 1 from public.attempts a where a.id = attempt_id and (a.user_id = auth.uid() or public.is_admin())));


-- ป้องกันเฉลยรั่วตอนทำข้อสอบ: view สำหรับผู้สอบ

create or replace view public.questions_public as

  select id, question_text, choices, subject_code, area_code, topic_code, difficulty, exam_year

  from public.questions where is_active;
