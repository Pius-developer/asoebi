// Every call from React to PHP goes through this file.
//
//   const { event } = await api.get(`/api/e/${code}`);
//   await api.post('/api/login', { email, password });
//
// It handles three things so the pages don't have to:
//  1. Sends JSON (or a FormData when uploading a photo).
//  2. Adds the CSRF token PHP gave us, so PHP knows the request came from our own app.
//  3. Turns PHP errors ({ error, field }) into a thrown ApiError the page can show.

let csrf = '';

export function setCsrf(token) {
  csrf = token;
}

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

async function request(method, url, data) {
  const opts = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (method !== 'GET') {
    opts.headers['X-CSRF-Token'] = csrf;
    if (data instanceof FormData) {
      opts.body = data; // the browser sets the multipart Content-Type itself
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data ?? {});
    }
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || 'Something went wrong. Please try again.', res.status, body.field);
  return body;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, data) => request('POST', url, data),
};
