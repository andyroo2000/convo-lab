import { MessageCircle, FlaskConical } from 'lucide-react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'light' | 'dark';
  className?: string;
}

const Logo = ({ size = 'medium', variant = 'light', className = '' }: LogoProps) => {
  const sizeMap = {
    small: 'w-5 h-5',
    medium: 'w-6 h-6',
    large: 'w-10 h-10',
  };

  const textSizeMap = {
    small: 'text-base',
    medium: 'text-lg',
    large: 'text-2xl',
  };

  const iconSize = sizeMap[size];
  const textSize = textSizeMap[size];
  const colorClass = variant === 'dark' ? 'text-dark-brown' : 'text-white';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        <MessageCircle className={`${iconSize} ${colorClass}`} />
        <FlaskConical className={`${iconSize} ${colorClass}`} />
      </div>
      <span className={`hidden sm:inline font-bold ${textSize} ${colorClass}`}>ConvoLab</span>
    </div>
  );
};

export default Logo;
