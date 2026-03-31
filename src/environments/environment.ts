import { runtimeEnvironmentConfig } from './runtime-environment.config';

export const environment = {
  production: false,
  apiUrl: 'https://api.yumdude.com/api/v1',
  wsUrl: 'https://api.yumdude.com/ws/orders',
  runtimeEnvironment: runtimeEnvironmentConfig
};
