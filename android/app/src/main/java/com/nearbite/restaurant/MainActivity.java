package com.nearbite.restaurant;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(BondedDevicesPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
