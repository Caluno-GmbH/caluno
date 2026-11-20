import { API_URL } from './constants';

export async function fetchSession(cookieHeader: string) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: {
        cookie: cookieHeader,
      },
      credentials: 'include',
    });
  } catch {
    return null;
  }
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`get-session failed with status ${response.status}`);
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}
