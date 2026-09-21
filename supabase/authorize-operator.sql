-- First create an email/password user in Authentication > Users, or sign in once with Google.
-- Replace the email below with the exact email of that account, then run in SQL Editor.
insert into public.operators(user_id)
select id from auth.users where lower(email)=lower('jagdishpanada2000@gmail.com')
on conflict(user_id) do nothing;

-- This should return your authorized account after the insertion.
select u.email, o.created_at from public.operators o join auth.users u on u.id=o.user_id;
