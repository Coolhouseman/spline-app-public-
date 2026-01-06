# Deployment Guide - Hosting Your Website on the Cloud

This guide will walk you through deploying your Next.js website to the cloud using **Vercel** (the easiest and cheapest option for Next.js projects) and setting up cloud storage for your images.

## Why Vercel?

- ✅ **Free tier is generous** - Perfect for personal/small business sites
- ✅ **Zero-config deployment** - Designed specifically for Next.js
- ✅ **Automatic HTTPS** - SSL certificates included
- ✅ **Global CDN** - Fast loading worldwide
- ✅ **Automatic deployments** - Deploys on every git push
- ✅ **Built-in analytics** - Free tier includes basic analytics
- ✅ **Environment variables** - Easy to manage secrets

## Prerequisites

1. A GitHub account (free)
2. Your code pushed to a GitHub repository
3. A Gmail account (for contact form emails - you already have this)

---

## Part 1: Prepare Your Code for Deployment

### Step 1: Push Your Code to GitHub

1. Go to [GitHub.com](https://github.com) and create a new repository (if you haven't already)
2. Name it something like `mundi-collesi-website`
3. Follow these commands in your terminal:

```bash
cd "/Users/henryry/Documents/apps/web/Mondi Colessi/web"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

> **Note:** Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

---

## Part 2: Deploy to Vercel

### Step 2: Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended - makes deployment automatic)
4. Authorize Vercel to access your GitHub account

### Step 3: Deploy Your Website

1. Once logged in, click **"Add New..."** → **"Project"**
2. Import your GitHub repository (the one you just created)
3. Vercel will auto-detect it's a Next.js project
4. **Configure Project Settings:**
   - **Root Directory:** Leave as default or set to `web` if your Next.js code is in a subfolder
   - **Framework Preset:** Should auto-detect "Next.js"
   - **Build Command:** `npm run build` (auto-filled)
   - **Output Directory:** `.next` (auto-filled)
   - **Install Command:** `npm install` (auto-filled)

5. **Add Environment Variables:**
   - Click **"Environment Variables"**
   - Add these two variables:
     ```
     GMAIL_USER = your-email@gmail.com
     GMAIL_APP_PASSWORD = your-gmail-app-password
     ```
   - ⚠️ **Important:** To get your Gmail App Password:
     - Go to your Google Account settings
     - Security → 2-Step Verification (must be enabled)
     - App passwords → Generate new app password
     - Copy the 16-character password and paste it as `GMAIL_APP_PASSWORD`

6. Click **"Deploy"**

### Step 4: Wait for Deployment

- Vercel will automatically:
  - Install dependencies
  - Build your Next.js app
  - Deploy it to a live URL
- This takes 2-5 minutes
- You'll get a URL like: `your-project-name.vercel.app`

### Step 5: Test Your Live Website

1. Visit the URL Vercel provided
2. Test the contact form
3. Check all pages load correctly

**🎉 Congratulations! Your website is now live!**

---

## Part 3: Set Up Custom Domain (Optional)

If you want to use `mundicollesi.com` instead of `your-project.vercel.app`:

### Step 6: Add Custom Domain in Vercel

1. In Vercel dashboard, go to your project
2. Click **"Settings"** → **"Domains"**
3. Enter your domain (e.g., `mundicollesi.com`)
4. Follow Vercel's instructions to update your DNS records
5. Usually involves adding a CNAME or A record in your domain registrar (GoDaddy, Namecheap, etc.)

**Cost:** Domain registration ~$10-15/year. Vercel domain hosting is FREE.

---

## Part 4: Set Up Cloud Storage for Images

You have two great options for image storage:

### Option A: Vercel Blob Storage (Recommended - Easiest)

**Pros:** Integrated with Vercel, very easy to use, generous free tier  
**Cons:** Newer service (but stable)

#### Step 7A: Set Up Vercel Blob

1. In Vercel dashboard, go to **"Storage"** tab
2. Click **"Create Database"** → Choose **"Blob"**
3. Name it (e.g., `mundi-collesi-images`)
4. Choose a region (closest to your users)
5. Copy the `BLOB_READ_WRITE_TOKEN` that Vercel provides

#### Step 7B: Install Vercel Blob Package

```bash
cd "/Users/henryry/Documents/apps/web/Mondi Colessi/web"
npm install @vercel/blob
```

#### Step 7C: Create Upload API Route

Create a new file: `web/src/app/api/upload/route.ts`

```typescript
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const blob = await put(file.name, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

#### Step 7D: Add Environment Variable

1. In Vercel dashboard → Your project → Settings → Environment Variables
2. Add:
   ```
   BLOB_READ_WRITE_TOKEN = your-token-from-vercel
   ```

#### Step 7E: Update next.config.mjs

Update `web/next.config.mjs` to allow images from Vercel Blob:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
```

**Cost:** FREE tier: 1GB storage, 100GB bandwidth/month

---

### Option B: Cloudinary (Popular Alternative)

**Pros:** Very popular, mature service, great image optimization  
**Cons:** Slightly more complex setup

#### Step 7: Set Up Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com) (free account)
2. Go to Dashboard → Copy your:
   - Cloud name
   - API Key
   - API Secret

3. Install Cloudinary package:
```bash
npm install cloudinary
```

4. Create upload API: `web/src/app/api/upload/route.ts`
```typescript
import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'auto' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    return NextResponse.json({ url: (result as any).secure_url });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

5. Add environment variables in Vercel:
   ```
   CLOUDINARY_CLOUD_NAME = your-cloud-name
   CLOUDINARY_API_KEY = your-api-key
   CLOUDINARY_API_SECRET = your-api-secret
   ```

6. Update `next.config.mjs`:
```javascript
remotePatterns: [
  {
    protocol: 'https',
    hostname: 'images.unsplash.com',
  },
  {
    protocol: 'https',
    hostname: 'res.cloudinary.com',
  },
],
```

**Cost:** FREE tier: 25GB storage, 25GB bandwidth/month

---

## Part 5: Upload Images to Your Website

### Create an Admin Upload Page (Optional but Recommended)

You can create a simple admin page to upload images. Or use a tool like:

1. **Vercel Blob:** Use their dashboard at vercel.com/storage
2. **Cloudinary:** Use their Media Library dashboard
3. **Create your own:** Build a simple upload page in your Next.js app

### Using Images in Your Code

Once uploaded, use the URLs in your components:

```typescript
// Instead of Unsplash URLs:
<Image src="https://images.unsplash.com/..." />

// Use your cloud storage URLs:
<Image src="https://your-blob-url.public.blob.vercel-storage.com/image.jpg" />
// or
<Image src="https://res.cloudinary.com/your-cloud/image/upload/v123/image.jpg" />
```

---

## Summary: Quick Checklist

- [ ] Push code to GitHub
- [ ] Sign up for Vercel
- [ ] Deploy project to Vercel
- [ ] Add Gmail environment variables
- [ ] Test contact form on live site
- [ ] Choose image storage (Vercel Blob or Cloudinary)
- [ ] Set up image storage account
- [ ] Add storage environment variables
- [ ] Update next.config.mjs for image domains
- [ ] Upload your images
- [ ] Update image URLs in your code
- [ ] (Optional) Add custom domain

---

## Costs Breakdown

| Service | Free Tier | Paid Plans Start At |
|---------|-----------|---------------------|
| **Vercel Hosting** | Unlimited projects, 100GB bandwidth/month | $20/month (Pro) |
| **Vercel Blob** | 1GB storage, 100GB bandwidth | $10/month (1TB) |
| **Cloudinary** | 25GB storage, 25GB bandwidth | ~$89/month |
| **Domain** | N/A | ~$10-15/year |

**For your use case (small business website): The FREE tier should be sufficient!**

---

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Vercel Blob Docs: https://vercel.com/docs/storage/vercel-blob
- Cloudinary Docs: https://cloudinary.com/documentation

