/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Complex DOM structure testing requires direct node access for checking SVG paths and pill segments
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SegmentedPill from '../SegmentedPill';

describe('SegmentedPill', () => {
  describe('rendering', () => {
    it('should render left text', () => {
      render(<SegmentedPill leftText="Left" rightText="Right" />);
      expect(screen.getByText('Left')).toBeInTheDocument();
    });

    it('should render right text', () => {
      render(<SegmentedPill leftText="Left" rightText="Right" />);
      expect(screen.getByText('Right')).toBeInTheDocument();
    });

    it('should render both segments', () => {
      const { container } = render(<SegmentedPill leftText="Category" rightText="Value" />);
      const segments = container.querySelectorAll('.pl-4, .pl-3');
      expect(segments.length).toBe(2);
    });
  });

  describe('color props', () => {
    it('should apply periwinkle color to left segment', () => {
      const { container } = render(
        <SegmentedPill leftText="Left" rightText="Right" leftColor="periwinkle" />
      );
      const leftSegment = container.querySelector('.pl-4');
      expect(leftSegment).toHaveClass('bg-periwinkle', 'text-white');
    });

    it('should apply coral color to right segment', () => {
      const { container } = render(
        <SegmentedPill leftText="Left" rightText="Right" rightColor="coral" />
      );
      const rightSegment = container.querySelector('.pl-3');
      expect(rightSegment).toHaveClass('bg-coral', 'text-white');
    });

    it('should apply yellow color with navy text', () => {
      const { container } = render(
        <SegmentedPill leftText="Left" rightText="Right" leftColor="yellow" />
      );
      const leftSegment = container.querySelector('.pl-4');
      expect(leftSegment).toHaveClass('bg-yellow', 'text-navy');
    });

    it('should apply different colors to each segment', () => {
      const { container } = render(
        <SegmentedPill
          leftText="Type"
          rightText="Status"
          leftColor="mint"
          rightColor="strawberry"
        />
      );
      const leftSegment = container.querySelector('.pl-4');
      const rightSegment = container.querySelector('.pl-3');

      expect(leftSegment).toHaveClass('bg-mint-dark');
      expect(rightSegment).toHaveClass('bg-strawberry');
    });
  });

  describe('text transform props', () => {
    it('should not transform text by default', () => {
      const { container } = render(<SegmentedPill leftText="left" rightText="right" />);
      const leftSegment = container.querySelector('.pl-4');

      expect(leftSegment).not.toHaveClass('uppercase');
      expect(leftSegment).not.toHaveClass('capitalize');
    });

    it('should apply uppercase to left segment when prop is true', () => {
      const { container } = render(<SegmentedPill leftText="left" rightText="right" uppercase />);
      const leftSegment = container.querySelector('.pl-4');
      expect(leftSegment).toHaveClass('uppercase', 'tracking-wide');
    });

    it('should apply capitalize when prop is true', () => {
      const { container } = render(<SegmentedPill leftText="left" rightText="right" capitalize />);
      const leftSegment = container.querySelector('.pl-4');
      const rightSegment = container.querySelector('.pl-3');

      expect(leftSegment).toHaveClass('capitalize');
      expect(rightSegment).toHaveClass('capitalize');
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <SegmentedPill leftText="Left" rightText="Right" className="custom-class" />
      );
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should preserve base classes with custom className', () => {
      const { container } = render(
        <SegmentedPill leftText="Left" rightText="Right" className="mt-4" />
      );
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('inline-flex', 'items-center', 'mt-4');
    });
  });

  describe('styling', () => {
    it('should have rounded corners on the wrapper', () => {
      const { container } = render(<SegmentedPill leftText="Left" rightText="Right" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('rounded-md');
    });

    it('should have shadow on the wrapper', () => {
      const { container } = render(<SegmentedPill leftText="Left" rightText="Right" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('shadow-sm');
    });

    it('should have overflow hidden to clip segment shapes', () => {
      const { container } = render(<SegmentedPill leftText="Left" rightText="Right" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('overflow-hidden');
    });

    it('should have proper font styling', () => {
      const { container } = render(<SegmentedPill leftText="Left" rightText="Right" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('text-sm', 'font-medium');
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
      it(`should render ${color} color on left segment without error`, () => {
        render(<SegmentedPill leftText={color} rightText="Right" leftColor={color} />);
        expect(screen.getByText(color)).toBeInTheDocument();
      });

      it(`should render ${color} color on right segment without error`, () => {
        render(<SegmentedPill leftText="Left" rightText={color} rightColor={color} />);
        expect(screen.getByText(color)).toBeInTheDocument();
      });
    });
  });

  describe('chevron styling', () => {
    it('should have clipPath style on right segment', () => {
      const { container } = render(<SegmentedPill leftText="Left" rightText="Right" />);
      const rightSegment = container.querySelector('.pl-3') as HTMLElement;

      expect(rightSegment.style.clipPath).toBe(
        'polygon(8px 0%, 100% 0%, 100% 100%, 8px 100%, 0% 50%)'
      );
    });

    it('should have negative margin on right segment', () => {
      const { container } = render(<SegmentedPill leftText="Left" rightText="Right" />);
      const rightSegment = container.querySelector('.pl-3') as HTMLElement;

      expect(rightSegment.style.marginLeft).toBe('-8px');
    });
  });
});
