import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
const mockLogin = vi.fn();
const mockSignup = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
  }),
}));

function renderWithRouter(initialRoute = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <LoginPage />
    </MemoryRouter>
  );
}

function fillSignupDetails(name: string, inviteCode: string) {
  fireEvent.click(screen.getByTestId('auth-tab-signup'));
  fireEvent.change(screen.getByTestId('auth-input-name'), { target: { value: name } });
  fireEvent.change(screen.getByTestId('auth-input-invite-code'), { target: { value: inviteCode } });
}

function submitCredentials(email: string, password: string) {
  fireEvent.change(screen.getByTestId('auth-input-email'), { target: { value: email } });
  fireEvent.change(screen.getByTestId('auth-input-password'), { target: { value: password } });
  fireEvent.click(screen.getByTestId('auth-submit-button'));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockLogin.mockResolvedValue(undefined);
    mockSignup.mockResolvedValue(undefined);
  });

  it('opens signup with the emailed invitation and carries it through Google sign-in', () => {
    renderWithRouter('/login?inviteCode=WELCOME8');
    expect(screen.getByTestId('auth-input-invite-code')).toHaveValue('WELCOME8');
    expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Create an account');
    fireEvent.click(screen.getByTestId('auth-google-link'));
    expect(sessionStorage.getItem('convolab.beta-invite')).toBe('WELCOME8');
  });

  it('ignores malformed invitation query values', () => {
    renderWithRouter('/login?inviteCode=%3Cscript%3E');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  describe('Rendering', () => {
    it('should render login form by default', () => {
      renderWithRouter();

      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByTestId('auth-tab-login')).toBeInTheDocument();
      expect(screen.getByTestId('auth-tab-signup')).toBeInTheDocument();
    });

    it('should render email and password inputs', () => {
      renderWithRouter();

      expect(screen.getByTestId('auth-input-email')).toBeInTheDocument();
      expect(screen.getByTestId('auth-input-password')).toBeInTheDocument();
    });

    it('should render login button', () => {
      renderWithRouter();

      expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Sign in');
    });

    it('should render back to home link', () => {
      renderWithRouter();

      expect(screen.getByTestId('auth-link-back-home')).toBeInTheDocument();
    });

    it('should use the configured Google OAuth start route', () => {
      renderWithRouter();

      expect(screen.getByTestId('auth-google-link')).toHaveAttribute(
        'href',
        '/api/convolab/browser/auth/google'
      );
    });

    it('should not show name and invite code fields in login mode', () => {
      renderWithRouter();

      expect(screen.queryByTestId('auth-input-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('auth-input-invite-code')).not.toBeInTheDocument();
    });
  });

  describe('Tab Switching', () => {
    it('should switch to signup form when signup tab is clicked', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTestId('auth-tab-signup'));

      expect(screen.getByTestId('auth-input-name')).toBeInTheDocument();
      expect(screen.getByTestId('auth-input-invite-code')).toBeInTheDocument();
      expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Create an account');
    });

    it('should switch back to login form when login tab is clicked', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTestId('auth-tab-signup'));
      fireEvent.click(screen.getByTestId('auth-tab-login'));

      expect(screen.queryByTestId('auth-input-name')).not.toBeInTheDocument();
      expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Sign in');
    });

    it('should present the current mode as a heading', () => {
      renderWithRouter();

      const loginTab = screen.getByTestId('auth-tab-login');
      expect(loginTab).toHaveRole('heading');
    });
  });

  describe('Login Flow', () => {
    it('should call login with email and password', async () => {
      renderWithRouter();

      submitCredentials('test@example.com', 'password123');

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should navigate to study after successful login', async () => {
      renderWithRouter();

      submitCredentials('test@example.com', 'password123');

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/journal');
      });
    });

    it('should show loading state during login', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {}));

      renderWithRouter();

      submitCredentials('test@example.com', 'password123');

      await waitFor(() => {
        expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Logging in...');
      });
      expect(screen.getByTestId('auth-submit-button')).toBeDisabled();
    });

    it('should show error message on login failure', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      renderWithRouter();

      submitCredentials('test@example.com', 'wrongpassword');

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });
  });

  describe('Signup Flow', () => {
    it('validates eight Unicode characters at signup and keeps sign-in available', () => {
      renderWithRouter();
      const field = screen.getByTestId('auth-input-password');
      fireEvent.change(field, { target: { value: '日😀本' } });
      expect(field).toBeValid();
      expect(field).not.toHaveAttribute('pattern');
      fillSignupDetails('Reader', 'INVITE');
      expect(field).toHaveAccessibleDescription('At least 8 characters');
      fireEvent.change(field, { target: { value: '123456😀' } });
      expect(field).toBeInvalid();
      fireEvent.change(field, { target: { value: '1234567😀' } });
      expect(field).toBeValid();
    });

    it('should call signup with all required fields', async () => {
      renderWithRouter();

      fillSignupDetails('John Doe', 'INVITE123');
      submitCredentials('john@example.com', 'password123');

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalledWith(
          'john@example.com',
          'password123',
          'John Doe',
          'INVITE123'
        );
      });
    });

    it('should navigate to study after successful signup', async () => {
      renderWithRouter();

      fillSignupDetails('John', 'INVITE');
      submitCredentials('john@example.com', 'password');

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/journal');
      });
    });

    it('should show error message on signup failure', async () => {
      mockSignup.mockRejectedValue(new Error('Invalid invite code'));

      renderWithRouter();

      fillSignupDetails('John', 'WRONG');
      submitCredentials('john@example.com', 'password');

      await waitFor(() => {
        expect(screen.getByText('Invalid invite code')).toBeInTheDocument();
      });
    });
  });

  describe('Return URL', () => {
    it('should navigate to returnUrl after login if present', async () => {
      render(
        <MemoryRouter initialEntries={['/login?returnUrl=/app/journal/cards']}>
          <LoginPage />
        </MemoryRouter>
      );

      submitCredentials('test@example.com', 'password123');

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/journal/cards');
      });
    });
  });

  describe('Form Validation', () => {
    it('should require email field', () => {
      renderWithRouter();

      const emailInput = screen.getByTestId('auth-input-email');
      expect(emailInput).toHaveAttribute('required');
    });

    it('should require password field', () => {
      renderWithRouter();

      const passwordInput = screen.getByTestId('auth-input-password');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should have email type on email input', () => {
      renderWithRouter();

      const emailInput = screen.getByTestId('auth-input-email');
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should have password type on password input', () => {
      renderWithRouter();

      const passwordInput = screen.getByTestId('auth-input-password');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-Error thrown values', async () => {
      mockLogin.mockRejectedValue('String error');

      renderWithRouter();

      submitCredentials('test@example.com', 'password');

      await waitFor(() => {
        expect(screen.getByText('An error occurred')).toBeInTheDocument();
      });
    });

    it('should clear error on new form submission', async () => {
      mockLogin.mockRejectedValueOnce(new Error('First error')).mockResolvedValueOnce(undefined);

      renderWithRouter();

      // First submission - fails
      submitCredentials('test@example.com', 'wrong');

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Second submission - succeeds
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'correct' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });
  });
});
