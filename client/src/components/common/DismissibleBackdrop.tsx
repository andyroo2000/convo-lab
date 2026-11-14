import { useRef, type ReactNode } from 'react';

const DismissibleBackdrop = ({
  children,
  className,
  onDismiss,
}: {
  children: ReactNode;
  className: string;
  onDismiss: () => void;
}) => {
  const startedOutside = useRef(false);
  return (
    <div
      role="presentation"
      className={className}
      onPointerDown={(event) => {
        startedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (startedOutside.current && event.target === event.currentTarget) onDismiss();
        startedOutside.current = false;
      }}
    >
      {children}
    </div>
  );
};

export default DismissibleBackdrop;
