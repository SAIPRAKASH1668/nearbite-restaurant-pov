package com.nearbite.restaurant;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String TAG = "YumDudeAppUpdater";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode;

            JSObject ret = new JSObject();
            ret.put("versionCode", versionCode);
            ret.put("versionName", info.versionName != null ? info.versionName : "");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read app version", e);
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();

        JSObject ret = new JSObject();
        ret.put("allowed", allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + ctx.getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open install permission settings", e);
        }
    }

    @PluginMethod
    public void fetchManifest(PluginCall call) {
        String manifestUrl = call.getString("manifestUrl");
        if (manifestUrl == null || manifestUrl.trim().isEmpty()) {
            call.reject("manifestUrl is required");
            return;
        }
        if (!manifestUrl.toLowerCase(Locale.US).startsWith("https://")) {
            call.reject("Only HTTPS manifest URLs are allowed");
            return;
        }

        executor.execute(() -> {
            try {
                String json = downloadText(manifestUrl);
                JSObject ret = new JSObject();
                ret.put("json", json);
                mainHandler.post(() -> call.resolve(ret));
            } catch (Exception e) {
                Log.e(TAG, "Manifest fetch failed", e);
                call.reject(e.getMessage() != null ? e.getMessage() : "Manifest fetch failed", e);
            }
        });
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String apkUrl = call.getString("apkUrl");
        String expectedSha256 = normalizeSha256(call.getString("sha256"));

        if (apkUrl == null || apkUrl.trim().isEmpty()) {
            call.reject("apkUrl is required");
            return;
        }
        if (!apkUrl.toLowerCase(Locale.US).startsWith("https://")) {
            call.reject("Only HTTPS APK URLs are allowed");
            return;
        }
        if (expectedSha256 == null || expectedSha256.length() != 64) {
            call.reject("A valid sha256 checksum is required");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Install permission required");
            return;
        }

        executor.execute(() -> {
            File apkFile = null;
            try {
                apkFile = downloadApk(apkUrl, expectedSha256);
                launchInstaller(apkFile, call);
            } catch (Exception e) {
                if (apkFile != null && apkFile.exists() && !apkFile.delete()) {
                    Log.w(TAG, "Failed to delete rejected APK: " + apkFile.getAbsolutePath());
                }
                Log.e(TAG, "Update download/install failed", e);
                call.reject(e.getMessage() != null ? e.getMessage() : "Update failed", e);
            }
        });
    }

    private String downloadText(String manifestUrl) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(cacheBustedUrl(manifestUrl)).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("Accept", "application/json");

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            conn.disconnect();
            throw new IllegalStateException("Update manifest failed with HTTP " + code);
        }

        int maxBytes = 256 * 1024;
        byte[] buffer = new byte[8192];
        try (InputStream input = conn.getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                if (output.size() + bytesRead > maxBytes) {
                    throw new IllegalStateException("Update manifest is too large");
                }
                output.write(buffer, 0, bytesRead);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        } finally {
            conn.disconnect();
        }
    }

    private File downloadApk(String apkUrl, String expectedSha256) throws Exception {
        Context ctx = getContext();
        File updatesDir = new File(ctx.getCacheDir(), "updates");
        if (!updatesDir.exists() && !updatesDir.mkdirs()) {
            throw new IllegalStateException("Unable to create update cache directory");
        }

        File apkFile = new File(updatesDir, "yumdude-partner-update.apk");
        if (apkFile.exists() && !apkFile.delete()) {
            throw new IllegalStateException("Unable to replace old update APK");
        }

        HttpURLConnection conn = (HttpURLConnection) new URL(apkUrl).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("Accept", APK_MIME_TYPE + ", application/octet-stream");

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            conn.disconnect();
            throw new IllegalStateException("APK download failed with HTTP " + code);
        }

        long contentLength = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
            ? conn.getContentLengthLong()
            : conn.getContentLength();

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long bytesReadTotal = 0;
        long lastProgressAt = 0;
        byte[] buffer = new byte[64 * 1024];

        try (InputStream input = conn.getInputStream();
             FileOutputStream output = new FileOutputStream(apkFile)) {
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
                digest.update(buffer, 0, bytesRead);
                bytesReadTotal += bytesRead;

                long now = System.currentTimeMillis();
                if (now - lastProgressAt > 500) {
                    notifyProgress(bytesReadTotal, contentLength);
                    lastProgressAt = now;
                }
            }
            output.getFD().sync();
        } finally {
            conn.disconnect();
        }

        notifyProgress(bytesReadTotal, contentLength);

        String actualSha256 = toHex(digest.digest());
        if (!expectedSha256.equals(actualSha256)) {
            if (!apkFile.delete()) {
                Log.w(TAG, "Failed to delete APK with checksum mismatch");
            }
            throw new SecurityException("APK checksum mismatch");
        }

        return apkFile;
    }

    private void launchInstaller(File apkFile, PluginCall call) {
        mainHandler.post(() -> {
            try {
                Context ctx = getContext();
                Uri apkUri = FileProvider.getUriForFile(
                    ctx,
                    ctx.getPackageName() + ".fileprovider",
                    apkFile
                );

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, APK_MIME_TYPE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to launch Android installer", e);
            }
        });
    }

    private void notifyProgress(long bytesRead, long contentLength) {
        JSObject progress = new JSObject();
        progress.put("bytesRead", bytesRead);
        progress.put("contentLength", contentLength);
        progress.put("percent", contentLength > 0 ? Math.round((bytesRead * 100.0) / contentLength) : -1);
        notifyListeners("downloadProgress", progress);
    }

    private static String normalizeSha256(String sha256) {
        if (sha256 == null) return null;
        return sha256.replace(":", "").replace(" ", "").trim().toLowerCase(Locale.US);
    }

    private static String cacheBustedUrl(String url) {
        return url + (url.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.US, "%02x", b));
        }
        return sb.toString();
    }
}
