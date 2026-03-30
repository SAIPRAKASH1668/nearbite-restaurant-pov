# Xcode: “Package resolution error must be fixed before building”

This app uses **Swift Package Manager** for Capacitor iOS (`CapApp-SPM` + `capacitor-swift-pm` from GitHub + local packages under `node_modules`).

## “Missing package product CapApp-SPM”

Xcode shows this when the **local package** at `ios/App/CapApp-SPM` did not load successfully. The app target still asks for the library product `CapApp-SPM`, but SPM never finished resolving that package (or the folder/path is wrong).

**Fix (same order as below):**

1. **Open the correct project:** `ios/App/App.xcodeproj`  
   The package reference is **relative** to that project: `CapApp-SPM` = `ios/App/CapApp-SPM`. Opening only `ios/` or a copied folder breaks the path.

2. **Ensure the folder exists:** you should have `ios/App/CapApp-SPM/Package.swift`. If it’s missing, from repo root run:
   ```bash
   npm install
   npx cap sync ios
   ```

3. **Ensure `node_modules` exists** at the **repo root** — `CapApp-SPM/Package.swift` references `../../../node_modules/@capacitor/...`. No `node_modules` → local plugin packages fail → Xcode often reports **missing product** instead of a clear path error.

4. **Resolve packages:** **File → Packages → Reset Package Caches**, then **Resolve Package Versions**. Fix any red errors under the **Package Dependencies** tree first.

5. **CLI check** (shows the real error if Xcode’s message is vague):
   ```bash
   cd ios/App/CapApp-SPM && swift package resolve
   ```

Once `swift package resolve` succeeds and caches are reset, **Missing package product CapApp-SPM** usually disappears.

## 1. Fix order (try in sequence)

### A. Install JS deps **before** Xcode resolves packages

From the **project root** (`nearbite-restaurant-pov/`):

```bash
npm install
```

`Package.swift` points at `../../../node_modules/@capacitor/...`. If `node_modules` is missing or incomplete, SPM **cannot** resolve local packages.

### B. Regenerate native iOS + SPM manifest

```bash
npm run build:prod
npx cap sync ios
```

Always run **`cap sync ios`** after adding/removing Capacitor plugins or changing `@capacitor/*` versions.

### C. Reset Swift packages in Xcode

1. Open **`ios/App/App.xcodeproj`** (not a random folder).
2. Menu **File → Packages → Reset Package Caches**
3. Menu **File → Packages → Resolve Package Versions**  
   Wait until the progress indicator finishes (first time may download **Capacitor.xcframework** / **Cordova.xcframework** — large downloads).

### D. Clear stale lockfile (if Xcode still complains)

With Xcode **closed**:

```bash
rm -f ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
```

Reopen the project and **Resolve Package Versions** again.

### E. Clear Derived Data

With Xcode **closed**:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

Reopen the project.

## 2. Requirements

- **Xcode 15+** (Swift 5.9+; Capacitor 8 iOS targets iOS 15+).
- Network access to **`https://github.com/ionic-team/capacitor-swift-pm.git`** and GitHub **releases** (binary XCFrameworks). Corporate proxies/firewalls often block this and cause resolution failures.

## 3. Verify from Terminal (same machine as Xcode)

```bash
cd ios/App/CapApp-SPM
swift package resolve
```

If this fails, the error text usually points to the real issue (network, path, or version conflict).

## 4. Keep Capacitor versions aligned

Use the **same major** (e.g. 8.x) for `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, and `@capacitor/android`. Official **plugins** may ship slightly lower patch versions (e.g. `8.0.x`) — that is normal; their `Package.swift` still depends on `capacitor-swift-pm` 8.x.

**Note:** `ios/App/CapApp-SPM/Package.swift` is **generated** by `npx cap sync ios` — avoid hand-editing; fix `package.json` + run `cap sync` instead.
