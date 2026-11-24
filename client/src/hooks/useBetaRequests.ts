import { useEffect, useRef, useState } from 'react';
import { JsonRequestError } from '../lib/apiClient';
import {
  approveBetaRequest,
  createBetaInvitation,
  getBetaRequests,
  type BetaRequest,
  type BetaRequestFilter,
  type BetaRequestPage,
} from '../lib/betaRequestsApi';

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const isDeliveryFailure = (error: unknown) =>
  error instanceof JsonRequestError && error.status === 503;

export default function useBetaRequests() {
  const [filter, setFilter] = useState<BetaRequestFilter>('pending');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<BetaRequestPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getBetaRequests(filter, page, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setPage(Math.min(result.currentPage, result.lastPage));
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(message(caught, 'Could not load requests.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filter, page, revision]);
  const sendInvitation = async (
    id: string,
    operation: () => Promise<BetaRequest>,
    directInvite = false
  ) => {
    if (pending.current) return false;
    pending.current = true;
    setSending(id);
    setNotice('');
    try {
      const sent = await operation();
      setNotice(
        directInvite
          ? `Invitation for ${sent.email} is in Invited.`
          : `Invitation sent to ${sent.email}.`
      );
      if (directInvite) {
        setFilter('invited');
        setPage(1);
      }
      return true;
    } catch (caught) {
      setNotice(message(caught, 'Could not send the invitation. Please retry.'));
      if (directInvite && isDeliveryFailure(caught)) {
        setFilter('pending');
        setPage(1);
      }
      return false;
    } finally {
      pending.current = false;
      setSending(null);
      setRevision((value) => value + 1);
    }
  };
  const changeFilter = (value: BetaRequestFilter) => {
    setFilter(value);
    setPage(1);
  };
  return {
    filter,
    changeFilter,
    page,
    setPage,
    data,
    loading,
    error,
    notice,
    sending,
    approve: (id: string) => sendInvitation(id, () => approveBetaRequest(id)),
    invite: (email: string) =>
      sendInvitation('direct-invite', () => createBetaInvitation(email), true),
    refresh: () => setRevision((value) => value + 1),
  };
}
