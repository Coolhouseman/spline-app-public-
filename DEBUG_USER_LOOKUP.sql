-- Debug: Check if users exist in the database
-- Run this in your Supabase SQL Editor to see what's happening

-- 1. List all users in auth.users (Supabase Auth)
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. List all users in public.users (your app's user profiles)
SELECT id, name, email, unique_id, created_at 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Find users in auth but NOT in public.users (orphaned auth users)
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- 4. Check RLS policies on users table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';
