package com.nearbite.restaurant;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;

/**
 * UsbPrinterPlugin
 *
 * Exposes USB Host API to the JS layer so thermal printers connected via USB
 * cable (or USB-OTG) can receive raw ESC/POS bytes.
 *
 * Methods:
 *   getUsbDevices()           — list all connected USB devices + permission status
 *   requestPermission(name)   — prompt user to allow access to a specific device
 *   print(name, data)         — send base-64 encoded bytes to bulk-OUT endpoint
 *
 * The permission request is Android broadcast-based (async). The plugin stores
 * the pending PluginCall and resolves it when the BroadcastReceiver fires.
 */
@CapacitorPlugin(name = "UsbPrinter")
public class UsbPrinterPlugin extends Plugin {

  private static final String TAG = "UsbPrinterPlugin";
  private static final String ACTION_USB_PERMISSION = "com.nearbite.restaurant.USB_PERMISSION";

  private UsbManager usbManager;
  private PluginCall pendingPermissionCall;

  // ── Permission broadcast receiver ─────────────────────────────────────────

  private final BroadcastReceiver permissionReceiver = new BroadcastReceiver() {
    @Override
    public void onReceive(Context context, Intent intent) {
      if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;

      UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
      boolean granted  = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);

      PluginCall call  = pendingPermissionCall;
      pendingPermissionCall = null;

      if (call != null) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        if (device != null) result.put("deviceName", device.getDeviceName());
        call.resolve(result);
      }
    }
  };

  // ── Plugin lifecycle ──────────────────────────────────────────────────────

  @Override
  public void load() {
    usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);

    IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      getContext().registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    } else {
      getContext().registerReceiver(permissionReceiver, filter);
    }
  }

  @Override
  protected void handleOnDestroy() {
    try {
      getContext().unregisterReceiver(permissionReceiver);
    } catch (IllegalArgumentException e) {
      Log.w(TAG, "Receiver already unregistered");
    }
  }

  // ── Plugin methods ────────────────────────────────────────────────────────

  /**
   * Returns every USB device currently connected to the Android host port.
   * Includes permission status so the UI can show a lock/unlock indicator.
   */
  @PluginMethod
  public void getUsbDevices(PluginCall call) {
    if (usbManager == null) { call.reject("USB not available"); return; }

    HashMap<String, UsbDevice> deviceMap = usbManager.getDeviceList();
    JSArray devices = new JSArray();

    for (UsbDevice device : deviceMap.values()) {
      JSObject obj = new JSObject();
      obj.put("deviceName",      device.getDeviceName());
      obj.put("productName",     device.getProductName()      != null ? device.getProductName()      : "USB Device");
      obj.put("manufacturerName",device.getManufacturerName() != null ? device.getManufacturerName() : "");
      obj.put("vendorId",        device.getVendorId());
      obj.put("productId",       device.getProductId());
      obj.put("hasPermission",   usbManager.hasPermission(device));
      devices.put(obj);
    }

    JSObject result = new JSObject();
    result.put("devices", devices);
    call.resolve(result);
  }

  /**
   * Requests USB permission for the given device path.
   * If already granted, resolves immediately.
   * Otherwise shows the system permission dialog and resolves via BroadcastReceiver.
   */
  @PluginMethod
  public void requestPermission(PluginCall call) {
    String deviceName = call.getString("deviceName");
    if (deviceName == null) { call.reject("deviceName required"); return; }

    if (usbManager == null) { call.reject("USB not available"); return; }

    UsbDevice device = usbManager.getDeviceList().get(deviceName);
    if (device == null) { call.reject("Device not found: " + deviceName); return; }

    if (usbManager.hasPermission(device)) {
      JSObject result = new JSObject();
      result.put("granted", true);
      result.put("deviceName", deviceName);
      call.resolve(result);
      return;
    }

    pendingPermissionCall = call;

    int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        : PendingIntent.FLAG_UPDATE_CURRENT;

    PendingIntent pi = PendingIntent.getBroadcast(
        getContext(), 0, new Intent(ACTION_USB_PERMISSION), flags);
    usbManager.requestPermission(device, pi);
  }

  /**
   * Sends base-64 encoded ESC/POS bytes to the USB device.
   * Requires permission to have been granted first.
   * Finds the USB_CLASS_PRINTER interface (class 0x07), or falls back to any
   * interface that exposes a bulk-OUT endpoint.
   */
  @PluginMethod
  public void print(PluginCall call) {
    String deviceName = call.getString("deviceName");
    String dataBase64 = call.getString("data");

    if (deviceName == null || dataBase64 == null) {
      call.reject("deviceName and data are required");
      return;
    }
    if (usbManager == null) { call.reject("USB not available"); return; }

    UsbDevice device = usbManager.getDeviceList().get(deviceName);
    if (device == null) { call.reject("Device not found: " + deviceName); return; }

    if (!usbManager.hasPermission(device)) { call.reject("NO_PERMISSION"); return; }

    byte[] data;
    try {
      data = Base64.decode(dataBase64, Base64.DEFAULT);
    } catch (Exception e) {
      call.reject("Invalid base64 data");
      return;
    }

    UsbInterface usbInterface = findPrintInterface(device);
    if (usbInterface == null) { call.reject("No suitable USB interface found (no printer class or bulk-out endpoint)"); return; }

    UsbEndpoint bulkOut = findBulkOutEndpoint(usbInterface);
    if (bulkOut == null) { call.reject("No bulk-OUT endpoint found on interface"); return; }

    UsbDeviceConnection conn = usbManager.openDevice(device);
    if (conn == null) { call.reject("Failed to open USB device connection"); return; }

    try {
      if (!conn.claimInterface(usbInterface, true)) {
        call.reject("Failed to claim USB interface");
        return;
      }

      // Send in 16 KB chunks to avoid buffer issues on some Android USB stacks
      final int CHUNK = 16384;
      for (int offset = 0; offset < data.length; offset += CHUNK) {
        int len  = Math.min(CHUNK, data.length - offset);
        int sent = conn.bulkTransfer(bulkOut, data, offset, len, 5000);
        if (sent < 0) {
          call.reject("USB bulk transfer failed at offset " + offset);
          return;
        }
      }

      call.resolve();
    } catch (Exception e) {
      Log.e(TAG, "USB print error", e);
      call.reject("USB print error: " + e.getMessage());
    } finally {
      conn.releaseInterface(usbInterface);
      conn.close();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Prefer USB printer class (0x07); fall back to any interface with bulk-OUT. */
  private UsbInterface findPrintInterface(UsbDevice device) {
    for (int i = 0; i < device.getInterfaceCount(); i++) {
      UsbInterface iface = device.getInterface(i);
      if (iface.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return iface;
    }
    for (int i = 0; i < device.getInterfaceCount(); i++) {
      UsbInterface iface = device.getInterface(i);
      if (findBulkOutEndpoint(iface) != null) return iface;
    }
    return null;
  }

  private UsbEndpoint findBulkOutEndpoint(UsbInterface iface) {
    for (int i = 0; i < iface.getEndpointCount(); i++) {
      UsbEndpoint ep = iface.getEndpoint(i);
      if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK
          && ep.getDirection() == UsbConstants.USB_DIR_OUT) return ep;
    }
    return null;
  }
}
