import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nearbite.restaurant',
  appName: 'Nearbite Restaurant',
  webDir: 'dist/yumdude-restaurant/browser',
  server: {
    androidScheme: 'https'
  }
};

export default config;
