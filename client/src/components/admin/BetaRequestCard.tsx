import type { BetaRequest } from '../../lib/betaRequestsApi';

interface Props {
  request: BetaRequest;
  sending: string | null;
  onApprove: (id: string) => void;
}
const date = (value: string) => new Date(value).toLocaleString();
const requestStatus = (request: BetaRequest) => {
  if (request.redeemedAt) return 'Redeemed';
  if (request.invitationSentAt) return 'Invited';
  return request.approvedAt ? 'Approved · not sent' : 'Pending';
};
const BetaRequestCard = ({ request, sending, onApprove }: Props) => {
  const sent = Boolean(request.invitationSentAt);
  const label = request.approvedAt ? 'Retry sending invite' : 'Approve & send invite';
  return (
    <article className="beta-request-card" aria-label={`Request from ${request.email}`}>
      <div className="beta-request-summary">
        <div>
          <h3>{request.email}</h3>
          <p className="beta-request-date">Requested {date(request.createdAt)}</p>
          <div className="beta-request-devices">
            {request.devices.map((device) => (
              <span key={device}>{device}</span>
            ))}
          </div>
        </div>
        <span className={`beta-request-status ${sent ? 'is-sent' : ''}`}>
          {requestStatus(request)}
        </span>
      </div>
      <p className="beta-request-message">{request.message || 'No message provided.'}</p>
      {sent ? (
        <p className="beta-request-date">
          Sent {date(request.invitationSentAt!)}
          {request.inviteCode && (
            <>
              {' '}
              · Code <code>{request.inviteCode}</code>
            </>
          )}
        </p>
      ) : (
        <button
          type="button"
          disabled={sending !== null}
          className="retro-admin-v3-btn-primary"
          onClick={() => onApprove(request.id)}
        >
          {sending === request.id ? 'Sending invitation…' : label}
        </button>
      )}
    </article>
  );
};

export default BetaRequestCard;
