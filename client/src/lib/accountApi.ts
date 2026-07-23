import { API_URL, LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED } from '../config';

export interface AccountApiContract {
  currentUser: string;
  quota: string;
  passwordMethod: 'PATCH' | 'PUT';
  passwordPath: string;
  passwordBody: (currentPassword: string, newPassword: string) => Record<string, string>;
  deleteBody: (currentPassword: string) => Record<string, string>;
}

export function createAccountApiContract(
  directLearningOs: boolean,
  apiUrl: string = API_URL
): AccountApiContract {
  if (directLearningOs) {
    const authBase = `${apiUrl}/api/convolab/auth`;

    return {
      currentUser: `${authBase}/me`,
      quota: `${authBase}/me/quota`,
      passwordMethod: 'PUT',
      passwordPath: `${authBase}/me/password`,
      passwordBody: (currentPassword, newPassword) => ({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPassword,
      }),
      deleteBody: (currentPassword) => ({
        current_password: currentPassword,
      }),
    };
  }

  return {
    currentUser: `${apiUrl}/api/auth/me`,
    quota: `${apiUrl}/api/auth/me/quota`,
    passwordMethod: 'PATCH',
    passwordPath: `${apiUrl}/api/auth/change-password`,
    passwordBody: (currentPassword, newPassword) => ({
      currentPassword,
      newPassword,
    }),
    deleteBody: (currentPassword) => ({
      currentPassword,
    }),
  };
}

export const accountApi = createAccountApiContract(LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED);
