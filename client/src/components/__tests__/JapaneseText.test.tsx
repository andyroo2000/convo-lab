import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import JapaneseText from '../JapaneseText';

describe('JapaneseText', () => {
  describe('basic rendering', () => {
    it('should render text without metadata', () => {
      render(<JapaneseText text="こんにちは" />);
      expect(screen.getByText('こんにちは')).toBeInTheDocument();
    });

    it('should apply japanese-text class', () => {
      render(<JapaneseText text="テスト" />);
      const element = screen.getByText('テスト');
      expect(element).toHaveClass('japanese-text');
    });

    it('should apply custom className', () => {
      render(<JapaneseText text="テスト" className="custom-class" />);
      const element = screen.getByText('テスト');
      expect(element).toHaveClass('japanese-text');
      expect(element).toHaveClass('custom-class');
    });

    it('should render as span element', () => {
      render(<JapaneseText text="テスト" />);
      const element = screen.getByText('テスト');
      expect(element.tagName).toBe('SPAN');
    });
  });

  describe('furigana display', () => {
    const metadataWithFurigana = {
      japanese: {
        furigana: '買[か]い物[もの]',
        kanji: '買い物',
        kana: 'かいもの',
      },
    };

    it('should show furigana by default', () => {
      const { container } = render(<JapaneseText text="買い物" metadata={metadataWithFurigana} />);
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBeGreaterThan(0);
    });

    it('should show furigana when showFurigana is true', () => {
      const { container } = render(
        <JapaneseText text="買い物" metadata={metadataWithFurigana} showFurigana />
      );
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBeGreaterThan(0);
    });

    it('should hide furigana when showFurigana is false', () => {
      const { container } = render(
        <JapaneseText text="買い物" metadata={metadataWithFurigana} showFurigana={false} />
      );
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(0);
    });

    it('should display kanji text when furigana is hidden', () => {
      const { container } = render(
        <JapaneseText text="買い物" metadata={metadataWithFurigana} showFurigana={false} />
      );
      expect(container.textContent).toBe('買い物');
    });
  });

  describe('ruby tag generation', () => {
    it('should convert bracket notation to ruby tags', () => {
      const { container } = render(<JapaneseText text="買[か]い物[もの]" />);
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(2);
    });

    it('should include rt elements with readings', () => {
      const { container } = render(<JapaneseText text="買[か]" />);
      // For checking rt elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rtElement = container.querySelector('rt');
      expect(rtElement).toBeInTheDocument();
      expect(rtElement?.textContent).toBe('か');
    });

    it('should handle single kanji with reading', () => {
      const { container } = render(<JapaneseText text="日[ひ]" />);
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const ruby = container.querySelector('ruby');
      expect(ruby?.textContent).toContain('日');
      expect(ruby?.textContent).toContain('ひ');
    });

    it('should handle multiple kanji in sequence', () => {
      const { container } = render(<JapaneseText text="東京[とうきょう]" />);
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const ruby = container.querySelector('ruby');
      expect(ruby?.textContent).toContain('東京');
      expect(ruby?.textContent).toContain('とうきょう');
    });

    it('should preserve text between bracketed content', () => {
      const { container } = render(<JapaneseText text="買[か]い物[もの]です" />);
      // The 'い' and 'です' should be preserved - textContent is safe to use
      expect(container.textContent).toContain('い');
      expect(container.textContent).toContain('です');
    });
  });

  describe('metadata handling', () => {
    it('should use furigana from metadata when available', () => {
      const metadata = {
        japanese: {
          furigana: '日本語[にほんご]',
          kanji: '日本語',
          kana: 'にほんご',
        },
      };
      const { container } = render(
        <JapaneseText text="plain text" metadata={metadata} showFurigana />
      );
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const ruby = container.querySelector('ruby');
      expect(ruby).toBeInTheDocument();
    });

    it('should use kanji from metadata when furigana is hidden', () => {
      const metadata = {
        japanese: {
          furigana: '日本語[にほんご]',
          kanji: '日本語',
          kana: 'にほんご',
        },
      };
      render(<JapaneseText text="plain text" metadata={metadata} showFurigana={false} />);
      expect(screen.getByText('日本語')).toBeInTheDocument();
    });

    it('should fallback to text when metadata.japanese is undefined', () => {
      render(<JapaneseText text="フォールバック" metadata={{}} />);
      expect(screen.getByText('フォールバック')).toBeInTheDocument();
    });

    it('should fallback to text when metadata is undefined', () => {
      render(<JapaneseText text="テスト" metadata={undefined} />);
      expect(screen.getByText('テスト')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const { container } = render(<JapaneseText text="" />);
      // For checking class on empty element, we need container
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('.japanese-text')).toBeInTheDocument();
      expect(container.textContent).toBe('');
    });

    it('should handle text with no kanji', () => {
      render(<JapaneseText text="ひらがなだけ" />);
      expect(screen.getByText('ひらがなだけ')).toBeInTheDocument();
    });

    it('should handle text with no readings', () => {
      const { container } = render(<JapaneseText text="漢字のみ" />);
      // No ruby elements because no bracket notation
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(0);
      expect(container.textContent).toBe('漢字のみ');
    });

    it('should handle katakana text', () => {
      render(<JapaneseText text="カタカナ" />);
      expect(screen.getByText('カタカナ')).toBeInTheDocument();
    });

    it('should handle mixed hiragana and katakana', () => {
      render(<JapaneseText text="ひらがなとカタカナ" />);
      expect(screen.getByText('ひらがなとカタカナ')).toBeInTheDocument();
    });

    it('should handle numbers in text', () => {
      render(<JapaneseText text="123円[えん]" />);
      expect(screen.getByText(/123/)).toBeInTheDocument();
    });

    it('should handle punctuation marks', () => {
      render(<JapaneseText text="日本語[にほんご]！" />);
      expect(screen.getByText(/！/)).toBeInTheDocument();
    });
  });

  describe('complex patterns', () => {
    it('should handle compound words', () => {
      const { container } = render(<JapaneseText text="日本語[にほんご]の授業[じゅぎょう]" />);
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(2);
    });

    it('should handle sentence with multiple bracketed readings', () => {
      const { container } = render(<JapaneseText text="私[わたし]は学生[がくせい]です" />);
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(2);
      expect(container.textContent).toContain('です');
    });

    it('should handle irregular readings', () => {
      const { container } = render(<JapaneseText text="今日[きょう]" />);
      // For checking ruby/rt elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const ruby = container.querySelector('ruby');
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rt = container.querySelector('rt');
      expect(ruby?.textContent).toContain('今日');
      expect(rt?.textContent).toBe('きょう');
    });

    it('should handle long compound kanji', () => {
      const { container } = render(<JapaneseText text="東京大学[とうきょうだいがく]" />);
      // For checking ruby elements, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const ruby = container.querySelector('ruby');
      expect(ruby?.textContent).toContain('東京大学');
    });
  });

  describe('className handling', () => {
    it('should merge multiple classNames', () => {
      render(<JapaneseText text="テスト" className="class1 class2" />);
      const element = screen.getByText('テスト');
      expect(element).toHaveClass('class1');
      expect(element).toHaveClass('class2');
    });

    it('should handle empty className', () => {
      render(<JapaneseText text="テスト" className="" />);
      const element = screen.getByText('テスト');
      expect(element).toHaveClass('japanese-text');
    });
  });

  describe('html sanitization', () => {
    it('should only allow ruby and rt tags', () => {
      // The component uses dangerouslySetInnerHTML but only generates ruby/rt
      const { container } = render(<JapaneseText text="日[ひ]本[ほん]" />);
      // Verify only expected elements exist
      // For checking element types, we need container as there's no better semantic query
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const allowedTags = container.querySelectorAll('ruby, rt, span');
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const allElements = container.querySelectorAll('*');
      expect(allowedTags.length).toBe(allElements.length);
    });
  });
});
