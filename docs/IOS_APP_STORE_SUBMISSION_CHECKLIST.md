# iOS App Store submission checklist

Use this checklist to submit your TestFlight build (Spline v1.2.4, build 44) for App Store review.

---

## 1. Ensure the build is in TestFlight

Run in your terminal (you will be prompted for Apple ID / app-specific password):

```bash
# If you have already built: submit the latest production build
eas submit --platform ios --profile production --latest
```

If you need to build and submit in one go:

```bash
eas build --platform ios --profile production --auto-submit
```

Wait until the build appears in App Store Connect under **TestFlight** and processing completes.

---

## 2. Open App Store Connect and select the app

- Go to [App Store Connect](https://appstoreconnect.apple.com) and sign in.
- Click **My Apps**, then open **Spline** (bundle ID `com.splitpaymentapp.split`).

---

## 3. Create or open the App Store version

- Under **iOS App**, select **App Store** (not TestFlight).
- Open the version **1.2.4** if it exists, or click **Add Version** and enter **1.2.4**.

---

## 4. Select the build

- In **Build**, click **Select a build**.
- Choose **1.2.4 (44)** from the list.
- Save.

---

## 5. Complete required metadata

- **What’s New in This Version**: e.g. “Bug fixes and improvements including login and cold start reliability.”
- Fix any warnings for App Privacy, Pricing, App Information, or Version Information.
- Complete export compliance or content rights if prompted.

---

## 6. Submit for review

- Click **Add for Review** / **Submit for Review**.
- Answer the questionnaire (encryption, advertising, sign-in).
- Choose **Manual Release** or **Automatically release** after approval.
- Click **Submit to App Review**.

---

## 7. After submission

- Status: **Waiting for Review** → **In Review** → **Ready for Sale** (or **Pending Developer Release**).
- Check the same version in App Store Connect for status and any messages from App Review.
