# Step-by-Step: Deploy to Vercel

## Step 1: Sign Up for Vercel

1. Go to **[vercel.com](https://vercel.com)** in your browser
2. Click the **"Sign Up"** button (top right)
3. Choose **"Continue with GitHub"** (this is recommended because it makes deployment automatic)
4. Authorize Vercel to access your GitHub account
5. You'll be logged into Vercel

---

## Step 2: Import Your Repository

1. Once you're logged in, you'll see the Vercel dashboard
2. Click the **"Add New..."** button (top right, big button)
3. Select **"Project"** from the dropdown
4. You'll see a list of your GitHub repositories
5. Find and click **"mundi-collesi-website"** (or search for it)
6. Click the **"Import"** button next to your repository

---

## Step 3: Configure Your Project

Vercel will auto-detect it's a Next.js project! But you need to set one important thing:

### ⚠️ IMPORTANT: Root Directory Setting

Since your Next.js code is in a `web` subfolder, you need to:

1. Look for **"Root Directory"** setting
2. Click **"Edit"** next to it
3. Select or type: **`web`**
4. Click **"Continue"**

This tells Vercel where your Next.js code is located!

---

## Step 4: Add Environment Variables

Your contact form needs Gmail credentials. Before deploying, let's set these up:

1. In the deployment settings, look for **"Environment Variables"** section
2. Click to expand it
3. Add these two variables:

**Variable 1:**
- **Key:** `GMAIL_USER`
- **Value:** Your Gmail address (e.g., `yourname@gmail.com`)
- Click **"Add"**

**Variable 2:**
- **Key:** `GMAIL_APP_PASSWORD`
- **Value:** Your Gmail App Password (see instructions below if you need to create one)

---

## Step 5: Get Your Gmail App Password (If Needed)

If you don't have a Gmail App Password yet:

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click **"Security"** (left sidebar)
3. Make sure **"2-Step Verification"** is turned ON (if not, enable it first)
4. Scroll down and click **"App passwords"** (under "Signing in to Google")
5. Select **"Mail"** as the app
6. Select **"Other (Custom name)"** as the device
7. Type: "Vercel Website"
8. Click **"Generate"**
9. **COPY the 16-character password** (you'll only see it once!)
10. Paste it as the value for `GMAIL_APP_PASSWORD` in Vercel

---

## Step 6: Deploy!

1. Scroll down and click the big **"Deploy"** button
2. Vercel will now:
   - Install your dependencies (`npm install`)
   - Build your Next.js app (`npm run build`)
   - Deploy it to a live URL
3. **This takes 2-5 minutes** - you'll see a progress log
4. Wait for the "Building" and "Deploying" steps to complete

---

## Step 7: Your Website is Live! 🎉

1. Once deployment is complete, you'll see a **"Visit"** button
2. Click it, or you'll see a URL like: `mundi-collesi-website.vercel.app`
3. **Your website is now live on the internet!**

---

## Step 8: Test Your Website

1. Visit your live URL
2. Browse through all pages (Home, Collections, Journal, etc.)
3. **Test the contact form:**
   - Fill out the form
   - Submit it
   - Check your Gmail inbox - you should receive the inquiry!

---

## Troubleshooting

**If deployment fails:**
- Check the build logs in Vercel (they'll show what went wrong)
- Make sure "Root Directory" is set to `web`
- Common issues: Missing dependencies (but this should be fine for your project)

**If contact form doesn't work:**
- Double-check environment variables are set correctly
- Make sure Gmail App Password is correct (16 characters, no spaces)
- Check Vercel logs: Project → Deployments → Click a deployment → Logs

**If you need to update environment variables later:**
- Go to your project in Vercel
- Settings → Environment Variables
- Add/edit/delete variables
- Redeploy (or they'll apply on next deployment)

---

## Next Steps

Once your website is live:
1. ✅ Test everything works
2. Set up image storage (see DEPLOYMENT.md Part 4)
3. (Optional) Add custom domain (see DEPLOYMENT.md Part 3)

