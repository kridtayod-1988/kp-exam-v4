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
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

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
as $$
declare
  v_user_id uuid := auth.uid();
  v_seen_ids uuid[] := '{}'::uuid[];
  v_selected uuid[] := '{}'::uuid[];
  v_requested integer;
  v_attempt_id uuid;
  v_existing public.exam_attempts%rowtype;
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

  select * into v_existing
  from public.exam_attempts
  where user_id = v_user_id
    and mode = p_mode
    and category_id is not distinct from case when p_mode = 'category' then p_category_id else null end
    and exam_year_id is not distinct from case when p_mode = 'year' then p_exam_year_id else null end
    and finished_at is null
  order by started_at desc
  limit 1
  for update;
  if found then
    return jsonb_build_object(
      'attempt_id',v_existing.id,
      'total_questions',v_existing.total_questions,
      'mode',p_mode,
      'reused_existing',true
    );
  end if;

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
$$;

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


-- Keep the admin predicate in a non-exposed schema. It returns only a boolean,
-- and is callable by authenticated sessions only for RLS evaluation.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Replace legacy policy calls with the private helper so the helper is not
-- exposed as a PostgREST RPC endpoint and avoid recursive profiles subqueries.
alter policy profiles_select on public.profiles
  using ((select auth.uid()) = id or private.is_admin());
alter policy profiles_delete on public.profiles
  using (private.is_admin());
alter policy profiles_update_admin_only on public.profiles
  using (private.is_admin()) with check (private.is_admin());

alter policy categories_delete_admin on public.categories using (private.is_admin());
alter policy categories_insert_admin on public.categories with check (private.is_admin());
alter policy categories_update_admin on public.categories using (private.is_admin()) with check (private.is_admin());

alter policy exam_years_delete_admin on public.exam_years using (private.is_admin());
alter policy exam_years_insert_admin on public.exam_years with check (private.is_admin());
alter policy exam_years_update_admin on public.exam_years using (private.is_admin()) with check (private.is_admin());

alter policy questions_select_admin_only on public.questions using (private.is_admin());
drop policy if exists questions_admin_insert on public.questions;
alter policy questions_insert_admin on public.questions with check (private.is_admin());
alter policy questions_update_admin on public.questions using (private.is_admin()) with check (private.is_admin());
alter policy questions_delete_admin on public.questions using (private.is_admin());

alter policy exam_attempts_delete on public.exam_attempts using (private.is_admin());
alter policy exam_attempts_owner_boundary on public.exam_attempts
  using ((user_id = (select auth.uid())) or private.is_admin())
  with check ((user_id = (select auth.uid())) or private.is_admin());
alter policy exam_attempts_select on public.exam_attempts
  using ((user_id = (select auth.uid())) or private.is_admin());

alter policy user_seen_questions_owner_boundary on public.user_seen_questions
  using ((user_id = (select auth.uid())) or private.is_admin())
  with check ((user_id = (select auth.uid())) or private.is_admin());
alter policy user_seen_select on public.user_seen_questions
  using ((user_id = (select auth.uid())) or private.is_admin());
alter policy user_seen_update on public.user_seen_questions
  using ((user_id = (select auth.uid())) or private.is_admin())
  with check ((user_id = (select auth.uid())) or private.is_admin());

alter policy system_config_select on public.system_config
  using ((key = 'public') or private.is_admin());
alter policy system_config_update_admin on public.system_config
  using (private.is_admin()) with check (private.is_admin());

alter policy answers_owner_boundary on public.answers
  using (
    exists (select 1 from public.exam_attempts ea where ea.id = answers.attempt_id and ea.user_id = (select auth.uid()))
    or private.is_admin()
  )
  with check (
    exists (select 1 from public.exam_attempts ea where ea.id = answers.attempt_id and ea.user_id = (select auth.uid()))
    or private.is_admin()
  );
alter policy answers_select_owner_or_admin on public.answers
  using (
    private.is_admin()
    or exists (select 1 from public.exam_attempts ea where ea.id = answers.attempt_id and ea.user_id = (select auth.uid()) and answers.question_id = any(ea.question_ids))
  );

alter policy exam_blueprints_read_active on public.exam_blueprints
  using (is_active or private.is_admin());
alter policy exam_blueprints_admin_write on public.exam_blueprints
  using (private.is_admin()) with check (private.is_admin());
alter policy ai_question_drafts_admin_only on public.ai_question_drafts
  using (private.is_admin()) with check (private.is_admin());


-- Close direct-client paths that are no longer used by the Next.js application.
revoke all on public.user_seen_questions from anon, authenticated;
revoke all on public.system_config from anon, authenticated;
revoke insert, update, delete on public.exam_attempts from authenticated;

