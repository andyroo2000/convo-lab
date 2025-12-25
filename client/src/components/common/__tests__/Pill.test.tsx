/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Testing SVG pill shapes requires direct node access
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Pill from '../Pill';

describe('Pill', () => {
  describe('rendering', () => {
    it('should render children text', () => {
      render(<Pill>Test Content</Pill>);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render as a span element', () => {
      render(<Pill>Content</Pill>);
      const pill = screen.getByText('Content');
      expect(pill.tagName).toBe('SPAN');
    });
  });

  describe('color prop', () => {
    it('should apply gray color by default', () => {
      render(<Pill>Default</Pill>);
      const pill = screen.getByText('Default');
      expect(pill).toHaveClass('bg-gray-100', 'text-gray-600');
    });

    it('should apply periwinkle color', () => {
      render(<Pill color="periwinkle">Periwinkle</Pill>);
      const pill = screen.getByText('Periwinkle');
      expect(pill).toHaveClass('bg-periwinkle-light', 'text-periwinkle-dark');
    });

    it('should apply coral color', () => {
      render(<Pill color="coral">Coral</Pill>);
      const pill = screen.getByText('Coral');
      expect(pill).toHaveClass('bg-coral-light', 'text-coral-dark');
    });

    it('should apply strawberry color', () => {
      render(<Pill color="strawberry">Strawberry</Pill>);
      const pill = screen.getByText('Strawberry');
      expect(pill).toHaveClass('bg-strawberry-light', 'text-strawberry-dark');
    });

    it('should apply keylime color', () => {
      render(<Pill color="keylime">Keylime</Pill>);
      const pill = screen.getByText('Keylime');
      expect(pill).toHaveClass('bg-keylime-light', 'text-keylime-dark');
    });

    it('should apply mint color', () => {
      render(<Pill color="mint">Mint</Pill>);
      const pill = screen.getByText('Mint');
      expect(pill).toHaveClass('bg-mint', 'text-mint-dark');
    });

    it('should apply olive color', () => {
      render(<Pill color="olive">Olive</Pill>);
      const pill = screen.getByText('Olive');
      expect(pill).toHaveClass('bg-olive-light', 'text-olive-dark');
    });
  });

  describe('intensity prop', () => {
    it('should apply light intensity by default', () => {
      render(<Pill color="blue">Light Blue</Pill>);
      const pill = screen.getByText('Light Blue');
      expect(pill).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    it('should apply solid intensity', () => {
      render(
        <Pill color="blue" intensity="solid">
          Solid Blue
        </Pill>
      );
      const pill = screen.getByText('Solid Blue');
      expect(pill).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should apply solid periwinkle', () => {
      render(
        <Pill color="periwinkle" intensity="solid">
          Solid
        </Pill>
      );
      const pill = screen.getByText('Solid');
      expect(pill).toHaveClass('bg-periwinkle', 'text-white');
    });
  });

  describe('variant prop', () => {
    it('should apply default variant styles', () => {
      render(<Pill>Default</Pill>);
      const pill = screen.getByText('Default');
      expect(pill).toHaveClass('px-2', 'py-1', 'rounded');
    });

    it('should apply rounded-full variant', () => {
      render(<Pill variant="rounded-full">Rounded</Pill>);
      const pill = screen.getByText('Rounded');
      expect(pill).toHaveClass('px-2', 'py-1', 'rounded-full');
    });

    it('should apply small variant', () => {
      render(<Pill variant="small">Small</Pill>);
      const pill = screen.getByText('Small');
      expect(pill).toHaveClass('px-2', 'py-1', 'rounded', 'text-xs');
    });
  });

  describe('animated prop', () => {
    it('should not animate by default', () => {
      render(<Pill>Static</Pill>);
      const pill = screen.getByText('Static');
      expect(pill).not.toHaveClass('animate-pulse');
    });

    it('should animate when animated is true', () => {
      render(<Pill animated>Animated</Pill>);
      const pill = screen.getByText('Animated');
      expect(pill).toHaveClass('animate-pulse');
    });
  });

  describe('text transform props', () => {
    it('should not transform text by default', () => {
      render(<Pill>Normal Text</Pill>);
      const pill = screen.getByText('Normal Text');
      expect(pill).not.toHaveClass('uppercase');
      expect(pill).not.toHaveClass('capitalize');
    });

    it('should apply uppercase when prop is true', () => {
      render(<Pill uppercase>Uppercase</Pill>);
      const pill = screen.getByText('Uppercase');
      expect(pill).toHaveClass('uppercase');
    });

    it('should apply capitalize when prop is true', () => {
      render(<Pill capitalize>Capitalize</Pill>);
      const pill = screen.getByText('Capitalize');
      expect(pill).toHaveClass('capitalize');
    });

    it('should prioritize uppercase over capitalize', () => {
      render(
        <Pill uppercase capitalize>
          Both
        </Pill>
      );
      const pill = screen.getByText('Both');
      expect(pill).toHaveClass('uppercase');
      expect(pill).not.toHaveClass('capitalize');
    });
  });

  describe('icon prop', () => {
    it('should render icon on the left by default', () => {
      const icon = <span data-testid="test-icon">*</span>;
      const { container } = render(<Pill icon={icon}>With Icon</Pill>);

      const testIcon = screen.getByTestId('test-icon');
      expect(testIcon).toBeInTheDocument();

      // Verify icon appears in the DOM structure
      const pill = container.querySelector('span');
      const html = pill?.innerHTML || '';
      const iconPos = html.indexOf('test-icon');
      const textPos = html.indexOf('With Icon');
      expect(iconPos).toBeLessThan(textPos);
    });

    it('should render icon on the right when iconPosition is right', () => {
      const icon = <span data-testid="test-icon">*</span>;
      const { container } = render(
        <Pill icon={icon} iconPosition="right">
          With Icon
        </Pill>
      );

      const testIcon = screen.getByTestId('test-icon');
      expect(testIcon).toBeInTheDocument();

      // Verify icon appears after text in the DOM structure
      const pill = container.querySelector('span');
      const html = pill?.innerHTML || '';
      const iconPos = html.indexOf('test-icon');
      const textPos = html.indexOf('With Icon');
      expect(iconPos).toBeGreaterThan(textPos);
    });

    it('should add gap class when icon is present', () => {
      const icon = <span>*</span>;
      render(<Pill icon={icon}>With Gap</Pill>);
      const pill = screen.getByText('With Gap').closest('span');
      expect(pill).toHaveClass('gap-1');
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      render(<Pill className="custom-class">Custom</Pill>);
      const pill = screen.getByText('Custom');
      expect(pill).toHaveClass('custom-class');
    });

    it('should preserve base classes with custom className', () => {
      render(<Pill className="mt-2">Custom</Pill>);
      const pill = screen.getByText('Custom');
      expect(pill).toHaveClass('inline-flex', 'items-center', 'font-medium', 'mt-2');
    });
  });

  describe('all color schemes', () => {
    const colors = [
      'periwinkle',
      'coral',
      'strawberry',
      'keylime',
      'mint',
      'olive',
      'blue',
      'yellow',
      'red',
      'green',
      'gray',
      'orange',
      'pale-sky',
    ] as const;

    colors.forEach((color) => {
      it(`should render ${color} color without error`, () => {
        render(<Pill color={color}>{color}</Pill>);
        expect(screen.getByText(color)).toBeInTheDocument();
      });
    });
  });
});
