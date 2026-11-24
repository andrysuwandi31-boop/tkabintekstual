-- RUANG TKA BAHASA INDONESIA - SUPABASE SETUP
-- Jalankan seluruh skrip ini satu kali melalui Supabase Dashboard > SQL Editor.
-- Skrip ini membuat autentikasi guru, kode kelas, dan penyimpanan hasil murid.
-- Jangan pernah memasukkan service_role key ke aplikasi frontend.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tka_teacher_codes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  lookup_hash text not null,
  code_hint text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tka_attempts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  class_name text not null,
  score integer not null check (score between 0 and 100),
  correct_count integer not null check (correct_count between 0 and 30),
  total integer not null check (total = 30),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 7200),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tka_attempts_teacher_created_idx
  on public.tka_attempts (teacher_id, created_at desc);
create index if not exists tka_attempts_teacher_student_idx
  on public.tka_attempts (teacher_id, class_name, student_name);
alter table public.tka_teacher_codes add column if not exists lookup_hash text;
create unique index if not exists tka_teacher_codes_lookup_hash_idx
  on public.tka_teacher_codes (lookup_hash) where lookup_hash is not null;
create index if not exists tka_teacher_codes_teacher_idx
  on public.tka_teacher_codes (teacher_id, active);

alter table public.tka_teacher_codes enable row level security;
alter table public.tka_attempts enable row level security;

-- Hapus kebijakan lama bernama sama agar skrip dapat dijalankan ulang.
drop policy if exists "Teachers can read their own TKA attempts" on public.tka_attempts;
create policy "Teachers can read their own TKA attempts"
  on public.tka_attempts for select
  to authenticated
  using (auth.uid() = teacher_id);

-- Tidak ada kebijakan baca/tulis langsung untuk kode guru.
-- Kode hanya dibuat dan diverifikasi melalui fungsi di bawah.
revoke all on public.tka_teacher_codes from anon, authenticated;
revoke all on public.tka_attempts from anon, authenticated;
grant select on public.tka_attempts to authenticated;

create or replace function public.create_tka_teacher_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Guru harus masuk terlebih dahulu.';
  end if;

  v_code := upper(trim(coalesce(p_code, '')));
  if length(v_code) < 6 or length(v_code) > 20 or v_code !~ '^[A-Z0-9-]+$' then
    raise exception 'Kode harus 6-20 karakter dan hanya berisi huruf, angka, atau tanda hubung.';
  end if;

  insert into public.tka_teacher_codes (teacher_id, code_hash, lookup_hash, code_hint)
  values (auth.uid(), crypt(v_code, gen_salt('bf')), encode(digest(v_code, 'sha256'), 'hex'), right(v_code, 2))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.submit_tka_attempt(
  p_teacher_code text,
  p_student_name text,
  p_class_name text,
  p_score integer,
  p_correct_count integer,
  p_total integer,
  p_duration_seconds integer,
  p_detail jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_teacher_id uuid;
  v_attempt_id uuid;
  v_code text;
  v_student text;
  v_class text;
begin
  v_code := upper(trim(coalesce(p_teacher_code, '')));
  v_student := trim(coalesce(p_student_name, ''));
  v_class := trim(coalesce(p_class_name, ''));

  if length(v_code) < 6 or length(v_code) > 20 then
    raise exception 'Kode guru/kelas tidak valid.';
  end if;
  if length(v_student) < 1 or length(v_student) > 80 then
    raise exception 'Nama murid harus diisi (maksimal 80 karakter).';
  end if;
  if length(v_class) < 1 or length(v_class) > 30 then
    raise exception 'Kelas harus diisi (maksimal 30 karakter).';
  end if;
  if p_total <> 30 or p_correct_count < 0 or p_correct_count > 30 then
    raise exception 'Data jumlah soal atau jawaban tidak valid.';
  end if;
  if p_score < 0 or p_score > 100 then
    raise exception 'Nilai tidak valid.';
  end if;
  if p_duration_seconds < 0 or p_duration_seconds > 7200 then
    raise exception 'Durasi pengerjaan tidak valid.';
  end if;
  if p_detail is null or jsonb_typeof(p_detail) <> 'object' then
    raise exception 'Detail hasil tidak valid.';
  end if;
  if pg_column_size(p_detail) > 1500000 then
    raise exception 'Data pembahasan terlalu besar.';
  end if;

  select teacher_id
    into v_teacher_id
    from public.tka_teacher_codes
   where active = true
     and lookup_hash = encode(digest(v_code, 'sha256'), 'hex')
     and code_hash = crypt(v_code, code_hash)
   order by created_at desc
   limit 1;

  if v_teacher_id is null then
    raise exception 'Kode guru/kelas tidak ditemukan atau sudah tidak aktif.';
  end if;

  insert into public.tka_attempts (
    teacher_id, student_name, class_name, score,
    correct_count, total, duration_seconds, detail
  ) values (
    v_teacher_id, v_student, v_class, p_score,
    p_correct_count, p_total, p_duration_seconds, p_detail
  ) returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.create_tka_teacher_code(text) from public;
revoke all on function public.submit_tka_attempt(text, text, text, integer, integer, integer, integer, jsonb) from public;
grant execute on function public.create_tka_teacher_code(text) to authenticated;
grant execute on function public.submit_tka_attempt(text, text, text, integer, integer, integer, integer, jsonb) to anon, authenticated;

-- Catatan keamanan:
-- 1. Hasil hanya dapat dibaca oleh akun guru pemilik kode kelas.
-- 2. Murid mengirim hasil melalui fungsi terkontrol; tidak ada akses SELECT publik.
-- 3. Simpan data minimal: nama murid, kelas, nilai, jawaban, bukti berpikir, refleksi.
-- 4. Untuk menonaktifkan seluruh kode milik guru, jalankan dari SQL Editor:
--    update public.tka_teacher_codes set active = false where teacher_id = 'UUID-AKUN-GURU';
