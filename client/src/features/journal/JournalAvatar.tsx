import { useState } from 'react';
import { UserRound } from 'lucide-react';

interface Props {
  src?: string;
  alt?: string;
  className: string;
}

const AvatarImage = ({ src, alt = '', className }: Props) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <UserRound
        className={className}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={!alt}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={80}
      height={80}
      onError={() => setFailed(true)}
    />
  );
};

const JournalAvatar = ({ src, alt, className }: Props) => (
  <AvatarImage key={src} src={src} alt={alt} className={className} />
);
export default JournalAvatar;
