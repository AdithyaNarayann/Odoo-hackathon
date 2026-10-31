let isRedirectingToLogin = false;

// Custom event dispatcher for global toast and auth notifications
export const apiEvents = new EventTarget();

export function notifyUnauthorized() {
  apiEvents.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

export function notifyForbidden(detail) {
  apiEvents.dispatchEvent(
    new CustomEvent('auth:forbidden', {
      detail: detail || 'You do not have permission to perform this action.',
    })
  );
}

/**
 * Core API request wrapper.
 * Automatically attaches Authorization header if JWT exists,
 * handles 401 redirects and 403 toasts, and normalizes error objects.
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('brightloop_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(endpoint, config);
  } catch (err) {
    throw {
      detail: 'Network error. Please check backend connection.',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  }

  // Handle 401 Unauthorized
  if (response.status === 401) {
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
    notifyUnauthorized();
    // Redirect to login once if not already on an auth page
    const pathname = window.location.pathname;
    const isAuthPage = pathname.startsWith('/login') ||
                       pathname.startsWith('/signup') ||
                       pathname.startsWith('/forgot-password') ||
                       pathname.startsWith('/reset-password');
    if (!isAuthPage && !isRedirectingToLogin) {
      isRedirectingToLogin = true;
      setTimeout(() => {
        window.location.href = '/login';
      }, 50);
    }
    const errData = await response.json().catch(() => ({}));
    throw {
      ...errData,
      status: 401,
      detail: errData.detail || 'Session expired. Please log in again.',
    };
  }

  // Handle 403 Forbidden
  if (response.status === 403) {
    const errData = await response.json().catch(() => ({}));
    const message = errData.detail || 'Access forbidden: insufficient permissions.';
    notifyForbidden(message);
    throw {
      ...errData,
      status: 403,
      detail: message,
    };
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    throw {
      ...(typeof data === 'object' && data !== null ? data : { detail: data }),
      status: response.status,
    };
  }

  return data;
}

export const api = {
  get: (url, options) => apiRequest(url, { ...options, method: 'GET' }),
  post: (url, body, options) => apiRequest(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (url, body, options) => apiRequest(url, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body, options) => apiRequest(url, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (url, options) => apiRequest(url, { ...options, method: 'DELETE' }),
};
