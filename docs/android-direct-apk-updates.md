# Android Direct APK Updates

This app can force-update Android builds from an APK hosted outside Google Play.

## S3 Files

Upload two public HTTPS-readable files:

- `update.json`
- `yumdude-partner-<versionName>.apk`

Use `android-update-manifest.example.json` as the manifest shape.

The APK must be signed with the same signing key as the installed app and must have a higher `versionCode`.
Android devices cannot install an AAB directly, so publish an APK for this flow.

## App Configuration

Set `androidUpdateManifestUrl` in:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Example:

```ts
androidUpdateManifestUrl: 'https://your-s3-bucket.s3.amazonaws.com/yumdude-partner/update.json',
```

## SHA-256

Generate the APK checksum before updating the manifest:

```powershell
Get-FileHash .\app-release.apk -Algorithm SHA256
```

Paste the lowercase hash into the manifest `sha256` field.

## Runtime Flow

1. App opens and fetches the manifest.
2. If installed `versionCode` is below `minRequiredVersionCode`, the UI is blocked.
3. User grants "install unknown apps" permission if Android asks.
4. App downloads the APK over HTTPS.
5. Native code verifies SHA-256.
6. Android package installer asks the user to approve the update.
7. After approval, reopen YumDude Partner.

S3 must allow public HTTPS `GET` access to both files. The app reads the manifest through native Android code, so browser CORS is not required for `update.json`.
