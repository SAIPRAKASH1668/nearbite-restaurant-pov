package com.nearbite.restaurant;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Keeps Capacitor PushNotifications behavior, then uses restaurant FCM as a
 * wake-up trigger for the native order polling service.
 */
public class YumDudeMessagingService extends MessagingService {

    private static final String TAG = "YumDudeFCM";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        try {
            super.onMessageReceived(remoteMessage);
        } catch (Throwable e) {
            // Catch Throwable (not just Exception) because Capacitor's bridge can
            // throw Error subclasses when the bridge hasn't been initialised yet
            // (e.g. immediately after a device reboot before the app is opened).
            Log.e(TAG, "Capacitor push handling failed", e);
        }

        Map<String, String> data = remoteMessage.getData();
        if (!"restaurant_new_order".equals(data.get("type"))) {
            return;
        }

        triggerOrderAlert(data);
        triggerOrderPolling();
    }

    private void triggerOrderAlert(Map<String, String> data) {
        Intent intent = new Intent(this, OrderPollingService.class);
        intent.setAction(OrderPollingService.ACTION_ALERT_FROM_PUSH);
        intent.putExtra("orderId", data.get("orderId"));
        intent.putExtra("amount", parseDouble(data.get("amount")));
        intent.putExtra("count", parseInt(data.get("itemCount"), 1));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            Log.i(TAG, "restaurant_new_order FCM triggered native order alarm");
        } catch (Exception e) {
            Log.e(TAG, "Failed to trigger native order alarm from FCM", e);
        }
    }

    private void triggerOrderPolling() {
        SharedPreferences prefs = getSharedPreferences(
            OrderPollingService.PREF_FILE, Context.MODE_PRIVATE);

        String restaurantId = prefs.getString(OrderPollingService.KEY_RESTAURANT_ID, null);
        String authToken = prefs.getString(OrderPollingService.KEY_AUTH_TOKEN, null);
        String apiBaseUrl = prefs.getString(
            OrderPollingService.KEY_API_BASE_URL,
            "https://api.yumdude.com/api/v1");

        if (restaurantId == null || authToken == null) {
            Log.w(TAG, "restaurant_new_order FCM received, but polling credentials are missing");
            return;
        }

        Intent intent = new Intent(this, OrderPollingService.class);
        intent.setAction(OrderPollingService.ACTION_POLL_NOW);
        intent.putExtra(OrderPollingService.KEY_RESTAURANT_ID, restaurantId);
        intent.putExtra(OrderPollingService.KEY_AUTH_TOKEN, authToken);
        intent.putExtra(OrderPollingService.KEY_API_BASE_URL, apiBaseUrl);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            Log.i(TAG, "restaurant_new_order FCM triggered native order polling");
        } catch (Exception e) {
            Log.e(TAG, "Failed to trigger native order polling from FCM", e);
        }
    }

    private double parseDouble(String value) {
        try {
            return value != null ? Double.parseDouble(value) : 0.0;
        } catch (Exception ignored) {
            return 0.0;
        }
    }

    private int parseInt(String value, int fallback) {
        try {
            return value != null ? Integer.parseInt(value) : fallback;
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
