# 🔧 Fix Signup & Login Issues

## Problem
- ✅ Users ARE being created in Supabase Auth
- ❌ Users CANNOT be created in the `users` table (blocked by RLS)
- ❌ Login fails because there's no user profile to fetch

## Root Cause
Missing INSERT policy on the `users` table. RLS is blocking new profile creation.

## ✅ Solution (2 minutes)

### Go to Your Supabase Dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Copy and paste this SQL command:

```sql
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
```

5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see: "Success. No rows returned"

### Test It

1. Go back to your app
2. Try signing up with a new email
3. The signup should now complete successfully
4. You should be redirected to the home page

## What This Does

This RLS policy allows authenticated users to insert their own profile into the `users` table **only** when the user ID matches their authenticated ID. This is secure and prevents users from creating profiles for other people.

## Already Have Test Accounts?

If you created test accounts before adding this policy, they exist in Supabase Auth but have no profile. You have two options:

1. **Delete them**: Go to Authentication > Users, delete test accounts, then sign up again
2. **Keep them**: Just sign up with a new email address instead
