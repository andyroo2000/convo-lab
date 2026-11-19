import { createContext, useContext, type RefObject } from 'react';

// Portaled dialogs must stay inside a native modal's top layer when one is open.
const ModalPortalContext = createContext<RefObject<HTMLElement> | null>(null);
export default ModalPortalContext;

export function useModalPortalHost() {
  const host = useContext(ModalPortalContext);
  return host?.current ?? document.body;
}
