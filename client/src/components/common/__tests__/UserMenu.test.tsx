import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserMenu from '../UserMenu';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
}

describe('UserMenu', () => {
  const defaultProps = {
    userName: 'John Doe',
    role: 'user' as const,
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render user menu button', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      const button = screen.getByTestId('user-menu-button');
      expect(button).toBeInTheDocument();
    });

    it('should display user initial when no avatar URL', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should display avatar image when avatarUrl is provided', () => {
      renderWithRouter(
        <UserMenu
          {...defaultProps}
          avatarUrl="https://example.com/avatar.png"
        />
      );

      const img = screen.getByAltText('John Doe');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('should not show dropdown initially', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Behavior', () => {
    it('should open dropdown on click', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      fireEvent.click(screen.getByTestId('user-menu-button'));

      expect(screen.getByTestId('user-menu-item-settings')).toBeInTheDocument();
      expect(screen.getByTestId('user-menu-item-logout')).toBeInTheDocument();
    });

    it('should close dropdown on second click', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      const button = screen.getByTestId('user-menu-button');
      fireEvent.click(button);
      expect(screen.getByTestId('user-menu-item-settings')).toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument();
    });

    it('should close dropdown on ESC key', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      fireEvent.click(screen.getByTestId('user-menu-button'));
      expect(screen.getByTestId('user-menu-item-settings')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument();
    });

    it('should close dropdown on outside click', () => {
      renderWithRouter(
        <div>
          <UserMenu {...defaultProps} />
          <button data-testid="outside-button">Outside</button>
        </div>
      );

      fireEvent.click(screen.getByTestId('user-menu-button'));
      expect(screen.getByTestId('user-menu-item-settings')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId('outside-button'));
      expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to settings page', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      fireEvent.click(screen.getByTestId('user-menu-button'));
      fireEvent.click(screen.getByTestId('user-menu-item-settings'));

      expect(mockNavigate).toHaveBeenCalledWith('/app/settings');
    });

    it('should close dropdown after navigation', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      fireEvent.click(screen.getByTestId('user-menu-button'));
      fireEvent.click(screen.getByTestId('user-menu-item-settings'));

      expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument();
    });
  });

  describe('Logout', () => {
    it('should call onLogout when logout is clicked', () => {
      const onLogout = vi.fn();
      renderWithRouter(<UserMenu {...defaultProps} onLogout={onLogout} />);

      fireEvent.click(screen.getByTestId('user-menu-button'));
      fireEvent.click(screen.getByTestId('user-menu-item-logout'));

      expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it('should close dropdown after logout', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      fireEvent.click(screen.getByTestId('user-menu-button'));
      fireEvent.click(screen.getByTestId('user-menu-item-logout'));

      expect(screen.queryByTestId('user-menu-item-logout')).not.toBeInTheDocument();
    });
  });

  describe('Admin Menu Item', () => {
    it('should show admin link for admin users', () => {
      renderWithRouter(<UserMenu {...defaultProps} role="admin" />);

      fireEvent.click(screen.getByTestId('user-menu-button'));

      expect(screen.getByTestId('user-menu-item-admin')).toBeInTheDocument();
    });

    it('should not show admin link for regular users', () => {
      renderWithRouter(<UserMenu {...defaultProps} role="user" />);

      fireEvent.click(screen.getByTestId('user-menu-button'));

      expect(screen.queryByTestId('user-menu-item-admin')).not.toBeInTheDocument();
    });

    it('should not show admin link for demo users', () => {
      renderWithRouter(<UserMenu {...defaultProps} role="demo" />);

      fireEvent.click(screen.getByTestId('user-menu-button'));

      expect(screen.queryByTestId('user-menu-item-admin')).not.toBeInTheDocument();
    });

    it('should navigate to admin page', () => {
      renderWithRouter(<UserMenu {...defaultProps} role="admin" />);

      fireEvent.click(screen.getByTestId('user-menu-button'));
      fireEvent.click(screen.getByTestId('user-menu-item-admin'));

      expect(mockNavigate).toHaveBeenCalledWith('/app/admin');
    });
  });

  describe('Avatar Colors', () => {
    it('should use default indigo color', () => {
      renderWithRouter(<UserMenu {...defaultProps} />);

      // Should render with default color scheme
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should accept different avatar colors', () => {
      const colors = ['indigo', 'teal', 'purple', 'pink', 'emerald', 'amber', 'rose', 'cyan'];

      colors.forEach(color => {
        const { unmount } = renderWithRouter(
          <UserMenu {...defaultProps} avatarColor={color} />
        );

        // Should render without errors
        expect(screen.getByTestId('user-menu-button')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('User Initial', () => {
    it('should display uppercase first letter', () => {
      renderWithRouter(<UserMenu {...defaultProps} userName="alice" />);

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should handle empty name gracefully', () => {
      renderWithRouter(<UserMenu {...defaultProps} userName="" />);

      expect(screen.getByTestId('user-menu-button')).toBeInTheDocument();
    });
  });
});
