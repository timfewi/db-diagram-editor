import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Interceptor to add CSRF token to all mutating HTTP requests
 */
@Injectable()
export class CsrfInterceptor implements HttpInterceptor {
    /**
     * Gets the CSRF token from a cookie or meta tag
     */
    private getToken(): string | null {
        // Try to get from cookie
        const csrfRegex = /XSRF-TOKEN=([^;]+)/;
        const match = csrfRegex.exec(document.cookie);
        if (match) return match[1];

        // Try to get from meta tag
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
    }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        // Only add the header for mutating requests
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            const token = this.getToken();

            if (token) {
                request = request.clone({
                    setHeaders: {
                        'X-CSRF-TOKEN': token
                    }
                });
            }
        }

        return next.handle(request);
    }
}
