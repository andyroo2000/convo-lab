export interface AuthApiContract {
  login: string;
  logout: string;
  signup: string;
  googleStart: string;
  claimInvite: string;
  claimInviteBody: (inviteCode: string) => Record<string, string>;
  verifyEmail: (token: string) => { url: string; init: RequestInit };
  resendVerification: string;
  forgotPassword: string;
  resetPassword: string;
  resetPasswordBody: (email: string, token: string, newPassword: string) => Record<string, string>;
}

export function createAuthApiContract(apiUrl = ''): AuthApiContract {
  // Browser auth must stay same-origin so session and XSRF cookies reach Learning OS.
  // Vite and the production router select the upstream for these canonical paths.
  const browserAuthBase = `${apiUrl}/api/convolab/browser/auth`;

  return {
    login: `${browserAuthBase}/login`,
    logout: `${browserAuthBase}/logout`,
    signup: `${browserAuthBase}/signup`,
    googleStart: `${browserAuthBase}/google`,
    claimInvite: `${browserAuthBase}/google/invite`,
    claimInviteBody: (inviteCode) => ({ inviteCode }),
    verifyEmail: (token) => ({
      url: `${browserAuthBase}/verification`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      },
    }),
    resendVerification: `${browserAuthBase}/verification/send`,
    forgotPassword: `${apiUrl}/api/auth/password/forgot`,
    resetPassword: `${apiUrl}/api/auth/password/reset`,
    resetPasswordBody: (email, token, newPassword) => ({
      email,
      token,
      password: newPassword,
      password_confirmation: newPassword,
    }),
  };
}

export const authApi = createAuthApiContract();
