package com.nearbite.restaurant;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(BondedDevicesPlugin.class);
    registerPlugin(UsbPrinterPlugin.class);
    registerPlugin(NetworkPrinterPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
