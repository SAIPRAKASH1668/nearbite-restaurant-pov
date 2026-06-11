import { runtimeEnvironmentConfig } from './runtime-environment.config';

export const environment = {
  production: true,
  apiUrl: 'https://api.yumdude.com/api/v1',
  wsUrl: 'https://api.yumdude.com/ws/orders',
  androidUpdateManifestUrl: 'https://yumdude-partner-updates-191491198352-ap-south-1.s3.ap-south-1.amazonaws.com/yumdude-partner/update.json',
  runtimeEnvironment: runtimeEnvironmentConfig
};
