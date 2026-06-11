package com.nearbite.restaurant;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor bridge plugin that exposes startPolling / stopPolling to the
 * Angular web app running at www.yumdude.com inside the WebView.
 *
 * Usage from Angular (TypeScript):
 *
 *   import { registerPlugin } from '@capacitor/core';
 *   const OrderPolling = registerPlugin('OrderPolling');
 *
 *   // On login:
 *   await OrderPolling.startPolling({
 *     restaurantId: 'RES-xxx',
 *     authToken:    'eyJhbGci...',
 *     apiBaseUrl:   'https://api.yumdude.com/api/v1'   // optional, has default
 *   });
 *
 *   // On logout:
 *   await OrderPolling.stopPolling();
 */
@CapacitorPlugin(name = "OrderPolling")
public class OrderPollingPlugin extends Plugin {
    private static final String TAG = "YumDudePollingPlugin";

    @PluginMethod
    public void startPolling(PluginCall call) {
        String restaurantId = call.getString("restaurantId");
        String authToken    = call.getString("authToken");
        String apiBaseUrl   = call.getString("apiBaseUrl");

        if (restaurantId == null || restaurantId.isEmpty()) {
            call.reject("restaurantId is required");
            return;
        }
        if (authToken == null || authToken.isEmpty()) {
            call.reject("authToken is required");
            return;
        }

        Context ctx = getContext();

        // Persist immediately so BootReceiver can restart without a fresh call
        SharedPreferences prefs = ctx.getSharedPreferences(
            OrderPollingService.PREF_FILE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit()
            .putString(OrderPollingService.KEY_RESTAURANT_ID, restaurantId)
            .putString(OrderPollingService.KEY_AUTH_TOKEN, authToken)
            .putString(OrderPollingService.KEY_API_BASE_URL,
                apiBaseUrl != null && !apiBaseUrl.isEmpty()
                    ? apiBaseUrl
                    : "https://api.yumdude.com/api/v1")
            .putBoolean(OrderPollingService.KEY_POLLING_ACTIVE, true);
        if (!prefs.contains(OrderPollingService.KEY_INSISTENT_NEW_ORDERS)) {
            editor.putBoolean(OrderPollingService.KEY_INSISTENT_NEW_ORDERS, true);
        }
        editor.apply();
        BootReceiver.scheduleWatchdogJob(ctx, "start_polling");

        Intent intent = new Intent(ctx, OrderPollingService.class);
        intent.setAction(OrderPollingService.ACTION_START);
        intent.putExtra(OrderPollingService.KEY_RESTAURANT_ID, restaurantId);
        intent.putExtra(OrderPollingService.KEY_AUTH_TOKEN, authToken);
        intent.putExtra(OrderPollingService.KEY_API_BASE_URL,
            apiBaseUrl != null ? apiBaseUrl : "https://api.yumdude.com/api/v1");

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start order polling service", e);
            call.reject("Failed to start order polling service", e);
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void stopPolling(PluginCall call) {
        Context ctx = getContext();

        // Clear stored credentials so BootReceiver won't restart the service
        ctx.getSharedPreferences(OrderPollingService.PREF_FILE, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(OrderPollingService.KEY_POLLING_ACTIVE, false)
            .apply();
        BootReceiver.cancelRestartJobs(ctx);

        Intent intent = new Intent(ctx, OrderPollingService.class);
        intent.setAction(OrderPollingService.ACTION_STOP);
        try {
            ctx.startService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop order polling service", e);
            call.reject("Failed to stop order polling service", e);
            return;
        }

        call.resolve();
    }
}
