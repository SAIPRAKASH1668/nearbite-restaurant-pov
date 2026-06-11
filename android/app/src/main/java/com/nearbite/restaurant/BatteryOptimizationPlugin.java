package com.nearbite.restaurant;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

  @PluginMethod
  public void getStatus(PluginCall call) {
    JSObject result = new JSObject();
    result.put("supported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M);
    result.put("ignoringBatteryOptimizations", isIgnoringBatteryOptimizations());
    call.resolve(result);
  }

  @PluginMethod
  public void requestExemption(PluginCall call) {
    JSObject result = new JSObject();

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || isIgnoringBatteryOptimizations()) {
      result.put("opened", false);
      result.put("alreadyAllowed", true);
      call.resolve(result);
      return;
    }

    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Activity is not available");
      return;
    }

    try {
      Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
      intent.setData(Uri.parse("package:" + getContext().getPackageName()));
      activity.startActivity(intent);
    } catch (ActivityNotFoundException requestNotSupported) {
      try {
        Intent fallbackIntent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        activity.startActivity(fallbackIntent);
      } catch (Exception fallbackError) {
        call.reject("Battery optimization settings are not available", fallbackError);
        return;
      }
    } catch (Exception e) {
      call.reject("Could not open battery optimization settings", e);
      return;
    }

    result.put("opened", true);
    result.put("alreadyAllowed", false);
    call.resolve(result);
  }

  private boolean isIgnoringBatteryOptimizations() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true;
    }

    PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
    return powerManager != null
      && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
  }
}
