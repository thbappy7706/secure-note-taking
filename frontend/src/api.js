const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(
  /\/+$/,
  ''
);
const TOKEN_KEY = 'secure-note-token';

let token = localStorage.getItem(TOKEN_KEY);

export function getToken() {
  return token;
}

export function setToken(next) {
  token = next;
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${API_BASE_URL}. Is the backend running?`, 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || `Request failed with status ${response.status}`,
      response.status,
      data?.error?.details
    );
  }
  return data;
}

export { API_BASE_URL };
