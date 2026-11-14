import { useRef, type ReactNode } from 'react';

const DismissibleBackdrop = ({
  children,
  className,
  onDismiss,
  dismissDisabled = false,
}: {
  children: ReactNode;
  className: string;
  onDismiss: () => void;
  dismissDisabled?: boolean;
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
        const dismiss = startedOutside.current && event.target === event.currentTarget;
        startedOutside.current = false;
        if (dismissDisabled) return;
        if (dismiss) onDismiss();
      }}
    >
      {children}
    </div>
  );
};

export default DismissibleBackdrop;
