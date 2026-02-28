import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Strips trailing slashes from API request URLs.
 * API Gateway returns a 301 redirect when a URL has a trailing slash,
 * and the browser follows it as a GET — breaking POST/PUT requests.
 */
export const trailingSlashInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;

  // Only act on relative API paths or absolute URLs ending with a slash
  // (but not bare "/" which would be the app root)
  if (url.length > 1 && url.endsWith('/')) {
    const cleanReq = req.clone({ url: url.replace(/\/+$/, '') });
    return next(cleanReq);
  }

  return next(req);
};
