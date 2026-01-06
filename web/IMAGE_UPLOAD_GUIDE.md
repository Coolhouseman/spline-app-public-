# Image Upload & Replacement Guide

## How to Upload Images to Vercel Blob

### Method 1: Via Vercel Dashboard (Easiest)

1. Go to your Vercel dashboard
2. Navigate to: **Storage** → **mundi-collesi-images** (your Blob store)
3. Click on the **"Browser"** tab
4. Click **"Upload"** or drag & drop your images
5. After upload, click on an image to see its URL
6. **Copy the URL** - it will look like:
   ```
   https://[random-id].public.blob.vercel-storage.com/your-image.jpg
   ```

### Method 2: Via Command Line Script (Alternative)

I can create a simple script for you to upload images from your computer. Let me know if you want this option.

---

## Images to Replace

Here are all the places where placeholder images need to be replaced:

### 1. Hero Section (Homepage)
- **File:** `src/components/sections/Hero.tsx`
- **Line 24:** Hero background image

### 2. Feature Section (Homepage)
- **File:** `src/components/sections/FeatureSection.tsx`
- **3 images:** Post-Modern Flora, Immersive Atmosphere, The Fabric of Luxury

### 3. Collections Page
- **File:** `src/app/collections/page.tsx`
- **3 collection thumbnails**

### 4. Collection Detail Pages
- **File:** `src/app/collections/[slug]/page.tsx`
- **3 collections × 3 images each = 9 images**

### 5. Philosophy Page
- **File:** `src/app/philosophy/page.tsx`
- **1 hero image**

### 6. Materials Page
- **File:** `src/app/materials/page.tsx`
- **4 images:** Silk Fabric, Pearlescent Texture, Seamless Installation, Custom Color

### 7. Journal/Blog Posts
- **File:** `src/lib/blog.ts`
- **8 blog post cover images**

### 8. Metadata Images (SEO)
- **File:** `src/app/layout.tsx`
- **Open Graph and Twitter images**

---

## Workflow

1. **Upload all images to Vercel Blob** (via dashboard)
2. **Copy all the URLs** into a document
3. **Update the code locally** with your image URLs
4. **Test locally** to make sure everything looks good
5. **Commit and push** when you're happy
6. **Vercel will automatically deploy** your changes

---

## Example: How to Replace an Image

**Before:**
```typescript
<Image src="https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2680&auto=format&fit=crop" />
```

**After:**
```typescript
<Image src="https://[your-blob-id].public.blob.vercel-storage.com/hero-image.jpg" />
```

---

## Tips

- Name your images descriptively when uploading (e.g., `hero-background.jpg`, `royal-gardens-thumbnail.jpg`)
- Keep a list of which image URL goes where
- Test locally before pushing to production

