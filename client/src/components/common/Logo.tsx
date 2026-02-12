import { MessageCircle, FlaskConical } from 'lucide-react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'light' | 'dark';
  className?: string;
  showKana?: boolean;
  showIcons?: boolean;
}

const Logo = ({
  size = 'medium',
  variant = 'light',
  className = '',
  showKana = false,
  showIcons = true,
}: LogoProps) => {
  const sizeMap = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-8 h-8',
  };

  const textSizeMap = {
    small: 'text-[1.55rem]',
    medium: 'text-[1.65rem]',
    large: 'text-[2rem]',
  };
  const kanaSizeMap = {
    small: 'text-[0.78rem]',
    medium: 'text-[0.92rem]',
    large: 'text-[1.05rem]',
  };

  const iconSize = sizeMap[size];
  const textSize = textSizeMap[size];
  const kanaSize = kanaSizeMap[size];
  const colorClass = variant === 'dark' ? 'text-[#173b65]' : 'text-[#f4f3df]';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {showIcons && (
        <div className="flex items-center gap-2 opacity-70">
          <MessageCircle className={`${iconSize} ${colorClass} stroke-[2.5]`} />
          <FlaskConical className={`${iconSize} ${colorClass} stroke-[2.5]`} />
        </div>
      )}
      <div className="hidden sm:flex flex-col leading-none">
        <span className={`retro-logo-wordmark ${textSize} ${colorClass}`}>CONVOLAB</span>
        {showKana && (
          <span className={`retro-logo-kana mt-0.5 ${kanaSize} ${colorClass}`}>コンボラボ</span>
        )}
      </div>
    </div>
  );
};

export default Logo;
