-- KP Exam V4: server-side blueprint sampling and AI draft workflow
-- Prepared for isolated development branch only. Not applied to any database.

create table if not exists public.exam_blueprints (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 2 and 60),
  title text not null check (char_length(title) between 2 and 160),
  description text,
  total_questions integer not null check (total_questions between 1 and 200),
  time_limit_minutes integer not null check (time_limit_minutes between 1 and 600),
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exam_blueprints enable row level security;
drop policy if exists exam_blueprints_read_active on public.exam_blueprints;
create policy exam_blueprints_read_active on public.exam_blueprints
  for select to authenticated
  using (is_active or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'));
drop policy if exists exam_blueprints_admin_write on public.exam_blueprints;
create policy exam_blueprints_admin_write on public.exam_blueprints
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'));
grant select, insert, update, delete on public.exam_blueprints to authenticated;

create table if not exists public.ai_question_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.ai_question_drafts enable row level security;
drop policy if exists ai_question_drafts_admin_only on public.ai_question_drafts;
create policy ai_question_drafts_admin_only on public.ai_question_drafts
  for all to authenticated
  using (public.is_admin())
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'));
grant select, insert, update, delete on public.ai_question_drafts to authenticated;

create index if not exists idx_exam_blueprints_active on public.exam_blueprints (is_active, created_at desc);
create index if not exists idx_ai_question_drafts_status on public.ai_question_drafts (status, created_at desc);


-- Align authorization with the live schema: add soft-ban state, lock answer keys,
-- and keep question selection on the database server.
alter table public.profiles
  add column if not exists status text not null default 'active'
  check (status in ('active','banned'));

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$;

-- Students read the allow-listed view only. The real question table is admin-only.
drop policy if exists questions_select on public.questions;
create policy questions_select_admin_only on public.questions
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'));

-- Remove broad self-update policies on profiles: users must not edit role, EXP,
-- counters, or status through the Data API. Admin changes remain RLS-gated.
drop policy if exists profiles_owner_boundary on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_update_admin_only on public.profiles;
create policy profiles_update_admin_only on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Do not expose personal exposure/seen records to anonymous or authenticated
-- clients through direct table/view access. The RPC runs with its owner privileges.
revoke all on public.user_seen_questions from anon;
revoke all on public.v_item_exposure from anon, authenticated;
grant select on public.v_questions_public to authenticated;
revoke all on public.v_questions_public from anon;

create or replace function public.create_exam_attempt_sampled(
  p_mode text,
  p_count integer default 10,
  p_category_id uuid default null,
  p_exam_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  v_user_id uuid := auth.uid();
  v_seen_ids uuid[] := '{}'::uuid[];
  v_selected uuid[] := '{}'::uuid[];
  v_requested integer;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and status = 'active'
  ) then
    raise exception 'Account is inactive or suspended' using errcode = '42501';
  end if;
  if p_mode not in ('full100','category','year') then
    raise exception 'Invalid exam mode';
  end if;
  if p_mode = 'category' and p_category_id is null then
    raise exception 'category_id is required';
  end if;
  if p_mode = 'year' and p_exam_year_id is null then
    raise exception 'exam_year_id is required';
  end if;

  v_requested := case when p_mode = 'full100' then 100 else greatest(1, least(coalesce(p_count,10),50)) end;

  perform pg_advisory_xact_lock(hashtextextended(
    v_user_id::text || ':' || p_mode || ':' ||
    coalesce(p_category_id::text,'') || ':' || coalesce(p_exam_year_id::text,''), 0
  ));

  select seen_question_ids into v_seen_ids
  from public.user_seen_questions where user_id = v_user_id;
  v_seen_ids := coalesce(v_seen_ids, '{}'::uuid[]);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_selected
  from (
    select q.id
    from public.questions q
    left join public.v_item_exposure e on e.id = q.id
    where q.is_active = true and q.deleted_at is null
      and (p_mode <> 'category' or q.category_id = p_category_id)
      and (p_mode <> 'year' or q.exam_year_id = p_exam_year_id)
      and not (q.id = any(v_seen_ids))
    order by coalesce(e.times_served,0) asc, random()
    limit v_requested
  ) unseen;

  if cardinality(v_selected) < v_requested then
    v_selected := v_selected || coalesce((
      select array_agg(id) from (
        select q.id
        from public.questions q
        left join public.v_item_exposure e on e.id = q.id
        where q.is_active = true and q.deleted_at is null
          and (p_mode <> 'category' or q.category_id = p_category_id)
          and (p_mode <> 'year' or q.exam_year_id = p_exam_year_id)
          and not (q.id = any(v_selected))
        order by coalesce(e.times_served,0) asc, random()
        limit (v_requested - cardinality(v_selected))
      ) previously_seen
    ), '{}'::uuid[]);
  end if;

  if cardinality(v_selected) = 0 then
    raise exception 'No active questions available for this selection';
  end if;

  insert into public.exam_attempts (
    user_id, mode, category_id, exam_year_id, question_ids,
    user_answers, total_questions, paper_id, duration_seconds
  ) values (
    v_user_id, p_mode,
    case when p_mode = 'category' then p_category_id else null end,
    case when p_mode = 'year' then p_exam_year_id else null end,
    v_selected, array_fill(-1, array[cardinality(v_selected)]),
    cardinality(v_selected), p_mode || '-' || extract(epoch from now())::bigint, 0
  ) returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'total_questions', cardinality(v_selected),
    'mode', p_mode
  );
