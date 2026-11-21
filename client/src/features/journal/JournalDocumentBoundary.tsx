import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const isWritingDocument = (path: string) => /^\/app\/(journal|settings)(?:\/|$)/.test(path);
const writingDocument = isWritingDocument(window.location.pathname);

// Cross-origin isolation is a document policy, not a client-side route setting.
// Keep Journal and its settings modal together, and load a fresh document only
// when crossing this boundary so other sections retain their normal media policy.
const JournalDocumentBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const changingDocument = writingDocument !== isWritingDocument(location.pathname);
  useEffect(() => {
    if (changingDocument) window.location.replace(window.location.href);
  }, [changingDocument, location.key]);
  return changingDocument ? null : children;
};
export default JournalDocumentBoundary;
