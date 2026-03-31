export const runtimeEnvironmentConfig = {
  default: 'prod',
  apiUrls: {
    prod: 'https://api.yumdude.com/api/v1',
    dev: 'https://api.dev.yumdude.com/api/v1'
  },
  wsUrls: {
    prod: 'https://api.yumdude.com/ws/orders',
    dev: 'https://api.dev.yumdude.com/ws/orders'
  },
  devUsernameAllowlist: ['hv@yumdude.com']
} as const;
