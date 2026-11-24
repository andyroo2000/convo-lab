const key = 'convolab.beta-invite';
export function inviteFromSearch(params: URLSearchParams): string {
  const code = params.get('inviteCode') ?? '';
  return /^[A-Za-z0-9]{6,20}$/.test(code) ? code : '';
}
export function rememberBetaInvite(code: string) {
  try {
    if (code) sessionStorage.setItem(key, code);
    else sessionStorage.removeItem(key);
  } catch {
    /* The email also contains the code. */
  }
}
export function pendingBetaInvite(): string {
  try {
    return inviteFromSearch(new URLSearchParams({ inviteCode: sessionStorage.getItem(key) ?? '' }));
  } catch {
    return '';
  }
}
export function clearBetaInvite() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Storage may be unavailable. */
  }
}