-- Legacy exam_sets policies also used the public helper; route them through private.is_admin.
alter policy exam_sets_delete_admin on public.exam_sets using (private.is_admin());
alter policy exam_sets_insert_admin on public.exam_sets with check (private.is_admin());
alter policy exam_sets_update_admin on public.exam_sets using (private.is_admin()) with check (private.is_admin());

-- Serialize submissions and make retries idempotent so EXP/statistics are awarded once.
create or replace function public.submit_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_score int := 0;
  v_total int;
  v_exp int;
  v_answers int[];
  v_qids uuid[];
  v_i int;
  v_correct int;
  v_user_answer int;
  v_prev_exp int;
  v_new_exp int;
  v_new_attempts int;
  v_new_best int;
  v_level_before int;
  v_level_after int;
begin
  if v_user_id is null then
    raise exception 'กรุณาเข้าสู่ระบบก่อน' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id and status = 'active') then
    raise exception 'Account is inactive or suspended' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'ไม่พบข้อสอบนี้ หรือคุณไม่มีสิทธิ์';
  end if;

  if v_attempt.finished_at is not null then
    return jsonb_build_object(
      'attempt_id', p_attempt_id,
      'score', v_attempt.score,
      'total', v_attempt.total_questions,
      'exp_gained', v_attempt.exp_gained,
      'idempotent_replay', true,
      'duration_seconds', v_attempt.duration_seconds
    );
  end if;

  v_qids := v_attempt.question_ids;
  v_total := coalesce(array_length(v_qids, 1), 0);
  if v_total = 0 then raise exception 'ข้อสอบไม่มีรายการคำถาม'; end if;

  v_answers := array_fill(-1, array[v_total]);
  if jsonb_typeof(p_answers) = 'array' then
    for v_i in 0..jsonb_array_length(p_answers) - 1 loop
      declare
        a jsonb := p_answers -> v_i;
      begin
        if jsonb_typeof(a) = 'object' then
          declare
            q_idx int := coalesce((a ->> 'no')::int - 1, -1);
            choice int := coalesce((a ->> 'choice')::int, -1);
          begin
            if q_idx >= 0 and q_idx < v_total and choice between -1 and 3 then
              v_answers[q_idx + 1] := choice;
            end if;
          end;
        elsif jsonb_typeof(a) = 'number' and v_i < v_total then
          v_answers[v_i + 1] := (a)::text::int;
        end if;
      end;
    end loop;
  end if;

  for v_i in 1..v_total loop
    select correct_answer_index into v_correct
    from public.questions where id = v_qids[v_i];
    v_user_answer := v_answers[v_i];
    if v_user_answer between 0 and 3 and v_user_answer = v_correct then
      v_score := v_score + 1;
    end if;
  end loop;

  v_exp := v_score * 10;
  update public.exam_attempts
  set user_answers = v_answers,
      score = v_score,
      exp_gained = v_exp,
      finished_at = now(),
      duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int)
  where id = p_attempt_id;

  select total_exp, total_attempts, best_score
  into v_prev_exp, v_new_attempts, v_new_best
  from public.profiles where id = v_user_id for update;

  v_new_exp := coalesce(v_prev_exp, 0) + v_exp;
  v_new_attempts := coalesce(v_new_attempts, 0) + 1;
  v_new_best := greatest(coalesce(v_new_best, 0), v_score);
  update public.profiles
  set total_exp = v_new_exp, total_attempts = v_new_attempts,
      best_score = v_new_best, last_attempt_at = now()
  where id = v_user_id;

  v_level_before := 1;
  while v_level_before < 200 and coalesce(v_prev_exp,0) >= 50 * (v_level_before + 1) * v_level_before loop
    v_level_before := v_level_before + 1;
  end loop;
  v_level_after := 1;
  while v_level_after < 200 and v_new_exp >= 50 * (v_level_after + 1) * v_level_after loop
    v_level_after := v_level_after + 1;
  end loop;

  insert into public.user_seen_questions(user_id,seen_question_ids)
  values(v_user_id,v_qids)
  on conflict(user_id) do update
  set seen_question_ids = (
    select array_agg(distinct x)
    from unnest(public.user_seen_questions.seen_question_ids || v_qids) as x
    where x is not null
  );

  return jsonb_build_object(
    'attempt_id',p_attempt_id,'score',v_score,'total',v_total,
    'exp_gained',v_exp,'new_total_exp',v_new_exp,
    'leveled_up',v_level_after > v_level_before,'new_level',v_level_after,
    'duration_seconds',extract(epoch from (now() - v_attempt.started_at))::int,
    'idempotent_replay',false
  );
end;
$$;

revoke all on function public.submit_exam(uuid,jsonb) from public, anon;
grant execute on function public.submit_exam(uuid,jsonb) to authenticated;


