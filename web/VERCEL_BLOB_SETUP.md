# Vercel Blob Storage Setup Guide

## Step-by-Step: Set Up Image Storage

### Step 1: Create Blob Storage in Vercel Dashboard ✅

1. Go to your Vercel project: `mundi-collesi-website`
2. Click the **"Storage"** tab (in top navigation or Settings)
3. Click **"Create Database"**
4. Select **"Blob"**
5. Configure:
   - **Name:** `mundi-collesi-images`
   - **Region:** Choose closest to you (e.g., `Washington, D.C. (us-east-1)`)
6. Click **"Create"**
7. **COPY the `BLOB_READ_WRITE_TOKEN`** - you'll need this!

---

### Step 2: Add Environment Variable in Vercel

1. In your Vercel project, go to **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Add:
   - **Key:** `BLOB_READ_WRITE_TOKEN`
   - **Value:** Paste the token you copied from Step 1
   - **Environment:** Select all (Production, Preview, Development)
4. Click **"Save"**

---

### Step 3: Install Package & Create Upload API (I'll do this for you)

Once you confirm Step 1 & 2 are done, I'll:
- Install `@vercel/blob` package
- Create the upload API route
- Update `next.config.mjs` to allow Vercel Blob images

---

### Step 4: Test Image Upload

After setup, you can:
- Upload images via API
- Use uploaded images in your website
- Images will be stored in Vercel Blob and served via CDN

---

## Next Steps After Setup

You can:
1. Upload images manually via code
2. Create an admin upload page (I can help with this)
3. Use the image URLs in your components

