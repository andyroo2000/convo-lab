import { MessageCircle, FlaskConical } from 'lucide-react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function Logo({ size = 'medium', className = '' }: LogoProps) {
  const sizeMap = {
    small: 'w-5 h-5',
    medium: 'w-6 h-6',
    large: 'w-10 h-10',
  };

  const iconSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <MessageCircle className={`${iconSize} text-white`} />
      <FlaskConical className={`${iconSize} text-white`} />
    </div>
  );
}
