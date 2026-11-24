import useBetaRequests from '../../hooks/useBetaRequests';
import type { BetaRequestFilter } from '../../lib/betaRequestsApi';
import BetaRequestCard from './BetaRequestCard';
import InviteBetaTesterForm from './InviteBetaTesterForm';
import './betaRequests.css';

type RequestState = ReturnType<typeof useBetaRequests>;
const RequestPagination = ({ state }: { state: RequestState }) => {
  if (!state.data || state.data.lastPage <= 1) return null;
  return (
    <nav className="beta-request-pagination" aria-label="Request pages">
      <button
        type="button"
        disabled={state.page === 1 || state.sending !== null}
        onClick={() => state.setPage(state.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {state.page} of {state.data.lastPage}
      </span>
      <button
        type="button"
        disabled={state.page >= state.data.lastPage || state.sending !== null}
        onClick={() => state.setPage(state.page + 1)}
      >
        Next
      </button>
    </nav>
  );
};

const RequestResults = ({ state }: { state: RequestState }) => {
  if (state.loading) return <p>Loading requests…</p>;
  if (state.error || !state.data) return null;
  return (
    <>
      {state.data.requests.length === 0 && (
        <p className="beta-request-empty">
          No {state.filter === 'all' ? '' : state.filter} requests.
        </p>
      )}
      {state.data.requests.map((request) => (
        <BetaRequestCard
          key={request.id}
          request={request}
          sending={state.sending}
          onApprove={state.approve}
        />
      ))}
      <RequestPagination state={state} />
    </>
  );
};
const AdminBetaRequestsTab = () => {
  const state = useBetaRequests();
  return (
    <section className="retro-admin-v3-pane beta-requests" aria-labelledby="beta-requests-heading">
      <div className="retro-admin-v3-pane-header">
        <div>
          <h2 id="beta-requests-heading">Beta requests</h2>
          <p>Review requests and email a single-use invitation.</p>
        </div>
        <button
          type="button"
          className="retro-admin-v3-btn-secondary"
          onClick={state.refresh}
          disabled={state.loading || state.sending !== null}
        >
          Refresh
        </button>
      </div>
      <InviteBetaTesterForm busy={state.sending !== null} onInvite={state.invite} />
      <div className="beta-request-toolbar">
        <label htmlFor="beta-request-filter">
          Show
          <select
            id="beta-request-filter"
            value={state.filter}
            disabled={state.sending !== null}
            onChange={(event) => state.changeFilter(event.target.value as BetaRequestFilter)}
          >
            <option value="pending">Pending requests</option>
            <option value="invited">Invited</option>
            <option value="all">All requests</option>
          </select>
        </label>
        {state.data && (
          <span>
            {state.data.total} {state.data.total === 1 ? 'request' : 'requests'}
          </span>
        )}
      </div>
      <p role="status" aria-live="polite">
        {state.notice}
      </p>
      {state.error && (
        <p role="alert" className="retro-admin-v3-alert is-error">
          {state.error}
        </p>
      )}
      <RequestResults state={state} />
    </section>
  );
};

export default AdminBetaRequestsTab;
