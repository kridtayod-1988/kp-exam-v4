-- ============================================
-- เตรียมสอบ ก.พ. — Supabase Schema (Migration 1/5)
-- แปลงจาก Firestore collections เป็น Postgres tables
-- ============================================

-- ----- profiles (แทน users/{uid} ใน Firestore) -----
-- เชื่อมกับ auth.users ผ่าน uid โดยตรง (Supabase Auth จัดการ auth.users ให้เอง)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) <= 100),
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  photo_url text,
  total_attempts integer not null default 0,
  best_score integer not null default 0,
  total_exp integer not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

comment on table public.profiles is 'ข้อมูลผู้ใช้ + สถิติ + role (แทน users collection เดิม)';

-- ----- categories (แทน categories collection) -----
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 100),
  sort_order integer not null default 0,
  is_active boolean not null default true
);

-- ----- exam_years (แทน examYears collection) -----
create table public.exam_years (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) <= 50),
  year integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----- questions (แทน questions collection) -----
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  exam_year_id uuid references public.exam_years(id) on delete set null,
  question_text text not null check (char_length(question_text) <= 2000),
  table_data jsonb,              -- { headers: string[], rows: string[][] } หรือ null
  options text[] not null,       -- 4 ตัวเลือก
  correct_answer_index integer not null check (correct_answer_index between 0 and 3),
  explanation text not null check (char_length(explanation) <= 2000),
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  is_active boolean not null default true,
  source text not null default 'manual' check (source in ('manual','ai_generated')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint options_length check (array_length(options, 1) = 4)
);

create index idx_questions_active_category on public.questions (is_active, category_id);
create index idx_questions_active_year on public.questions (is_active, exam_year_id);

-- ----- exam_attempts (แทน examAttempts collection) -----
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('full100','category','year')),
  category_id uuid references public.categories(id) on delete set null,
  exam_year_id uuid references public.exam_years(id) on delete set null,
  question_ids uuid[] not null,
  user_answers integer[] not null,
  score integer not null default 0,
  total_questions integer not null,
  exp_gained integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer not null default 0
);

create index idx_exam_attempts_user on public.exam_attempts (user_id, started_at desc);

-- ----- user_seen_questions (แทน userSeenQuestions collection) -----
-- เก็บเป็น array ต่อ user เดียว (เหมือนโครงสร้างเดิมใน Firestore) เพื่อกันสุ่มซ้ำข้ามรอบ
create table public.user_seen_questions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_question_ids uuid[] not null default '{}',
  last_reset_at timestamptz
);

-- ----- system_config (แทน systemConfig/public และ systemConfig/secrets) -----
-- แยกเป็น 2 แถวเหมือนเดิม เพื่อให้ RLS แยกสิทธิ์อ่านได้ตรงตามที่ออกแบบไว้
create table public.system_config (
  key text primary key check (key in ('public', 'secrets')),
  full_exam_question_count integer not null default 100,
  full_exam_time_minutes integer not null default 180,
  allow_email_signup boolean not null default true,
  allow_google_signin boolean not null default true,
  maintenance_mode boolean not null default false,
  maintenance_message text not null default '',
  claude_api_key text,
  gemini_api_key text
);

insert into public.system_config (key) values ('public'), ('secrets');
