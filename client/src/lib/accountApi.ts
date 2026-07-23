export interface AccountApiContract {
  currentUser: string;
  quota: string;
  passwordMethod: 'PUT';
  passwordPath: string;
  passwordBody: (currentPassword: string, newPassword: string) => Record<string, string>;
  deleteBody: (currentPassword: string) => Record<string, string>;
}

export function createAccountApiContract(apiUrl = ''): AccountApiContract {
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

export const accountApi = createAccountApiContract();
