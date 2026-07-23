import { API_URL, LEARNING_OS_DIRECT_AUTH_API_ENABLED } from '../config';

export interface AuthApiContract {
  login: string;
  logout: string;
  signup: string;
  forgotPassword: string;
  resetPassword: string;
  resetPasswordBody: (email: string, token: string, newPassword: string) => Record<string, string>;
}

export function createAuthApiContract(
  directLearningOs: boolean,
  apiUrl: string = API_URL
): AuthApiContract {
  if (directLearningOs) {
    const browserAuthBase = `${apiUrl}/api/convolab/browser/auth`;

    return {
      login: `${browserAuthBase}/login`,
      logout: `${browserAuthBase}/logout`,
      signup: `${browserAuthBase}/signup`,
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

  return {
    login: `${apiUrl}/api/auth/login`,
    logout: `${apiUrl}/api/auth/logout`,
    signup: `${apiUrl}/api/auth/signup`,
    forgotPassword: `${apiUrl}/api/password-reset/request`,
    resetPassword: `${apiUrl}/api/password-reset/verify`,
    resetPasswordBody: (email, token, newPassword) => ({
      email,
      token,
      newPassword,
    }),
  };
}

export const authApi = createAuthApiContract(LEARNING_OS_DIRECT_AUTH_API_ENABLED);
