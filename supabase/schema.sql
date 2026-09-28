-- Run on the existing Dinglo Supabase project. All tables are isolated with social_ prefixes.
create table public.social_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  bio text not null default '' check (char_length(bio) <= 280),
  created_at timestamptz not null default now()
);
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.social_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.social_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.social_profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
create table public.social_follows (
  follower_id uuid not null references public.social_profiles(id) on delete cascade,
  following_id uuid not null references public.social_profiles(id) on delete cascade,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index social_posts_created_idx on public.social_posts (created_at desc);
create index social_comments_post_idx on public.social_comments (post_id, created_at);
create index social_follows_following_idx on public.social_follows (following_id);

-- Circle profiles are created on first sign-in through Express.
alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_follows enable row level security;

create policy "profiles visible" on public.social_profiles for select to authenticated using (true);
create policy "create own profile" on public.social_profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "edit own profile" on public.social_profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "posts visible" on public.social_posts for select to authenticated using (true);
create policy "make own post" on public.social_posts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "remove own post" on public.social_posts for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "comments visible" on public.social_comments for select to authenticated using (true);
create policy "make own comment" on public.social_comments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "remove own comment" on public.social_comments for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "likes visible" on public.social_likes for select to authenticated using (true);
create policy "like as self" on public.social_likes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "unlike as self" on public.social_likes for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "follows visible" on public.social_follows for select to authenticated using (true);
create policy "follow as self" on public.social_follows for insert to authenticated
  with check ((select auth.uid()) = follower_id);
create policy "unfollow as self" on public.social_follows for delete to authenticated
  using ((select auth.uid()) = follower_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.social_profiles to authenticated;
grant select, insert, delete on public.social_posts, public.social_comments, public.social_likes, public.social_follows to authenticated;
