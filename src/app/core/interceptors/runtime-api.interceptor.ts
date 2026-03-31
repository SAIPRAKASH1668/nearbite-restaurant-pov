import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RuntimeEnvironmentService } from '../services/runtime-environment.service';

export const runtimeApiInterceptor: HttpInterceptorFn = (req, next) => {
  const runtimeEnvironmentService = inject(RuntimeEnvironmentService);
  const activeApiBaseUrl = runtimeEnvironmentService.getApiBaseUrl();
  const matchingBaseUrl = runtimeEnvironmentService
    .getKnownApiBaseUrls()
    .find((baseUrl) => req.url.startsWith(baseUrl));

  if (!matchingBaseUrl || matchingBaseUrl === activeApiBaseUrl) {
    return next(req);
  }

  const rewrittenRequest = req.clone({
    url: `${activeApiBaseUrl}${req.url.slice(matchingBaseUrl.length)}`
  });

  return next(rewrittenRequest);
};
