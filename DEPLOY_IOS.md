# iOS App — Deployment Guide

## Reality check first
- **Wallpaper will never work on iOS** — Apple provides no API for it, regardless
  of this being a Capacitor app. The Settings screen already hides that section
  on iOS automatically (`isNativeWallpaperAvailable()` checks for Android).
- **Push notifications already work on iOS today**, with zero native app needed —
  Safari 16.4+ supports Web Push once the site is added to the Home Screen.
- This guide is for the *additional* step of getting a real native app in the
  App Store — mainly useful for discoverability/one-tap install, not new features.

## Cost
**$99/year** — the Apple Developer Program. This is unavoidable for App Store
distribution; there's no free tier that supports it (the free tier only allows
installing to your own device for 7-day expiring builds, not real distribution).

## What's already done
- `ios/` — native Xcode project generated via Capacitor (`npx cap add ios`)
- `.github/workflows/build-ios.yml` — two-stage cloud build:
  - **Stage 1 (`build-simulator`)**: free, runs automatically, no Apple account
    needed. Just validates the code compiles, on GitHub's macOS runners.
  - **Stage 2 (`build-and-archive-signed`)**: produces a real signed `.ipa` for
    TestFlight/App Store. Stays inactive until you complete the steps below.

## Steps to activate Stage 2 (all done through Apple's website + GitHub, no local Mac)

### 1. Enroll in the Apple Developer Program
Go to https://developer.apple.com/programs/enroll/ — $99/year, takes Apple
anywhere from a few hours to 2 days to approve.

### 2. Find your Team ID
Once enrolled: https://developer.apple.com/account → **Membership Details** →
copy the **Team ID** (10-character code). Put it into `ios/App/ExportOptions.plist`,
replacing `REPLACE_WITH_YOUR_TEAM_ID`.

### 3. Create an App Store Connect record
Go to https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**.
- Bundle ID: `com.arsenengabo.versewarship` (must match exactly — already set in the Xcode project)
- Fill in name, language, SKU (any unique string, e.g. `versewarship001`)

### 4. Create a Distribution Certificate
This is the part that normally wants Xcode open on a Mac. Since you don't have
one, the cleanest no-Mac path is generating it through the Apple Developer
website directly:
1. https://developer.apple.com/account/resources/certificates/list → **+**
2. Choose **Apple Distribution**
3. You need a Certificate Signing Request (CSR) file — generate one without a
   Mac using OpenSSL (works in Git Bash on Windows, which you already have):
   ```bash
   openssl req -new -newkey rsa:2048 -nodes -keyout ios_distribution.key -out ios_distribution.csr -subj "/CN=Your Name/emailAddress=you@example.com"
   ```
4. Upload `ios_distribution.csr` on the Apple page, download the resulting
   `.cer` file
5. Convert it to a `.p12` (the format GitHub Actions needs) using OpenSSL:
   ```bash
   openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
   openssl pkcs12 -export -out distribution.p12 -inkey ios_distribution.key -in distribution.pem -password pass:SOME_PASSWORD_YOU_CHOOSE
   ```
6. Base64-encode it for storing as a GitHub secret:
   ```bash
   base64 -w 0 distribution.p12 > distribution_base64.txt
   ```
   (on Mac/Linux use `base64 -i distribution.p12`)

### 5. Create a Provisioning Profile
1. https://developer.apple.com/account/resources/profiles/list → **+**
2. Choose **App Store Connect** (distribution) → select your app's Bundle ID
   → select the distribution certificate from step 4 → download the
   `.mobileprovision` file
3. Base64-encode it the same way:
   ```bash
   base64 -w 0 profile.mobileprovision > profile_base64.txt
   ```

### 6. Add GitHub repository secrets
Same place as before (Settings → Secrets and variables → Actions → New repository secret):

| Secret name | Value |
|---|---|
| `IOS_DIST_CERTIFICATE_BASE64` | contents of `distribution_base64.txt` |
| `IOS_DIST_CERTIFICATE_PASSWORD` | the password you chose in step 4.6 |
| `IOS_PROVISIONING_PROFILE_BASE64` | contents of `profile_base64.txt` |
| `IOS_TEMP_KEYCHAIN_PASSWORD` | any new random password (just used temporarily on the CI runner) |

### 7. Turn on the signed build stage
GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** tab
(not Secrets — Variables) → **New repository variable**:
- Name: `IOS_SIGNING_READY`
- Value: `true`

This flips on the second job in the workflow, which was skipped until now.

### 8. Push and build
```bash
git add .
git commit -m "Add iOS app scaffold"
git push
```
Check the **Actions** tab — `build-simulator` runs immediately either way (free).
`build-and-archive-signed` will now also run, producing a signed `.ipa` artifact.

### 9. Upload to TestFlight / App Store
Download the `.ipa` artifact from the Actions run, then upload it via
**Transporter** (Apple's free upload app — but this one specifically needs a Mac
or Windows PC; Apple doesn't offer a fully browser-based uploader) or via
`xcrun altool`/`notarytool` from a CI step if you'd rather automate that too
(possible, but let's get the signed build working first before adding that).

## Honest summary of the no-Mac tradeoff
Every step above works without owning a Mac. It's genuinely more manual than
Android's flow though — Apple's tooling assumes Xcode, so we're routing around
that with OpenSSL and the website. If any step trips up, the error usually
shows exactly which file/value is malformed — paste it and we'll fix it, same
as we did with the Android build errors.
