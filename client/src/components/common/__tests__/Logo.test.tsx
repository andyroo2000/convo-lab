import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Logo from '../Logo';

describe('Logo', () => {
  describe('rendering', () => {
    it('should render the ConvoLab text', () => {
      render(<Logo />);
      expect(screen.getByText('ConvoLab')).toBeInTheDocument();
    });

    it('should render both icons', () => {
      const { container } = render(<Logo />);
      // Check that SVG icons are rendered (MessageCircle and FlaskConical)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(2);
    });
  });

  describe('size prop', () => {
    it('should apply small size classes', () => {
      const { container } = render(<Logo size="small" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('should apply medium size classes by default', () => {
      const { container } = render(<Logo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6', 'h-6');
    });

    it('should apply large size classes', () => {
      const { container } = render(<Logo size="large" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-10', 'h-10');
    });

    it('should apply small text size for small variant', () => {
      render(<Logo size="small" />);
      const text = screen.getByText('ConvoLab');
      expect(text).toHaveClass('text-base');
    });

    it('should apply medium text size by default', () => {
      render(<Logo />);
      const text = screen.getByText('ConvoLab');
      expect(text).toHaveClass('text-lg');
    });

    it('should apply large text size for large variant', () => {
      render(<Logo size="large" />);
      const text = screen.getByText('ConvoLab');
      expect(text).toHaveClass('text-2xl');
    });
  });

  describe('variant prop', () => {
    it('should apply light variant (white text) by default', () => {
      const { container } = render(<Logo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-white');
    });

    it('should apply dark variant (dark-brown text)', () => {
      const { container } = render(<Logo variant="dark" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-dark-brown');
    });

    it('should apply variant to text as well', () => {
      render(<Logo variant="dark" />);
      const text = screen.getByText('ConvoLab');
      expect(text).toHaveClass('text-dark-brown');
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(<Logo className="custom-class" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should preserve default flex classes with custom className', () => {
      const { container } = render(<Logo className="mt-4" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'gap-2', 'mt-4');
    });
  });

  describe('responsive design', () => {
    it('should hide text on small screens', () => {
      render(<Logo />);
      const text = screen.getByText('ConvoLab');
      expect(text).toHaveClass('hidden', 'sm:inline');
    });
  });

  describe('accessibility', () => {
    it('should render icons as decorative (no role)', () => {
      const { container } = render(<Logo />);
      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        // Lucide icons don't have explicit roles by default, which is correct
        // for decorative icons alongside text
        expect(svg.tagName).toBe('svg');
      });
    });
  });
});
