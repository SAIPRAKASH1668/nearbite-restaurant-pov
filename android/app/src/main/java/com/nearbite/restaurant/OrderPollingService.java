package com.nearbite.restaurant;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

public class OrderPollingService extends Service {

    private static final String TAG = "YumDudePolling";

    // Static reference so OrderAlarmActivity can stop sound without service binding
    private static OrderPollingService instance;
    // Intent actions
    public static final String ACTION_START = "com.nearbite.restaurant.START_POLLING";
    public static final String ACTION_STOP  = "com.nearbite.restaurant.STOP_POLLING";
    public static final String ACTION_POLL_NOW = "com.nearbite.restaurant.POLL_NOW";
    public static final String ACTION_ALERT_FROM_PUSH = "com.nearbite.restaurant.ALERT_FROM_PUSH";
    public static final String ACTION_DISMISS_ALARM = "com.nearbite.restaurant.DISMISS_ORDER_ALARM";

    // SharedPreferences keys (also used by BootReceiver and plugin)
    static final String PREF_FILE          = "yumdude_polling_prefs";
    static final String KEY_RESTAURANT_ID  = "restaurant_id";
    static final String KEY_AUTH_TOKEN     = "auth_token";
    static final String KEY_API_BASE_URL   = "api_base_url";
    static final String KEY_SEEN_ORDER_IDS = "seen_order_ids";
    static final String KEY_POLLING_ACTIVE = "polling_active";
    static final String KEY_INSISTENT_NEW_ORDERS = "insistent_new_orders";
    static final String KEY_DISMISSED_ORDER_IDS = "dismissed_order_ids";

    // Notification IDs and channels
    private static final int    FOREGROUND_NOTIF_ID = 1001;
    static final int             ALARM_NOTIF_ID      = 1002;
    private static final String  CHANNEL_PERSISTENT  = "yumdude_persistent";
    static final String          CHANNEL_ALARM       = "new_orders_critical_v2";
    private static final String  CHANNEL_ALARM_LEGACY = "yumdude_alarm";
    private static final String  CHANNEL_CRITICAL_LEGACY = "new_orders_critical";

    private static final long POLL_INTERVAL_MS = 20_000L;

    private Handler               handler;
    private Runnable              pollRunnable;
    private PowerManager.WakeLock wakeLock;
    private PowerManager.WakeLock screenWakeLock; // brief lock to wake screen during alarm
    private MediaPlayer           alarmPlayer;
    private Set<String>           currentAlarmOrderIds = new HashSet<>();

