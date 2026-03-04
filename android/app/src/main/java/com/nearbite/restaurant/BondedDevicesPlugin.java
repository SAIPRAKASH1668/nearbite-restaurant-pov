package com.nearbite.restaurant;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Set;

/**
 * BondedDevicesPlugin
 *
 * Exposes Android's BluetoothAdapter.getBondedDevices() to the JS layer.
 * This returns the list of BT devices the user has already PAIRED in
 * Android Settings — which is exactly what a thermal-printer selector needs.
 *
 * Use this instead of BluetoothSerial.scan() (which does active discovery
 * and requires the printer to be in discoverable mode).
 */
@CapacitorPlugin(
  name = "BondedDevices",
  permissions = {
    // Android 12+ (API 31+)
    @Permission(
      strings = {Manifest.permission.BLUETOOTH_CONNECT},
      alias = "bluetoothConnect"
    ),
    // Android ≤ 11
    @Permission(
      strings = {Manifest.permission.BLUETOOTH},
      alias = "bluetoothClassic"
    )
  }
)
public class BondedDevicesPlugin extends Plugin {

  private static final String TAG = "BondedDevicesPlugin";

  /**
   * Returns the list of devices already paired (bonded) in the OS.
   * Triggers runtime permission dialog on first call if needed.
   */
  @PluginMethod
  @SuppressLint("MissingPermission")
  public void getBondedDevices(PluginCall call) {
    // Pick the right permission alias for the runtime API level
    String alias = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
      ? "bluetoothConnect"
      : "bluetoothClassic";

    if (getPermissionState(alias) != PermissionState.GRANTED) {
      Log.d(TAG, "Requesting Bluetooth permission (" + alias + ")…");
      requestPermissionForAlias(alias, call, "onPermissionResult");
      return;
    }

    resolveBondedDevices(call);
  }

  @PermissionCallback
  private void onPermissionResult(PluginCall call) {
    String alias = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
      ? "bluetoothConnect"
      : "bluetoothClassic";

    if (getPermissionState(alias) != PermissionState.GRANTED) {
      Log.w(TAG, "Bluetooth permission denied by user");
      call.reject("Bluetooth permission denied");
      return;
    }

    resolveBondedDevices(call);
  }

  @SuppressLint("MissingPermission")
  private void resolveBondedDevices(PluginCall call) {
    try {
      Log.d(TAG, "resolveBondedDevices called");

      BluetoothManager mgr =
        (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);

      if (mgr == null) {
        Log.e(TAG, "BluetoothManager is null");
        call.reject("Bluetooth not available on this device");
        return;
      }

      BluetoothAdapter adapter = mgr.getAdapter();

      if (adapter == null) {
        Log.e(TAG, "BluetoothAdapter is null");
        call.reject("Bluetooth not available on this device");
        return;
      }

      Log.d(TAG, "Adapter enabled: " + adapter.isEnabled());

      if (!adapter.isEnabled()) {
        call.reject("Bluetooth is disabled");
        return;
      }

      Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
      Log.d(TAG, "Bonded device count: " + bondedDevices.size());

      JSArray devicesJson = new JSArray();

      for (BluetoothDevice device : bondedDevices) {
        Log.d(TAG, "Device: " + device.getName() + " / " + device.getAddress());
        JSObject obj = new JSObject();
        obj.put("name",    device.getName()    != null ? device.getName()    : device.getAddress());
        obj.put("address", device.getAddress() != null ? device.getAddress() : "");
        devicesJson.put(obj);
      }

      JSObject result = new JSObject();
      result.put("devices", devicesJson);
      Log.d(TAG, "Resolving with " + devicesJson.length() + " devices");
      call.resolve(result);

    } catch (Exception e) {
      Log.e(TAG, "Failed to get bonded devices", e);
      call.reject("Failed to get bonded devices: " + e.getLocalizedMessage());
    }
  }
}
