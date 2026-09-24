-- ============================================
-- เตรียมสอบ ก.พ. — RLS Policies (Migration 2/5)
-- แปลงจาก Firestore Security Rules
-- หมายเหตุ: policy ชุดนี้ถูกแทนที่ด้วยเวอร์ชัน optimize ใน migration 5
-- (20260811223007_optimize_rls_and_indexes.sql) เก็บไว้เพื่อบันทึกประวัติจริงที่ apply
-- ============================================

-- เปิด RLS ทุกตาราง (ค่าเริ่มต้นของ Postgres คือปิด ต้องเปิดเองเสมอ)
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.exam_years enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.user_seen_questions enable row level security;
alter table public.system_config enable row level security;

-- ----- Helper function: เช็คว่าเป็น admin หรือไม่ -----
-- (เทียบเท่า isAdmin() ใน Firestore Rules เดิม)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----- profiles policies -----
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id and role = 'user');

create policy "profiles_update_own_no_role_change" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- ----- categories policies -----
create policy "categories_select_all" on public.categories
  for select using (true);

create policy "categories_write_admin" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ----- exam_years policies -----
create policy "exam_years_select_all" on public.exam_years
  for select using (true);

create policy "exam_years_write_admin" on public.exam_years
  for all using (public.is_admin()) with check (public.is_admin());

-- ----- questions policies -----
create policy "questions_select_authenticated" on public.questions
  for select using (auth.role() = 'authenticated');

create policy "questions_write_admin" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

-- ----- exam_attempts policies -----
create policy "exam_attempts_insert_own" on public.exam_attempts
  for insert with check (auth.uid() = user_id);

create policy "exam_attempts_select_own_or_admin" on public.exam_attempts
  for select using (auth.uid() = user_id or public.is_admin());

create policy "exam_attempts_update_own" on public.exam_attempts
  for update using (auth.uid() = user_id);

create policy "exam_attempts_delete_admin" on public.exam_attempts
  for delete using (public.is_admin());

-- ----- user_seen_questions policies -----
create policy "user_seen_select_own_or_admin" on public.user_seen_questions
  for select using (auth.uid() = user_id or public.is_admin());

create policy "user_seen_insert_own" on public.user_seen_questions
  for insert with check (auth.uid() = user_id);

create policy "user_seen_update_own_or_admin" on public.user_seen_questions
  for update using (auth.uid() = user_id or public.is_admin());

-- ----- system_config policies -----
create policy "system_config_select_public_row" on public.system_config
  for select using (key = 'public');

create policy "system_config_select_secrets_admin" on public.system_config
  for select using (key = 'secrets' and public.is_admin());

create policy "system_config_update_admin" on public.system_config
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================
-- Trigger: สร้าง profile อัตโนมัติเมื่อมีการสมัครสมาชิกใหม่ผ่าน Supabase Auth
-- (แทนที่ logic เดิมที่ทำใน signup.js ฝั่ง client — ทำงานทั้งกรณีสมัครอีเมลและ Google OAuth)
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role, photo_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    'user',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
