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
  using (is_active or public.is_admin());
drop policy if exists exam_blueprints_admin_write on public.exam_blueprints;
create policy exam_blueprints_admin_write on public.exam_blueprints
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
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
  with check (public.is_admin());
grant select, insert, update, delete on public.ai_question_drafts to authenticated;

create index if not exists idx_exam_blueprints_active on public.exam_blueprints (is_active, created_at desc);
create index if not exists idx_ai_question_drafts_status on public.ai_question_drafts (status, created_at desc);

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
    select coalesce(array_agg(code), '{}'::text[]) into v_sub_codes
    from jsonb_array_elements_text(coalesce(v_rule->'sub_codes','[]'::jsonb)) as code;

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
