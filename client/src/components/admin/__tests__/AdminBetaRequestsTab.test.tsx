import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminBetaRequestsTab from '../AdminBetaRequestsTab';
import { getBetaRequests, approveBetaRequest } from '../../../lib/betaRequestsApi';

vi.mock('../../../lib/betaRequestsApi', () => ({
  getBetaRequests: vi.fn(),
  approveBetaRequest: vi.fn(),
}));
const record = {
  id: 'request-1',
  email: 'learner@example.com',
  devices: ['Web', 'Android'],
  message: 'A paragraph a day.',
  createdAt: '2026-11-23T12:00:00Z',
  approvedAt: null,
  invitationSentAt: null,
  inviteCode: null,
  redeemedAt: null,
};
const page = { requests: [record], currentPage: 1, lastPage: 1, total: 1 };
describe('Admin beta requests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getBetaRequests).mockResolvedValue(page);
  });
  it('shows applicant details and sends only after approval', async () => {
    let finish!: (value: typeof record) => void;
    vi.mocked(approveBetaRequest).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<AdminBetaRequestsTab />);
    const card = await screen.findByRole('article', { name: 'Request from learner@example.com' });
    expect(within(card).getByText('A paragraph a day.')).toBeInTheDocument();
    expect(within(card).getByText('Android')).toBeInTheDocument();
    expect(approveBetaRequest).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole('button', { name: 'Approve & send invite' }));
    expect(screen.getByRole('button', { name: 'Sending invitation…' })).toBeDisabled();
    expect(approveBetaRequest).toHaveBeenCalledExactlyOnceWith('request-1');
    vi.mocked(getBetaRequests).mockResolvedValue({ ...page, requests: [], total: 0 });
    finish(record);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Invitation sent to learner@example.com.'
      )
    );
    expect(await screen.findByText('No pending requests.')).toBeInTheDocument();
  });
  it('keeps failed delivery retryable and never claims success', async () => {
    vi.mocked(approveBetaRequest).mockRejectedValue(
      new Error('Invitation could not be sent. Retry.')
    );
    render(<AdminBetaRequestsTab />);
    const approve = await screen.findByRole('button', { name: 'Approve & send invite' });
    vi.mocked(getBetaRequests).mockResolvedValue({
      ...page,
      requests: [{ ...record, approvedAt: '2026-11-23T12:05:00Z', inviteCode: 'WELCOME8' }],
    });
    fireEvent.click(approve);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('could not be sent'));
    expect(screen.queryByText('Invitation sent to learner@example.com.')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Retry sending invite' })).toBeEnabled();
  });
  it('filters and pages requests and retries read failures', async () => {
    vi.mocked(getBetaRequests)
      .mockRejectedValueOnce(new Error('Temporarily unavailable'))
      .mockResolvedValue({ ...page, lastPage: 2, total: 26 });
    render(<AdminBetaRequestsTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporarily unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(getBetaRequests).toHaveBeenLastCalledWith('pending', 2, expect.any(AbortSignal))
    );
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'invited' } });
    await waitFor(() =>
      expect(getBetaRequests).toHaveBeenLastCalledWith('invited', 1, expect.any(AbortSignal))
    );
  });
  it('returns to the last remaining page after approving its final request', async () => {
    vi.mocked(getBetaRequests)
      .mockResolvedValueOnce({ ...page, lastPage: 2, total: 26 })
      .mockResolvedValueOnce({ ...page, currentPage: 2, lastPage: 2, total: 26 })
      .mockResolvedValueOnce({ ...page, requests: [], currentPage: 2, lastPage: 1, total: 25 })
      .mockResolvedValue(page);
    vi.mocked(approveBetaRequest).mockResolvedValue(record);
    render(<AdminBetaRequestsTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');
    fireEvent.click(await screen.findByRole('button', { name: 'Approve & send invite' }));
    await waitFor(() =>
      expect(getBetaRequests).toHaveBeenLastCalledWith('pending', 1, expect.any(AbortSignal))
    );
    expect(await screen.findByText('learner@example.com')).toBeInTheDocument();
  });
});