end;
$;

revoke all on function public.create_exam_attempt_sampled(text,integer,uuid,uuid) from public, anon;
grant execute on function public.create_exam_attempt_sampled(text,integer,uuid,uuid) to authenticated;

-- Blueprint sampling also rejects suspended accounts.

-- Sampling stays in Postgres: only the selected question IDs are stored in the attempt.
create or replace function public.create_exam_attempt_from_blueprint(p_blueprint_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_bp public.exam_blueprints%rowtype;
  v_rule jsonb;
  v_quota integer;
  v_seen_ids uuid[] := '{}'::uuid[];
  v_cat_ids uuid[] := '{}'::uuid[];
  v_picked_ids uuid[] := '{}'::uuid[];
  v_category_id uuid;
  v_cat text;
  v_sub_codes text[];
  v_attempt_id uuid;
  v_total integer := 0;
  v_existing public.exam_attempts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id and status = 'active') then
    raise exception 'Account is inactive or suspended' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_blueprint_code, 0));

  select * into v_bp
  from public.exam_blueprints
  where code = p_blueprint_code and is_active = true;
  if not found then
    raise exception 'Blueprint not found or inactive' using errcode = 'P0002';
  end if;

  select seen_question_ids into v_seen_ids
  from public.user_seen_questions
  where user_id = v_user_id;
  v_seen_ids := coalesce(v_seen_ids, '{}'::uuid[]);

  -- Return the user's existing unfinished attempt for this blueprint (idempotent start).
  select * into v_existing
  from public.exam_attempts
  where user_id = v_user_id
    and blueprint_id = v_bp.id::text
    and finished_at is null
  order by started_at desc
  limit 1
  for update;
  if found then
    return jsonb_build_object(
      'attempt_id', v_existing.id,
      'blueprint_code', v_bp.code,
      'total_questions', v_existing.total_questions,
      'time_limit_minutes', v_bp.time_limit_minutes,
      'reused_existing', true
    );
  end if;

  if jsonb_array_length(v_bp.rules) = 0 then
    raise exception 'Blueprint has no sampling rules';
  end if;

  for v_rule in select value from jsonb_array_elements(v_bp.rules)
  loop
    v_quota := coalesce((v_rule->>'quota')::integer, 0);
    if v_quota < 1 or v_quota > 200 then
      raise exception 'Invalid quota in blueprint rule';
    end if;
    v_category_id := nullif(v_rule->>'category_id','')::uuid;
    v_cat := nullif(v_rule->>'cat','');
    select coalesce(array_agg(value), '{}'::text[]) into v_sub_codes
    from jsonb_array_elements_text(coalesce(v_rule->'sub_codes','[]'::jsonb)) as codes(value);

    -- Unseen-first selection, scoped by the rule. No question bank is sent to the client.
    select coalesce(array_agg(id), '{}'::uuid[]) into v_cat_ids
    from (
      select q.id
      from public.questions q
      where q.is_active = true and q.deleted_at is null
        and (v_category_id is null or q.category_id = v_category_id)
        and (v_cat is null or q.cat = v_cat)
        and (cardinality(v_sub_codes) = 0 or q.sub = any(v_sub_codes))
        and not (q.id = any(v_seen_ids))
        and not (q.id = any(v_picked_ids))
      order by random()
      limit v_quota
    ) unseen;

    if cardinality(v_cat_ids) < v_quota then
      v_cat_ids := v_cat_ids || coalesce((
        select array_agg(id) from (
          select q.id
          from public.questions q
          where q.is_active = true and q.deleted_at is null
            and (v_category_id is null or q.category_id = v_category_id)
            and (v_cat is null or q.cat = v_cat)
            and (cardinality(v_sub_codes) = 0 or q.sub = any(v_sub_codes))
            and not (q.id = any(v_cat_ids))
            and not (q.id = any(v_picked_ids))
          order by random()
          limit (v_quota - cardinality(v_cat_ids))
        ) repeat_pool
      ), '{}'::uuid[]);
    end if;

    if cardinality(v_cat_ids) <> v_quota then
      raise exception 'Insufficient active questions for rule (requested %, available %)', v_quota, cardinality(v_cat_ids);
    end if;

    v_picked_ids := v_picked_ids || v_cat_ids;
  end loop;

  v_total := cardinality(v_picked_ids);
  if v_total <> v_bp.total_questions then
    raise exception 'Blueprint quota total (%) does not match total_questions (%)', v_total, v_bp.total_questions;
  end if;

  insert into public.exam_attempts (
    user_id, mode, question_ids, user_answers, total_questions,
    paper_id, blueprint_id, duration_seconds
  ) values (
    v_user_id, 'workshop', v_picked_ids,
    array_fill(-1, array[v_total]), v_total,
    v_bp.code, v_bp.id::text, 0
  ) returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'blueprint_code', v_bp.code,
    'total_questions', v_total,
    'time_limit_minutes', v_bp.time_limit_minutes,
    'reused_existing', false
  );
end;
$$;

revoke all on function public.create_exam_attempt_from_blueprint(text) from public, anon;
grant execute on function public.create_exam_attempt_from_blueprint(text) to authenticated;
