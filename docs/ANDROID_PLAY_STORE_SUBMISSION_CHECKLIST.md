# Android Play Store submission checklist

Use this checklist to submit Spline **v1.2.4** (versionCode **23**) to Google Play for review. Package: `com.splitpaymentapp.split`.

---

## 1. Build the Android app (AAB)

From the project root, build a production Android App Bundle for Play Store:

```bash
eas build --platform android --profile production
```

Wait for the build to finish on EAS. When done, either:

- **Option A – Download and upload manually:** Download the `.aab` from the EAS build page (or from the link in the terminal), then use it in Step 2.
- **Option B – Submit with EAS (if configured):** If you add a Play Store service account to EAS, you can run:
  ```bash
  eas submit --platform android --profile production --latest
  ```
  and skip the manual upload in Step 2.

---

## 2. Open Play Console and select the app

- Go to [Google Play Console](https://play.google.com/console) and sign in with the account that owns the app.
- Select **Spline** (package `com.splitpaymentapp.split`).

---

## 3. Create a new release (Production or Testing)

**For Production (public release):**

- In the left menu go to **Release** → **Production** (or **Testing** → **Internal testing** / **Closed testing** if you want to test first).
- Click **Create new release**.

**If you prefer to test first:**

- Use **Testing** → **Internal testing** or **Closed testing**, then **Create new release** there. You can promote the same release to Production later.

---

## 4. Upload the AAB

- In the release screen, under **App bundles**, click **Upload** (or drag and drop).
- Choose the `.aab` file from your EAS build (Step 1).
- Wait until Google finishes processing the bundle (status will show when it’s ready).
- If Play Console asks you to enable **App signing by Google Play**, confirm it (recommended).

---

## 5. Add release details

- **Release name:** Optional; e.g. `1.2.4 (23)` or leave default.
- **Release notes:** Add “What’s new” for this version (e.g. for each language you support). Example:
  - **English (en-US):** “Bug fixes and improvements including login and cold start reliability.”
- Click **Save** (or **Next** depending on the screen).

---

## 6. Complete store listing and policy requirements

Before you can submit for review, ensure:

- **Main store listing:** App name, short description, full description, screenshots, icon, feature graphic. All required fields must be filled.
- **Content rating:** Questionnaire completed and rating applied.
- **Target audience:** Age group and store listing declarations set.
- **Privacy policy:** URL set if your app collects user data. Use a live HTTPS URL on your domain (not an old Replit URL). **Spline:** `https://www.spline.nz/privacy`
- **Account deletion URL (Data safety):** Required when users can create an account. **Spline:** `https://www.spline.nz/delete-account` (form + instructions; also see `server/public/delete-account.html`).
- **Ads declaration:** If the app shows ads, declare it in the appropriate section.
- **Data safety:** Data types and usage described in the Data safety form.

Fix any errors or warnings shown in the **Release** or **Policy and programs** sections.

---

## 7. Review and start rollout (submit for review)

- In your release (Production or Testing), click **Review release** (or **Next** until you reach the review step).
- Check the summary: version (1.2.4), versionCode (23), release notes, and any warnings.
- Click **Start rollout to Production** (or **Start rollout to [testing track]**).

Google will review the release. Status will move to **In review**, then **Approved** (or you’ll get feedback if changes are needed). For Production, after approval the app will go live according to your rollout percentage (e.g. 100% or staged).

---

## 8. After submission

- Check **Release** → **Production** (or your testing track) for status and any messages from Play.
- If rejected, open the email or the Console message, fix the issues, then create a new release with an updated build if required (e.g. new versionCode in `app.json` and a new EAS build).

---

## Quick reference

| Field        | Value                    |
|-------------|--------------------------|
| Package     | `com.splitpaymentapp.split` |
| Version     | 1.2.4                    |
| versionCode | 23                       |
| Build       | EAS `production` profile  |

---

## Troubleshooting: Android build failed (Gradle)

If `eas build --platform android --profile production` fails with **"Gradle build failed with unknown error. See logs for the Run gradlew phase"**:

### 1. Get the exact error from the build logs

- Open the build URL from the terminal (e.g. `https://expo.dev/accounts/zimingzeng/projects/spline/builds/...`).
- In the build page, open the **Run gradlew** step and scroll to the bottom of the log.
- Look for the first **FAILURE** or red error (e.g. "No matching variant", "Duplicate class", "compileSdkVersion", or a specific module like `:stripe_stripe-react-native`). That message is what you need to fix.

### 2. Clear EAS cache and rebuild

Stale Gradle or native caches often cause "unknown" failures. Rerun with cache cleared:

```bash
eas build --platform android --profile production --clear-cache
```

### 3. Align dependencies with Expo 54

Your project had version mismatches (including `@stripe/stripe-react-native`). Install Expo‑recommended versions:

```bash
npx expo install --fix
```

This can downgrade Stripe to the version expected for Expo 54 (e.g. 0.50.x). If you need a newer Stripe later, check [Expo’s Stripe docs](https://docs.expo.dev/versions/latest/sdk/stripe/) for the compatible version. Then try the build again.

### 4. If it still fails

- Paste the **exact** Gradle error line from the build log (from step 1) into a search or ask for help; the fix depends on that message.
- Known causes: **Stripe** native module vs. Expo/AGP, **New Architecture** (`newArchEnabled: true` in `app.json`) with some native modules, or EAS image/AGP changes. Fix depends on the log.
