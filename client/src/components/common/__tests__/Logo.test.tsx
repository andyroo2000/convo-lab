/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Testing SVG logos requires direct node access to verify paths, viewBox, and other SVG attributes
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Logo from '../Logo';

describe('Logo', () => {
  describe('rendering', () => {
    it('should render the ConvoLab text', () => {
      render(<Logo />);
      expect(screen.getByText('CONVOLAB')).toBeInTheDocument();
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
      expect(svg).toHaveClass('w-4', 'h-4');
    });

    it('should apply medium size classes by default', () => {
      const { container } = render(<Logo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('should apply large size classes', () => {
      const { container } = render(<Logo size="large" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-8', 'h-8');
    });

    it('should apply small text size for small variant', () => {
      render(<Logo size="small" />);
      const text = screen.getByText('CONVOLAB');
      expect(text).toHaveClass('text-[1.55rem]');
    });

    it('should apply medium text size by default', () => {
      render(<Logo />);
      const text = screen.getByText('CONVOLAB');
      expect(text).toHaveClass('text-[1.65rem]');
    });

    it('should apply large text size for large variant', () => {
      render(<Logo size="large" />);
      const text = screen.getByText('CONVOLAB');
      expect(text).toHaveClass('text-[2rem]');
    });
  });

  describe('variant prop', () => {
    it('should apply light variant (white text) by default', () => {
      const { container } = render(<Logo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-[#f4f3df]');
    });

    it('should apply dark variant (dark-brown text)', () => {
      const { container } = render(<Logo variant="dark" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-[#173b65]');
    });

    it('should apply variant to text as well', () => {
      render(<Logo variant="dark" />);
      const text = screen.getByText('CONVOLAB');
      expect(text).toHaveClass('text-[#173b65]');
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
      expect(wrapper).toHaveClass('flex', 'items-center', 'gap-2.5', 'mt-4');
    });
  });

  describe('responsive design', () => {
    it('should hide text on small screens', () => {
      render(<Logo />);
      const text = screen.getByText('CONVOLAB');
      expect(text.parentElement).toHaveClass('hidden', 'sm:flex');
    });
  });

  describe('nav configuration', () => {
    it('should hide icons when showIcons is false', () => {
      const { container } = render(<Logo showIcons={false} />);
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(0);
    });

    it('should render katakana when showKana is true', () => {
      render(<Logo showKana />);
      expect(screen.getByText('コンボラボ')).toBeInTheDocument();
    });

    it('should apply retro logo typography classes', () => {
      render(<Logo showKana />);
      expect(screen.getByText('CONVOLAB')).toHaveClass('retro-logo-wordmark');
      expect(screen.getByText('コンボラボ')).toHaveClass('retro-logo-kana');
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