-- Policies using the private helper must not target anon (which has no private schema usage).
alter policy categories_delete_admin on public.categories to authenticated;
alter policy categories_insert_admin on public.categories to authenticated;
alter policy categories_update_admin on public.categories to authenticated;
alter policy exam_years_delete_admin on public.exam_years to authenticated;
alter policy exam_years_insert_admin on public.exam_years to authenticated;
alter policy exam_years_update_admin on public.exam_years to authenticated;
alter policy exam_sets_delete_admin on public.exam_sets to authenticated;
alter policy exam_sets_insert_admin on public.exam_sets to authenticated;
alter policy exam_sets_update_admin on public.exam_sets to authenticated;
alter policy questions_insert_admin on public.questions to authenticated;
alter policy questions_update_admin on public.questions to authenticated;
alter policy questions_delete_admin on public.questions to authenticated;
alter policy system_config_select on public.system_config to authenticated;
alter policy system_config_update_admin on public.system_config to authenticated;

-- This helper is not part of the client API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;


-- Review and publish an AI draft atomically; duplicate approvals cannot create duplicate questions.
create or replace function public.review_ai_question_draft(p_draft_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.ai_question_drafts%rowtype;
  v_payload jsonb;
  v_question_id uuid;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_draft
  from public.ai_question_drafts
  where id = p_draft_id
  for update;
  if not found then raise exception 'Draft not found'; end if;
  if v_draft.status <> 'draft' then
    return jsonb_build_object('already_reviewed',true,'status',v_draft.status);
  end if;

  if p_approve then
    v_payload := v_draft.payload;
    if jsonb_typeof(v_payload->'options') <> 'array'
       or jsonb_array_length(v_payload->'options') <> 4
       or (v_payload->>'correct_answer_index')::integer not between 0 and 3
       or length(coalesce(v_payload->>'question_text','')) < 5 then
      raise exception 'Draft payload failed validation';
    end if;

    insert into public.questions (
      category_id, cat, sub, question_text, options,
      correct_answer_index, explanation, difficulty, table_data,
      source, created_by, is_active
    ) values (
      (v_payload->>'category_id')::uuid,
      nullif(v_payload->>'cat',''),
      nullif(v_payload->>'sub',''),
      v_payload->>'question_text',
      array(select jsonb_array_elements_text(v_payload->'options')),
      (v_payload->>'correct_answer_index')::integer,
      coalesce(v_payload->>'explanation',''),
      coalesce(v_payload->>'difficulty','medium'),
      v_payload->'table_data',
      'ai_generated', v_user_id, true
    ) returning id into v_question_id;
  end if;

  update public.ai_question_drafts
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(), reviewed_by = v_user_id
  where id = p_draft_id;

  return jsonb_build_object(
    'draft_id',p_draft_id,
    'status',case when p_approve then 'approved' else 'rejected' end,
    'question_id',v_question_id
  );
end;
$$;
revoke all on function public.review_ai_question_draft(uuid,boolean) from public, anon;
grant execute on function public.review_ai_question_draft(uuid,boolean) to authenticated;


create or replace function public.get_exam_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_items jsonb := '[]'::jsonb;
  v_question jsonb;
  v_i int;
  v_q record;
  v_choice int;
begin
  if v_user_id is null then
    raise exception 'กรุณาเข้าสู่ระบบก่อน' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id and status = 'active') then
    raise exception 'Account is inactive or suspended' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id
    and (user_id = v_user_id or public.is_admin());
  if not found then raise exception 'ไม่พบข้อสอบนี้ หรือคุณไม่มีสิทธิ์'; end if;
  if v_attempt.finished_at is null then raise exception 'ข้อสอบนี้ยังทำไม่เสร็จ'; end if;

  for v_i in 1..array_length(v_attempt.question_ids, 1) loop
    select q.id,q.question_text,q.options,q.correct_answer_index,q.explanation,q.table_data
    into v_q
    from public.questions q
    where q.id = v_attempt.question_ids[v_i];
    if not found then continue; end if;

    v_choice := v_attempt.user_answers[v_i];
    v_question := jsonb_build_object(
      'no',v_i,
      'question_id',v_q.id,
      'question_text',v_q.question_text,
      'choices',to_jsonb(v_q.options),
      'correct_answer_index',v_q.correct_answer_index,
      'user_choice',v_choice,
      'is_correct',(v_choice is not null and v_choice >= 0 and v_choice = v_q.correct_answer_index),
      'explanation',coalesce(v_q.explanation,''),
      'table_data',v_q.table_data
    );
    v_items := v_items || jsonb_build_array(v_question);
  end loop;

  return jsonb_build_object(
    'attempt_id',p_attempt_id,
    'score',v_attempt.score,
    'total',v_attempt.total_questions,
    'exp_gained',v_attempt.exp_gained,
    'duration_seconds',v_attempt.duration_seconds,
    'started_at',v_attempt.started_at,
    'finished_at',v_attempt.finished_at,
    'items',v_items
  );
end;
$$;
revoke all on function public.get_exam_review(uuid) from public, anon;
grant execute on function public.get_exam_review(uuid) to authenticated;
