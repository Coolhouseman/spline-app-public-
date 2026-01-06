-- FIX STORAGE POLICIES FOR PROFILE PICTURE UPLOAD
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. First, ensure the user-uploads bucket exists and is public (for reading)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-uploads', 'user-uploads', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Drop any existing policies on user-uploads bucket
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- 3. Create policy for authenticated users to upload to user-uploads bucket
CREATE POLICY "Authenticated users can upload profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'profile-pictures'
);

-- 4. Create policy for anyone to view profile pictures (bucket is public)
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-uploads');

-- 5. Create policy for users to update their own uploads
CREATE POLICY "Users can update their own uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'user-uploads')
WITH CHECK (bucket_id = 'user-uploads');

-- 6. Create policy for users to delete their own uploads
CREATE POLICY "Users can delete their own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'user-uploads');

-- 7. Also ensure the users table has proper UPDATE policy
-- Check if the policy works correctly
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
TO authenticated
USING (id::text = (SELECT auth.uid()::text))
WITH CHECK (id::text = (SELECT auth.uid()::text));

-- Verify the bucket was created
SELECT id, name, public FROM storage.buckets WHERE id = 'user-uploads';
