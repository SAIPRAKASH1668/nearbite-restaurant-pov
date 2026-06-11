package com.nearbite.restaurant;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * Restarts the order watcher after reboot/unlock.
 *
 * Android may block a foreground-service start immediately after boot on some
 * versions/OEM builds, so we also schedule a JobScheduler retry.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "YumDudeBootReceiver";
    private static final int BOOT_RESTART_JOB_ID = 7301;
    private static final int WATCHDOG_JOB_ID = 7302;
    private static final long WATCHDOG_INTERVAL_MS = 15 * 60 * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;

        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                && !Intent.ACTION_USER_UNLOCKED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }

        scheduleRestartJob(context, action);
        restartPollingService(context, action);
    }

    static void restartPollingService(Context context, String source) {
        SharedPreferences prefs = context.getSharedPreferences(
            OrderPollingService.PREF_FILE, Context.MODE_PRIVATE);

        if (!prefs.getBoolean(OrderPollingService.KEY_POLLING_ACTIVE, false)) {
            Log.d(TAG, "Polling was not active before " + source + " - not restarting");
            cancelRestartJobs(context);
            return;
        }

        String restaurantId = prefs.getString(OrderPollingService.KEY_RESTAURANT_ID, null);
        String authToken = prefs.getString(OrderPollingService.KEY_AUTH_TOKEN, null);

        if (restaurantId == null || authToken == null) {
            Log.w(TAG, "No stored credentials - cannot restart polling service");
            return;
        }

        Log.i(TAG, "Restarting OrderPollingService from " + source + " for restaurant=" + restaurantId);
        scheduleWatchdogJob(context, source);

        Intent serviceIntent = new Intent(context, OrderPollingService.class);
        serviceIntent.setAction(OrderPollingService.ACTION_START);
        serviceIntent.putExtra(OrderPollingService.KEY_RESTAURANT_ID, restaurantId);
        serviceIntent.putExtra(OrderPollingService.KEY_AUTH_TOKEN, authToken);
        serviceIntent.putExtra(OrderPollingService.KEY_API_BASE_URL,
            prefs.getString(OrderPollingService.KEY_API_BASE_URL, "https://api.yumdude.com/api/v1"));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Android blocked polling restart from " + source, e);
            scheduleRestartJob(context, source + "_start_blocked");
        }
    }

    static void scheduleRestartJob(Context context, String source) {
        try {
            JobScheduler scheduler =
                (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler == null) return;

            JobInfo job = new JobInfo.Builder(
                    BOOT_RESTART_JOB_ID,
                    new ComponentName(context, BootRestartJobService.class))
                .setMinimumLatency(10_000L)
                .setOverrideDeadline(60_000L)
                .setBackoffCriteria(30_000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                .build();

            int result = scheduler.schedule(job);
            Log.i(TAG, "Scheduled boot restart job from " + source + " result=" + result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule boot restart job from " + source, e);
        }
    }

    static void scheduleWatchdogJob(Context context, String source) {
        try {
            JobScheduler scheduler =
                (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler == null) return;

            JobInfo job = new JobInfo.Builder(
                    WATCHDOG_JOB_ID,
                    new ComponentName(context, BootRestartJobService.class))
                .setPeriodic(WATCHDOG_INTERVAL_MS)
                .setPersisted(true)
                .build();

            int result = scheduler.schedule(job);
            Log.i(TAG, "Scheduled polling watchdog from " + source + " result=" + result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule polling watchdog from " + source, e);
        }
    }

    static void cancelRestartJobs(Context context) {
        try {
            JobScheduler scheduler =
                (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler == null) return;
            scheduler.cancel(BOOT_RESTART_JOB_ID);
            scheduler.cancel(WATCHDOG_JOB_ID);
            Log.i(TAG, "Cancelled polling restart jobs");
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel polling restart jobs", e);
        }
    }
}
