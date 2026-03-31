/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nearbite.restaurant',
  appName: 'YumDude Partner',
  webDir: 'dist/yumdude-restaurant/browser',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['alert', 'sound']
    }
  }
};

export default config;
