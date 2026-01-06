# Step-by-Step Guide: Push Your Project to GitHub

## Part 1: Create a New Repository on GitHub (5 minutes)

### Step 1: Go to GitHub.com
1. Open your browser and go to [github.com](https://github.com)
2. **Sign in** to your account (you mentioned you already have one)

### Step 2: Create a New Repository
1. Click the **"+" icon** in the top right corner (next to your profile picture)
2. Select **"New repository"** from the dropdown menu

### Step 3: Configure Your Repository
1. **Repository name:** Enter something like `mundi-collesi-website` or `mondi-colessi`
   - Use lowercase letters and hyphens (no spaces)
   
2. **Description:** (Optional) Add a description like:
   - "Luxury hand-painted wallpaper website - Mundi Collesi"

3. **Visibility:**
   - Choose **Public** (free, anyone can see your code)
   - Or **Private** (only you can see it - recommended for business projects)

4. **⚠️ IMPORTANT - Do NOT check these boxes:**
   - ❌ Don't check "Add a README file"
   - ❌ Don't check "Add .gitignore"
   - ❌ Don't check "Choose a license"
   
   (We already have these files in your project!)

5. Click the green **"Create repository"** button

### Step 4: Copy Your Repository URL
After creating the repository, GitHub will show you a page with setup instructions.

**You'll see a URL that looks like:**
```
https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

**📋 COPY THIS URL** - You'll need it in the next steps!

---

## Part 2: Push Your Code from Terminal (5 minutes)

Now we'll use your terminal to push your code. I'll guide you through each command.

### Step 5: Open Terminal in Your Project Folder
Make sure you're in your project directory. The commands below will handle this automatically.

### Step 6: Run These Commands One by One

I'll run these commands for you, but here's what each one does:

1. **Initialize Git** - Sets up git tracking in your project
2. **Add All Files** - Stages all your files for commit
3. **Create First Commit** - Saves a snapshot of your code
4. **Rename Branch to Main** - Uses modern "main" instead of "master"
5. **Connect to GitHub** - Links your local repo to GitHub
6. **Push to GitHub** - Uploads your code

Let me run these commands for you now! Just tell me your GitHub username and repository name, OR I can guide you to run them manually.

---

## Quick Reference: Git Commands Explained

```bash
# 1. Initialize git in your project
git init

# 2. Add all files (stages them for commit)
git add .

# 3. Create your first commit (saves the snapshot)
git commit -m "Initial commit"

# 4. Rename branch to main (modern standard)
git branch -M main

# 5. Connect to your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 6. Push your code to GitHub
git push -u origin main
```

---

## What to Do Next

After you push your code:
1. Go back to GitHub.com and refresh your repository page
2. You should see all your files there! 🎉
3. Then follow the DEPLOYMENT.md guide to deploy to Vercel

---

## Troubleshooting

**If you get "repository already exists" error:**
- Delete the repository on GitHub and create a new one, OR
- Use a different repository name

**If you get authentication errors:**
- GitHub now requires Personal Access Tokens instead of passwords
- I can guide you through setting this up if needed

**If you forgot your repository URL:**
- Go to your repository on GitHub
- Click the green "Code" button
- Copy the HTTPS URL

