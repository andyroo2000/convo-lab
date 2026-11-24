import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminBetaRequestsTab from '../AdminBetaRequestsTab';
import { createBetaInvitation, getBetaRequests } from '../../../lib/betaRequestsApi';

vi.mock('../../../lib/betaRequestsApi', () => ({
  getBetaRequests: vi.fn(),
  approveBetaRequest: vi.fn(),
  createBetaInvitation: vi.fn(),
}));

const invited = {
  id: 'invitation-1',
  email: 'learner@example.com',
  devices: [],
  message: '',
  createdAt: '2026-11-24T15:00:00Z',
  approvedAt: '2026-11-24T15:00:00Z',
  invitationSentAt: '2026-11-24T15:00:01Z',
  inviteCode: 'WELCOME8',
  redeemedAt: null,
};
const emptyPage = { requests: [], currentPage: 1, lastPage: 1, total: 0 };

describe('Direct beta invitations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getBetaRequests).mockResolvedValue(emptyPage);
  });

  it('sends only on submission, blocks duplicates, and reveals the invited record', async () => {
    let finish!: (value: typeof invited) => void;
    vi.mocked(createBetaInvitation).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<AdminBetaRequestsTab />);
    await screen.findByText('No pending requests.');
    const input = screen.getByRole('textbox', { name: 'Email address' });
    fireEvent.change(input, { target: { value: 'learner@example.com' } });
    expect(createBetaInvitation).not.toHaveBeenCalled();
    const form = screen.getByRole('form', { name: 'Invite by email' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(createBetaInvitation).toHaveBeenCalledExactlyOnceWith('learner@example.com');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
    vi.mocked(getBetaRequests).mockResolvedValue({ ...emptyPage, requests: [invited], total: 1 });
    finish(invited);
    expect(
      await screen.findByRole('article', { name: 'Request from learner@example.com' })
    ).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Show')).toHaveValue('invited'));
    expect(input).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Invitation for learner@example.com is in Invited.'
    );
  });

  it('retains the address and reveals a pending retry when email delivery fails', async () => {
    render(<AdminBetaRequestsTab />);
    await screen.findByText('No pending requests.');
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'invited' } });
    await screen.findByText('No invited requests.');
    vi.mocked(createBetaInvitation).mockRejectedValue(
      new Error('Invitation could not be sent. Retry.')
    );
    vi.mocked(getBetaRequests).mockResolvedValue({
      ...emptyPage,
      requests: [{ ...invited, invitationSentAt: null }],
      total: 1,
    });
    const input = screen.getByRole('textbox', { name: 'Email address' });
    fireEvent.change(input, { target: { value: 'learner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByRole('button', { name: 'Retry sending invite' })).toBeEnabled();
    expect(input).toHaveValue('learner@example.com');
    expect(input).toBeEnabled();
    expect(screen.getByLabelText('Show')).toHaveValue('pending');
    expect(screen.getByRole('status')).toHaveTextContent('could not be sent');
    expect(
      screen.queryByText('Invitation for learner@example.com is in Invited.')
    ).not.toBeInTheDocument();
  });
});
