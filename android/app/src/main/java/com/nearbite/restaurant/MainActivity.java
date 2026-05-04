package com.nearbite.restaurant;

import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(BondedDevicesPlugin.class);
    registerPlugin(UsbPrinterPlugin.class);
    registerPlugin(NetworkPrinterPlugin.class);
    registerPlugin(OrderPollingPlugin.class);
    super.onCreate(savedInstanceState);
    // Handle "open orders" intent when app was NOT already running
    handleOpenOrdersIntent(getIntent());
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // Handle "open orders" intent when app was already running in background
    handleOpenOrdersIntent(intent);
  }

  @Override
  public void onResume() {
    super.onResume();
    // Check SYSTEM_ALERT_WINDOW first — this is the most critical permission
    // for making the alarm screen appear when the phone screen is already ON.
    if (!requestOverlayPermissionIfNeeded()) {
      // Only show the next dialog if we didn't already show one this cycle.
      requestFullScreenIntentPermissionIfNeeded();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Navigate Angular to the Orders page when launched from the alarm screen.
  // OrderAlarmActivity sends an Intent extra "openOrders = true" when the
  // restaurant owner taps "Open App" after unlocking.
  // ─────────────────────────────────────────────────────────────────
  private void handleOpenOrdersIntent(Intent intent) {
    if (intent == null || !intent.getBooleanExtra("openOrders", false)) return;
    // Clear the flag so it doesn't fire again on configuration changes
    intent.removeExtra("openOrders");
    // Delay slightly so the WebView is fully loaded and Angular has bootstrapped
    new Handler(Looper.getMainLooper()).postDelayed(() -> {
      try {
        getBridge().getWebView().evaluateJavascript(
          "if (typeof window.__yumdude_open_orders === 'function') {" +
          "  window.__yumdude_open_orders();" +
          "} else {" +
          // Fallback: set a flag that Angular picks up when the app component mounts
          "  window.__yumdude_open_orders_pending = true;" +
          "}",
          null
        );
      } catch (Exception e) {
        android.util.Log.w("MainActivity", "evaluateJavascript failed: " + e.getMessage());
      }
    }, 900);
  }

  // ─────────────────────────────────────────────────────────────────
  // "Draw over other apps" (SYSTEM_ALERT_WINDOW) — exempts this app from
  // Android 12+ background activity launch restrictions, meaning the alarm
  // screen can pop up automatically even when the screen is already on.
  // Returns true if a dialog was shown (so we don't show two dialogs at once).
  // ─────────────────────────────────────────────────────────────────
  private boolean requestOverlayPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
    if (Settings.canDrawOverlays(this)) return false;

    new AlertDialog.Builder(this)
      .setTitle("Allow displaying order alerts over other apps")
      .setMessage(
        "YumDude Partner needs permission to show order alerts on top of other apps "
        + "and on the lock screen. This ensures the alarm screen appears immediately "
        + "even if you are using another app.\n\n"
        + "Tap \"Allow\" then enable \"Allow display over other apps\" for YumDude Partner."
      )
      .setCancelable(false)
      .setPositiveButton("Allow", (dialog, which) -> {
        Intent intent = new Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + getPackageName())
        );
        startActivity(intent);
      })
      .setNegativeButton("Not now", null)
      .show();
    return true; // dialog shown — skip the fullScreenIntent dialog this cycle
  }

  // ─────────────────────────────────────────────────────────────────
  // Android 14+ made USE_FULL_SCREEN_INTENT a runtime permission.
  // Without it the alarm fullScreenIntent is silently degraded to a banner.
  // ─────────────────────────────────────────────────────────────────
  private void requestFullScreenIntentPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return;

    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm == null || nm.canUseFullScreenIntent()) return;

    new AlertDialog.Builder(this)
      .setTitle("Allow full-screen order alerts")
      .setMessage(
        "YumDude Partner needs permission to show incoming orders on your screen "
        + "even when the phone is locked or another app is open. "
        + "This ensures you never miss an order.\n\n"
        + "Tap \"Allow\" then enable \"Allow full-screen intents\" for YumDude Partner."
      )
      .setCancelable(false)
      .setPositiveButton("Allow", (dialog, which) -> {
        Intent intent = new Intent(
          Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:" + getPackageName())
        );
        startActivity(intent);
      })
      .setNegativeButton("Not now", null)
      .show();
  }
}

