import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    mockSignup.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render login form by default', () => {
      renderWithRouter();

      expect(screen.getByRole('heading', { name: 'ConvoLab' })).toBeInTheDocument();
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

      expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Login');
    });

    it('should render back to home link', () => {
      renderWithRouter();

      expect(screen.getByTestId('auth-link-back-home')).toBeInTheDocument();
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
      expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Sign Up');
    });

    it('should switch back to login form when login tab is clicked', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTestId('auth-tab-signup'));
      fireEvent.click(screen.getByTestId('auth-tab-login'));

      expect(screen.queryByTestId('auth-input-name')).not.toBeInTheDocument();
      expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Login');
    });

    it('should highlight active tab', () => {
      renderWithRouter();

      const loginTab = screen.getByTestId('auth-tab-login');
      expect(loginTab.className).toContain('border-periwinkle');
    });
  });

  describe('Login Flow', () => {
    it('should call login with email and password', async () => {
      renderWithRouter();

      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should navigate to library after successful login', async () => {
      renderWithRouter();

      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/library');
      });
    });

    it('should show loading state during login', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {}));

      renderWithRouter();

      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-submit-button')).toHaveTextContent('Loading...');
      });
      expect(screen.getByTestId('auth-submit-button')).toBeDisabled();
    });

    it('should show error message on login failure', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      renderWithRouter();

      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'wrongpassword' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });
  });

  describe('Signup Flow', () => {
    it('should call signup with all required fields', async () => {
      renderWithRouter();

      fireEvent.click(screen.getByTestId('auth-tab-signup'));

      fireEvent.change(screen.getByTestId('auth-input-name'), {
        target: { value: 'John Doe' },
      });
      fireEvent.change(screen.getByTestId('auth-input-invite-code'), {
        target: { value: 'INVITE123' },
      });
      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalledWith(
          'john@example.com',
          'password123',
          'John Doe',
          'INVITE123'
        );
      });
    });

    it('should navigate to library after successful signup', async () => {
      renderWithRouter();

      fireEvent.click(screen.getByTestId('auth-tab-signup'));

      fireEvent.change(screen.getByTestId('auth-input-name'), {
        target: { value: 'John' },
      });
      fireEvent.change(screen.getByTestId('auth-input-invite-code'), {
        target: { value: 'INVITE' },
      });
      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/library');
      });
    });

    it('should show error message on signup failure', async () => {
      mockSignup.mockRejectedValue(new Error('Invalid invite code'));

      renderWithRouter();

      fireEvent.click(screen.getByTestId('auth-tab-signup'));

      fireEvent.change(screen.getByTestId('auth-input-name'), {
        target: { value: 'John' },
      });
      fireEvent.change(screen.getByTestId('auth-input-invite-code'), {
        target: { value: 'WRONG' },
      });
      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid invite code')).toBeInTheDocument();
      });
    });
  });

  describe('Return URL', () => {
    it('should navigate to returnUrl after login if present', async () => {
      render(
        <MemoryRouter initialEntries={['/login?returnUrl=/app/create']}>
          <LoginPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/create');
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

      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'password' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(screen.getByText('An error occurred')).toBeInTheDocument();
      });
    });

    it('should clear error on new form submission', async () => {
      mockLogin.mockRejectedValueOnce(new Error('First error')).mockResolvedValueOnce(undefined);

      renderWithRouter();

      // First submission - fails
      fireEvent.change(screen.getByTestId('auth-input-email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('auth-input-password'), {
        target: { value: 'wrong' },
      });
      fireEvent.click(screen.getByTestId('auth-submit-button'));

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
