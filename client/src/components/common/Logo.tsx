import { MessageCircle, FlaskConical } from 'lucide-react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'light' | 'dark';
  className?: string;
}

export default function Logo({ size = 'medium', variant = 'light', className = '' }: LogoProps) {
  const sizeMap = {
    small: 'w-5 h-5',
    medium: 'w-6 h-6',
    large: 'w-10 h-10',
  };

  const iconSize = sizeMap[size];
  const colorClass = variant === 'dark' ? 'text-dark-brown' : 'text-white';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <MessageCircle className={`${iconSize} ${colorClass}`} />
      <FlaskConical className={`${iconSize} ${colorClass}`} />
    </div>
  );
}
