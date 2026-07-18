export const AUTH_SESSION_EXPIRED_EVENT = 'convo-lab:auth-session-expired';

export function notifyAuthSessionExpired(response: Response): void {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }
}
