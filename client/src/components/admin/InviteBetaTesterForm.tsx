import { useState } from 'react';

interface Props {
  busy: boolean;
  onInvite: (email: string) => Promise<boolean>;
}

const InviteBetaTesterForm = ({ busy, onInvite }: Props) => {
  const [email, setEmail] = useState('');
  return (
    <form
      className="beta-request-card"
      aria-label="Invite by email"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onInvite(email.trim())) setEmail('');
      }}
    >
      <h3 className="font-semibold mb-2">Invite by email</h3>
      <p className="mb-4">Send a single-use code and a link to join the beta.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor="beta-invitation-email" className="flex-1 basis-56 min-w-0">
          <span className="sr-only">Email address</span>
          <input
            id="beta-invitation-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            placeholder="name@example.com"
            className="retro-admin-v3-input w-full"
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button type="submit" className="retro-admin-v3-btn-primary" disabled={busy}>
          Send invitation
        </button>
      </div>
    </form>
  );
};

export default InviteBetaTesterForm;