    // ─────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        handler = new Handler(Looper.getMainLooper());
        createNotificationChannels();
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            getSharedPreferences(PREF_FILE, MODE_PRIVATE)
                .edit().putBoolean(KEY_POLLING_ACTIVE, false).apply();
            BootReceiver.cancelRestartJobs(this);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Persist credentials from the intent
        if (intent != null) {
            String restaurantId = intent.getStringExtra(KEY_RESTAURANT_ID);
            String authToken    = intent.getStringExtra(KEY_AUTH_TOKEN);
            String apiBaseUrl   = intent.getStringExtra(KEY_API_BASE_URL);

            if (restaurantId != null && authToken != null) {
                SharedPreferences prefs = getSharedPreferences(PREF_FILE, MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit()
                    .putString(KEY_RESTAURANT_ID, restaurantId)
                    .putString(KEY_AUTH_TOKEN, authToken)
                    .putString(KEY_API_BASE_URL,
                        apiBaseUrl != null ? apiBaseUrl : "https://api.yumdude.com/api/v1")
                    .putBoolean(KEY_POLLING_ACTIVE, true);
                if (!prefs.contains(KEY_INSISTENT_NEW_ORDERS)) {
                    editor.putBoolean(KEY_INSISTENT_NEW_ORDERS, true);
                }
                editor.apply();
            }
        }

        // Promote to foreground immediately (Android requirement).
        BootReceiver.scheduleWatchdogJob(this, "service_start");

        SharedPreferences currentPrefs = getSharedPreferences(PREF_FILE, MODE_PRIVATE);
        boolean hasPollingCredentials =
            currentPrefs.getString(KEY_RESTAURANT_ID, null) != null
            && currentPrefs.getString(KEY_AUTH_TOKEN, null) != null;

        // Promote to foreground immediately (Android requirement).
        // On API 29+ (Android 10+) we must pass the foreground service type that
        // matches the manifest declaration; on API 34+ this is strictly enforced
        // and the 2-arg variant throws InvalidForegroundServiceTypeException.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(FOREGROUND_NOTIF_ID, buildPersistentNotification(),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(FOREGROUND_NOTIF_ID, buildPersistentNotification(),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(FOREGROUND_NOTIF_ID, buildPersistentNotification());
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed — stopping service to avoid crash loop", e);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_ALERT_FROM_PUSH.equals(action)) {
            String orderId = intent != null ? intent.getStringExtra("orderId") : null;
            double amount = intent != null ? intent.getDoubleExtra("amount", 0.0) : 0.0;
            int count = intent != null ? intent.getIntExtra("count", 1) : 1;
            String safeOrderId = orderId != null && !orderId.isEmpty() ? orderId : "New order";
            Set<String> idsForAlarm = new HashSet<>();
            if (orderId != null && !orderId.isEmpty()) idsForAlarm.add(orderId);
            currentAlarmOrderIds = idsForAlarm;
            handler.post(() -> fireAlarm(safeOrderId, amount, Math.max(count, 1)));
        }

        // Schedule repeating poll (only once even if onStartCommand is called again)
        if (pollRunnable == null && hasPollingCredentials) {
            pollRunnable = new Runnable() {
                @Override
                public void run() {
                    pollOrders();
                    handler.postDelayed(this, POLL_INTERVAL_MS);
                }
            };
            handler.post(pollRunnable);
        } else if (ACTION_POLL_NOW.equals(action) && hasPollingCredentials) {
            handler.post(this::pollOrders);
        }

