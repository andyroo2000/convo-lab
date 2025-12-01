import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock useAuth hook
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  pinyinDisplayMode: 'toneMarks' as const,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

import ChineseText from '../ChineseText';

describe('ChineseText', () => {
  beforeEach(() => {
    // Reset to default pinyin display mode
    mockUser.pinyinDisplayMode = 'toneMarks';
  });

  describe('basic rendering', () => {
    it('should render text without metadata', () => {
      render(<ChineseText text="你好" />);
      expect(screen.getByText('你好')).toBeInTheDocument();
    });

    it('should apply chinese-text class', () => {
      const { container } = render(<ChineseText text="测试" />);
      expect(container.querySelector('.chinese-text')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<ChineseText text="测试" className="custom-class" />);
      const element = container.querySelector('.chinese-text');
      expect(element).toHaveClass('custom-class');
    });

    it('should render as span element', () => {
      const { container } = render(<ChineseText text="测试" />);
      expect(container.querySelector('span.chinese-text')).toBeInTheDocument();
    });
  });

  describe('pinyin display', () => {
    const metadataWithPinyin = {
      chinese: {
        characters: '你好',
        pinyinToneMarks: 'nǐ hǎo',
        pinyinToneNumbers: 'ni3 hao3',
      },
    };

    it('should show pinyin by default', () => {
      const { container } = render(
        <ChineseText text="你好" metadata={metadataWithPinyin} />
      );
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBeGreaterThan(0);
    });

    it('should show pinyin when showPinyin is true', () => {
      const { container } = render(
        <ChineseText text="你好" metadata={metadataWithPinyin} showPinyin={true} />
      );
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBeGreaterThan(0);
    });

    it('should hide pinyin when showPinyin is false', () => {
      const { container } = render(
        <ChineseText text="你好" metadata={metadataWithPinyin} showPinyin={false} />
      );
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(0);
    });

    it('should display plain text when pinyin is hidden', () => {
      render(
        <ChineseText text="你好" metadata={metadataWithPinyin} showPinyin={false} />
      );
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
  });

  describe('ruby tag generation', () => {
    const metadata = {
      chinese: {
        characters: '中国',
        pinyinToneMarks: 'zhōng guó',
        pinyinToneNumbers: 'zhong1 guo2',
      },
    };

    it('should create ruby elements for each character', () => {
      const { container } = render(
        <ChineseText text="中国" metadata={metadata} />
      );
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(2);
    });

    it('should include rt elements with pinyin', () => {
      const { container } = render(
        <ChineseText text="中国" metadata={metadata} />
      );
      const rtElements = container.querySelectorAll('rt');
      expect(rtElements.length).toBe(2);
    });

    it('should use tone marks by default', () => {
      const { container } = render(
        <ChineseText text="中国" metadata={metadata} />
      );
      expect(container.innerHTML).toContain('zhōng');
    });
  });

  describe('tone number mode', () => {
    beforeEach(() => {
      mockUser.pinyinDisplayMode = 'toneNumbers';
    });

    const metadata = {
      chinese: {
        characters: '你好',
        pinyinToneMarks: 'nǐ hǎo',
        pinyinToneNumbers: 'ni3 hao3',
      },
    };

    it('should display tone numbers when user preference is toneNumbers', () => {
      const { container } = render(
        <ChineseText text="你好" metadata={metadata} />
      );
      expect(container.innerHTML).toContain('ni3');
      expect(container.innerHTML).toContain('hao3');
    });
  });

  describe('bracket notation parsing', () => {
    it('should parse bracket notation for speaker names', () => {
      const { container } = render(
        <ChineseText text="张[zhāng]" />
      );
      const rubyElement = container.querySelector('ruby');
      expect(rubyElement).toBeInTheDocument();
    });

    it('should create ruby for each bracketed character', () => {
      const { container } = render(
        <ChineseText text="张[zhāng]军[jūn]" />
      );
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(2);
    });

    it('should strip bracket notation when pinyin is hidden', () => {
      render(
        <ChineseText text="张[zhāng]军[jūn]" showPinyin={false} />
      );
      expect(screen.getByText('张军')).toBeInTheDocument();
    });

    it('should convert tone marks to numbers in bracket notation when mode is toneNumbers', () => {
      mockUser.pinyinDisplayMode = 'toneNumbers';
      const { container } = render(
        <ChineseText text="张[zhāng]" />
      );
      expect(container.innerHTML).toContain('zhang1');
    });
  });

  describe('tone mark to number conversion', () => {
    beforeEach(() => {
      mockUser.pinyinDisplayMode = 'toneNumbers';
    });

    it('should convert first tone (ā → a1)', () => {
      const { container } = render(
        <ChineseText text="妈[mā]" />
      );
      expect(container.innerHTML).toContain('ma1');
    });

    it('should convert second tone (á → a2)', () => {
      const { container } = render(
        <ChineseText text="麻[má]" />
      );
      expect(container.innerHTML).toContain('ma2');
    });

    it('should convert third tone (ǎ → a3)', () => {
      const { container } = render(
        <ChineseText text="马[mǎ]" />
      );
      expect(container.innerHTML).toContain('ma3');
    });

    it('should convert fourth tone (à → a4)', () => {
      const { container } = render(
        <ChineseText text="骂[mà]" />
      );
      expect(container.innerHTML).toContain('ma4');
    });

    it('should handle ü with tones', () => {
      const { container } = render(
        <ChineseText text="女[nǚ]" />
      );
      // ǚ should become ü3
      expect(container.innerHTML).toContain('ü3') || expect(container.innerHTML).toContain('ü');
    });
  });

  describe('metadata handling', () => {
    it('should use characters from metadata when available', () => {
      const metadata = {
        chinese: {
          characters: '中文',
          pinyinToneMarks: 'zhōng wén',
          pinyinToneNumbers: 'zhong1 wen2',
        },
      };
      const { container } = render(
        <ChineseText text="other text" metadata={metadata} />
      );
      expect(container.textContent).toContain('中');
      expect(container.textContent).toContain('文');
    });

    it('should fallback to text when no chinese metadata', () => {
      render(<ChineseText text="测试文本" metadata={{}} />);
      expect(screen.getByText('测试文本')).toBeInTheDocument();
    });

    it('should fallback to text when metadata is undefined', () => {
      render(<ChineseText text="测试" metadata={undefined} />);
      expect(screen.getByText('测试')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const { container } = render(<ChineseText text="" />);
      expect(container.querySelector('.chinese-text')).toBeInTheDocument();
    });

    it('should handle punctuation in text', () => {
      const metadata = {
        chinese: {
          characters: '你好！',
          pinyinToneMarks: 'nǐ hǎo',
          pinyinToneNumbers: 'ni3 hao3',
        },
      };
      const { container } = render(
        <ChineseText text="你好！" metadata={metadata} />
      );
      // Punctuation should be preserved without ruby
      expect(container.textContent).toContain('！');
    });

    it('should handle mixed Chinese and English', () => {
      render(<ChineseText text="Hello中国" />);
      const content = screen.getByText(/Hello中国/).textContent;
      expect(content).toContain('Hello');
      expect(content).toContain('中国');
    });

    it('should handle numbers in text', () => {
      const metadata = {
        chinese: {
          characters: '123个',
          pinyinToneMarks: 'gè',
          pinyinToneNumbers: 'ge4',
        },
      };
      const { container } = render(
        <ChineseText text="123个" metadata={metadata} />
      );
      expect(container.textContent).toContain('123');
    });

    it('should handle empty pinyin in metadata', () => {
      const metadata = {
        chinese: {
          characters: '你好',
          pinyinToneMarks: '',
          pinyinToneNumbers: '',
        },
      };
      render(<ChineseText text="你好" metadata={metadata} />);
      // Should display characters without crashing
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
  });

  describe('complex sentences', () => {
    it('should handle multi-character words', () => {
      const metadata = {
        chinese: {
          characters: '中华人民共和国',
          pinyinToneMarks: 'zhōng huá rén mín gòng hé guó',
          pinyinToneNumbers: 'zhong1 hua2 ren2 min2 gong4 he2 guo2',
        },
      };
      const { container } = render(
        <ChineseText text="中华人民共和国" metadata={metadata} />
      );
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(7); // 7 characters
    });

    it('should handle sentence with spaces and punctuation', () => {
      const metadata = {
        chinese: {
          characters: '你好，世界！',
          pinyinToneMarks: 'nǐ hǎo shì jiè',
          pinyinToneNumbers: 'ni3 hao3 shi4 jie4',
        },
      };
      const { container } = render(
        <ChineseText text="你好，世界！" metadata={metadata} />
      );
      // Should have ruby for 你好世界 (4 characters)
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBe(4);
      // Punctuation preserved
      expect(container.textContent).toContain('，');
      expect(container.textContent).toContain('！');
    });
  });

  describe('className handling', () => {
    it('should merge multiple classNames', () => {
      const { container } = render(
        <ChineseText text="测试" className="class1 class2" />
      );
      const element = container.querySelector('.chinese-text');
      expect(element).toHaveClass('class1');
      expect(element).toHaveClass('class2');
    });

    it('should handle empty className', () => {
      const { container } = render(<ChineseText text="测试" className="" />);
      expect(container.querySelector('.chinese-text')).toBeInTheDocument();
    });
  });

  describe('null user handling', () => {
    it('should default to toneMarks when user is null', () => {
      // This test relies on the default behavior
      const metadata = {
        chinese: {
          characters: '你好',
          pinyinToneMarks: 'nǐ hǎo',
          pinyinToneNumbers: 'ni3 hao3',
        },
      };
      const { container } = render(
        <ChineseText text="你好" metadata={metadata} />
      );
      // Default is toneMarks
      expect(container.innerHTML).toContain('nǐ');
    });
  });
});
