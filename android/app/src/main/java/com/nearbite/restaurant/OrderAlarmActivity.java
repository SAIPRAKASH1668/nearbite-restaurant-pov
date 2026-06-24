package com.nearbite.restaurant;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

public class OrderAlarmActivity extends Activity {
    private static final String TAG = "YumDudeAlarmActivity";

    // Kept so the polling service can dismiss it remotely when orders clear
    private static OrderAlarmActivity instance;

    private PowerManager.WakeLock screenLock;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // ── Force screen on and show over the lock screen ──────────────
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED  |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON    |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // ── Blur the background on Android 12+ ─────────────────────────
        // Blurs whatever is behind this translucent window (wallpaper, previous
        // app, lock screen) giving a frosted-glass feel to the card overlay.
        // Acquire screen WakeLock so the display stays on while alarm rings
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            screenLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "YumDude::AlarmScreen");
            screenLock.acquire(60_000L);
        }

        setContentView(R.layout.activity_order_alarm);
        applyBackgroundBlur();

        // ── Populate UI ────────────────────────────────────────────────
        String orderId = getIntent().getStringExtra("orderId");
        double amount  = getIntent().getDoubleExtra("amount", 0.0);
        int    count   = getIntent().getIntExtra("count", 1);

        TextView tvTitle   = findViewById(R.id.alarm_title);
        TextView tvAmount  = findViewById(R.id.alarm_amount);
        TextView tvOrderId = findViewById(R.id.alarm_order_id);

        tvTitle.setText(count > 1 ? count + " New Orders!" : "New Order Received!");
        tvAmount.setText("₹" + String.format("%.0f", amount));
        tvOrderId.setText("Order: " + orderId);

        // ── Buttons ────────────────────────────────────────────────────
        Button btnOpen    = findViewById(R.id.btn_open_app);
        Button btnDismiss = findViewById(R.id.btn_dismiss);

        btnOpen.setOnClickListener(v -> {
            stopAlarm();
            launchMainWithOrders(); // finish() is called internally after keyguard resolves
        });

        btnDismiss.setOnClickListener(v -> {
            stopAlarm();
            finish();
            // Polling service will re-fire the alarm in 20 s if order is still CONFIRMED
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // launchMainWithOrders: dismiss keyguard if locked, then open the app
    // directly on the Orders page.
    //
    // Locked + no password  → keyguard dismisses instantly             → orders page
    // Locked + PIN/password → Android shows unlock screen, user enters → orders page
    // Not locked            → opens orders page directly
    // ─────────────────────────────────────────────────────────────────

    private void applyBackgroundBlur() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;

        try {
            getWindow().setBackgroundBlurRadius(24);
        } catch (Exception e) {
            Log.w(TAG, "Background blur unavailable; continuing without it", e);
        }
    }

    private void launchMainWithOrders() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked()) {
                // Do NOT call finish() yet — the activity must stay alive so that
                // requestDismissKeyguard() can show the PIN screen and fire its
                // callback. Calling finish() before onDismissSucceeded() destroys
                // the context and silently prevents startActivity() from working.
                km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                    @Override
                    public void onDismissSucceeded() {
                        // User unlocked — open orders page, then close this alarm screen
                        openAppToOrders();
                        finish();
                    }
                    @Override
                    public void onDismissCancelled() {
                        // User pressed Back — dismiss alarm screen; alarm re-fires in 20 s
                        finish();
                    }
                    @Override
                    public void onDismissError() {
                        // Device-admin policy blocked dismiss — open anyway
                        openAppToOrders();
                        finish();
                    }
                });
                return; // finish() will be called by the callback above
            }
        } else {
            // API < 26: use window flag to dismiss non-secure keyguard
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        // Phone is not locked — open directly and close the alarm screen
        openAppToOrders();
        finish();
    }

    private void openAppToOrders() {
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("openOrders", true);
        startActivity(launch);
    }

    // ─────────────────────────────────────────────────────────────────
    // stopAlarm: tell the service to stop its MediaPlayer, release wakelock,
    // and cancel the persistent notification.
    // Sound is owned by OrderPollingService — it rings independently of this
    // activity, which is why the restaurant hears it even before they tap anything.
    // ─────────────────────────────────────────────────────────────────

    private void stopAlarm() {
        // Tell service to stop MediaPlayer — works whether this activity
        // was opened via fullScreenIntent (screen off) or via notification tap (screen on).
        OrderPollingService.stopAlarmSoundStatic();

        if (screenLock != null && screenLock.isHeld()) {
            screenLock.release();
            screenLock = null;
        }
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(OrderPollingService.ALARM_NOTIF_ID);
    }

    // ─────────────────────────────────────────────────────────────────
    // Called by OrderPollingService when no CONFIRMED orders remain
    // ─────────────────────────────────────────────────────────────────

    public static void stopIfRunning() {
        OrderAlarmActivity a = instance;
        if (a != null) {
            a.runOnUiThread(() -> {
                a.stopAlarm();
                a.finish();
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopAlarm();
        if (instance == this) instance = null;
    }
}