        // START_STICKY: Android will restart this service if it's killed
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        if (pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
            pollRunnable = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        stopAlarmSound();
        if (getSharedPreferences(PREF_FILE, MODE_PRIVATE).getBoolean(KEY_POLLING_ACTIVE, false)) {
            BootReceiver.scheduleRestartJob(this, "service_destroyed");
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        if (getSharedPreferences(PREF_FILE, MODE_PRIVATE).getBoolean(KEY_POLLING_ACTIVE, false)) {
            BootReceiver.scheduleRestartJob(this, "task_removed");
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ─────────────────────────────────────────────────────────────────
    // Polling logic
    // ─────────────────────────────────────────────────────────────────

    private void pollOrders() {
        SharedPreferences prefs = getSharedPreferences(PREF_FILE, MODE_PRIVATE);
        String restaurantId = prefs.getString(KEY_RESTAURANT_ID, null);
        String authToken    = prefs.getString(KEY_AUTH_TOKEN, null);
        String apiBaseUrl   = prefs.getString(KEY_API_BASE_URL, "https://api.yumdude.com/api/v1");

        if (restaurantId == null || authToken == null) {
            Log.w(TAG, "No credentials — skipping poll");
            return;
        }

        final String token   = authToken;
        final String baseUrl = apiBaseUrl;
        final String resId   = restaurantId;

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                String urlStr = baseUrl + "/orders?restaurantId=" + URLEncoder.encode(resId, "UTF-8");
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(10_000);

                int code = conn.getResponseCode();
                if (code == 200) {
                    BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                    reader.close();
                    processResponse(sb.toString(), prefs);
                } else {
                    Log.w(TAG, "Poll HTTP " + code);
                }
            } catch (Exception e) {
                Log.e(TAG, "Poll error", e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private void processResponse(String jsonBody, SharedPreferences prefs) {
        try {
            JSONObject root   = new JSONObject(jsonBody);
            JSONArray  orders = root.optJSONArray("orders");
            if (orders == null) return;

            // Load seen order IDs from prefs
            String    seenJson = prefs.getString(KEY_SEEN_ORDER_IDS, "[]");
            JSONArray seenArr  = new JSONArray(seenJson);
            Set<String> seen  = new HashSet<>();
            for (int i = 0; i < seenArr.length(); i++) seen.add(seenArr.getString(i));

            String    dismissedJson = prefs.getString(KEY_DISMISSED_ORDER_IDS, "[]");
            JSONArray dismissedArr  = new JSONArray(dismissedJson);
            Set<String> dismissed  = new HashSet<>();
            for (int i = 0; i < dismissedArr.length(); i++) dismissed.add(dismissedArr.getString(i));

            List<JSONObject> activeOrders  = new ArrayList<>();
            List<JSONObject> newOrders     = new ArrayList<>();
            Set<String> activeOrderIds      = new HashSet<>();
            Set<String> newOrderIds         = new HashSet<>();

            for (int i = 0; i < orders.length(); i++) {
                JSONObject order   = orders.getJSONObject(i);
                String     status  = order.optString("status", "");
                String     orderId = order.optString("orderId", "");
                String     created = order.optString("createdAt", "");

                if ("CONFIRMED".equals(status) && isToday(created)) {
                    activeOrders.add(order);
                    if (!orderId.isEmpty()) activeOrderIds.add(orderId);
                    if (!orderId.isEmpty() && !seen.contains(orderId)) {
                        newOrders.add(order);
                        newOrderIds.add(orderId);
                        seen.add(orderId);
                    }
                }
            }

            dismissed.retainAll(activeOrderIds);
            dismissed.removeAll(newOrderIds);

            // Persist updated seen IDs
            prefs.edit()
                .putString(KEY_SEEN_ORDER_IDS, new JSONArray(seen).toString())
                .putString(KEY_DISMISSED_ORDER_IDS, new JSONArray(dismissed).toString())
                .apply();

            if (!activeOrders.isEmpty()) {
                boolean hasUndismissedActiveOrder = false;
                for (String id : activeOrderIds) {
                    if (!dismissed.contains(id)) {
                        hasUndismissedActiveOrder = true;
                        break;
                    }
                }
                boolean shouldRing = !newOrders.isEmpty()
                    || (hasUndismissedActiveOrder
                        && isInsistentNewOrdersEnabled(prefs)
                        && !isAlarmSoundPlaying());
                if (!shouldRing) return;

                JSONObject first  = !newOrders.isEmpty() ? newOrders.get(0) : activeOrders.get(0);
                String     oid    = first.optString("orderId", "—");
                double     amount = first.optDouble("grandTotal", 0.0);
                int        count  = activeOrders.size();
                Set<String> idsForAlarm = new HashSet<>(activeOrderIds);
                handler.post(() -> {
                    currentAlarmOrderIds = idsForAlarm;
                    fireAlarm(oid, amount, count);
                });
            } else {
                // No pending orders left → stop ringing (other device accepted)
                handler.post(this::cancelAlarm);
            }

        } catch (Exception e) {
            Log.e(TAG, "Response parse error", e);
        }
    }

    /** Returns true if the ISO-8601 timestamp (e.g. "2026-05-04T12:30:00.000Z") is today. */
    private boolean isToday(String ts) {
        if (ts == null || ts.length() < 10) return false;

        Date createdAt = parseIsoDate(ts);
        if (createdAt != null) {
            Calendar orderDay = Calendar.getInstance();
            orderDay.setTime(createdAt);
            Calendar today = Calendar.getInstance();
            return orderDay.get(Calendar.YEAR) == today.get(Calendar.YEAR)
                && orderDay.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR);
        }

        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        return ts.startsWith(today);
    }

    private Date parseIsoDate(String ts) {
        String[] patterns = {
            "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            "yyyy-MM-dd'T'HH:mm:ssX",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat fmt = new SimpleDateFormat(pattern, Locale.US);
                if (pattern.endsWith("'Z'")) {
                    fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
                }
                return fmt.parse(ts);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private boolean isInsistentNewOrdersEnabled(SharedPreferences prefs) {
        return prefs.getBoolean(KEY_INSISTENT_NEW_ORDERS, true);
    }

    // ─────────────────────────────────────────────────────────────────
    // Alarm
    // ─────────────────────────────────────────────────────────────────

    private void fireAlarm(String orderId, double amount, int count) {
        Intent alarmIntent = new Intent(this, OrderAlarmActivity.class);
        alarmIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        alarmIntent.putExtra("orderId", orderId);
        alarmIntent.putExtra("amount", amount);
        alarmIntent.putExtra("count", count);

        PendingIntent fullScreen = PendingIntent.getActivity(
            this, 0, alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent dismissIntent = PendingIntent.getBroadcast(
            this, 1, new Intent(this, AlarmDismissReceiver.class)
                .setAction(ACTION_DISMISS_ALARM),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String title = count > 1 ? count + " New Orders!" : "New Order!";
        String text  = "₹" + String.format(Locale.US, "%.0f", amount) + "  —  Tap to view";

        NotificationCompat.Builder nb = new NotificationCompat.Builder(this, CHANNEL_ALARM)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setDeleteIntent(dismissIntent)
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .addAction(0, "Dismiss", dismissIntent);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(ALARM_NOTIF_ID, nb.build());

        // ── Ring alarm sound from service process ────────────────────────
        // Fires regardless of screen state, regardless of fullScreenIntent
        // being degraded to a banner when screen is ON.
        startAlarmSound();

        // ── Wake the screen ───────────────────────────────────────────────
        // Acquire a brief SCREEN_BRIGHT wakelock so Android brings the screen
        // on before we launch the alarm activity.
        acquireScreenWakeLock();

        // ── Launch alarm activity directly ───────────────────────────────
        // On Android 12+ background activity launches are blocked EXCEPT when
        // the app holds SYSTEM_ALERT_WINDOW permission (explicit OS exemption).
        // This guarantees the red alarm screen appears whether the screen is ON
        // or OFF, and whether the phone is locked or unlocked.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || Settings.canDrawOverlays(this)) {
            startActivity(alarmIntent);
        }
        // Fallback for Android 12+ without SYSTEM_ALERT_WINDOW:
        // fullScreenIntent handles screen-off/locked; screen-on shows banner + sound.

        Log.i(TAG, "Alarm fired for orderId=" + orderId + " count=" + count);
    }

    void cancelAlarm() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ALARM_NOTIF_ID);
        currentAlarmOrderIds = new HashSet<>();
        stopAlarmSound();
        releaseScreenWakeLock();
        OrderAlarmActivity.stopIfRunning();
        Log.i(TAG, "Alarm cancelled — no pending CONFIRMED orders");
    }

    private void acquireScreenWakeLock() {
        // Turns the screen on long enough for OrderAlarmActivity to launch and
        // take ownership of the display with its own SCREEN_BRIGHT wakelock.
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            if (screenWakeLock != null && screenWakeLock.isHeld()) return;
            screenWakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "YumDude::AlarmWakeService");
            screenWakeLock.acquire(8_000L); // 8 s — activity wakelock takes over
            Log.i(TAG, "Screen wake lock acquired");
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire screen wake lock", e);
        }
    }

    private void releaseScreenWakeLock() {
        if (screenWakeLock != null && screenWakeLock.isHeld()) {
            screenWakeLock.release();
            Log.i(TAG, "Screen wake lock released");
        }
        screenWakeLock = null;
    }

    private void startAlarmSound() {
        // Already ringing — don't restart (avoids stutter on repeated fireAlarm calls)
        if (alarmPlayer != null && alarmPlayer.isPlaying()) return;
        stopAlarmSound(); // clean up any stale instance
        try {
            AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (audioManager != null && audioManager.getStreamVolume(AudioManager.STREAM_ALARM) == 0) {
                Log.w(TAG, "Alarm stream volume is 0; notification is shown but sound may be muted");
            }
            alarmPlayer = new MediaPlayer();
            alarmPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            Uri uri = Uri.parse(
                "android.resource://" + getPackageName() + "/" + R.raw.telephone_ring);
            alarmPlayer.setDataSource(getApplicationContext(), uri);
            alarmPlayer.setLooping(true);
            alarmPlayer.prepare();
            alarmPlayer.start();
            Log.i(TAG, "Alarm sound started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start alarm sound", e);
        }
    }

    private boolean isAlarmSoundPlaying() {
        try {
            return alarmPlayer != null && alarmPlayer.isPlaying();
        } catch (Exception ignored) {
            return false;
        }
    }

    void stopAlarmSound() {
        if (alarmPlayer != null) {
            try {
                if (alarmPlayer.isPlaying()) alarmPlayer.stop();
                alarmPlayer.release();
            } catch (Exception ignored) {}
            alarmPlayer = null;
            Log.i(TAG, "Alarm sound stopped");
        }
        releaseScreenWakeLock();
    }

    private void dismissCurrentAlarm() {
        if (!currentAlarmOrderIds.isEmpty()) {
            SharedPreferences prefs = getSharedPreferences(PREF_FILE, MODE_PRIVATE);
            Set<String> dismissed = new HashSet<>();
            try {
                JSONArray arr = new JSONArray(prefs.getString(KEY_DISMISSED_ORDER_IDS, "[]"));
                for (int i = 0; i < arr.length(); i++) dismissed.add(arr.getString(i));
            } catch (Exception ignored) {}
            dismissed.addAll(currentAlarmOrderIds);
            prefs.edit()
                .putString(KEY_DISMISSED_ORDER_IDS, new JSONArray(dismissed).toString())
                .apply();
        }

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ALARM_NOTIF_ID);
        stopAlarmSound();
        if (!getSharedPreferences(PREF_FILE, MODE_PRIVATE).getBoolean(KEY_POLLING_ACTIVE, false)) {
            stopSelf();
        }
    }

    /** Called by OrderAlarmActivity without needing a service binding. */
    public static void stopAlarmSoundStatic() {
        OrderPollingService s = instance;
        if (s != null) s.dismissCurrentAlarm();
    }

    public static class AlarmDismissReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !ACTION_DISMISS_ALARM.equals(intent.getAction())) return;
            OrderPollingService.stopAlarmSoundStatic();
            NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(ALARM_NOTIF_ID);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Notification helpers
    // ─────────────────────────────────────────────────────────────────

    private Notification buildPersistentNotification() {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_PERSISTENT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("YumDude Partner")
            .setContentText("Watching for new orders…")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Silent persistent channel
        NotificationChannel persistent = new NotificationChannel(
            CHANNEL_PERSISTENT, "Order Monitoring", NotificationManager.IMPORTANCE_LOW);
        persistent.setDescription("Shows that the app is monitoring for new orders");
        nm.createNotificationChannel(persistent);

        nm.deleteNotificationChannel(CHANNEL_ALARM_LEGACY);
        nm.deleteNotificationChannel(CHANNEL_CRITICAL_LEGACY);

        // Alarm channel — HIGH importance, custom looping sound
        NotificationChannel alarm = new NotificationChannel(
            CHANNEL_ALARM, "New Order Alerts", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Rings loudly for every new incoming order");
        alarm.enableLights(true);
        alarm.enableVibration(true);
        alarm.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        Uri soundUri = Uri.parse(
            "android.resource://" + getPackageName() + "/raw/telephone_ring");
        AudioAttributes audioAttr = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        alarm.setSound(soundUri, audioAttr);
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && nm.isNotificationPolicyAccessGranted()) {
            alarm.setBypassDnd(true);
        }
        nm.createNotificationChannel(alarm);
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK, "YumDude::PollingWakeLock");
            wakeLock.acquire();
        }
    }
}
