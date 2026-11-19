import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import JournalNavigationContext from './JournalNavigationContext';

const JournalNavigationSlots = ({
  contents,
  settings,
}: {
  contents: ReactNode;
  settings: ReactNode;
}) => {
  const navigation = useContext(JournalNavigationContext);
  return (
    <>
      {navigation.contents ? createPortal(contents, navigation.contents) : contents}
      {navigation.settings && createPortal(settings, navigation.settings)}
    </>
  );
};
export default JournalNavigationSlots;
