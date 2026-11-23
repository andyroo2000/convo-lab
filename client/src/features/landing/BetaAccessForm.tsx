import { useState, type FormEvent } from 'react';

const BetaAccessForm = () => {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const devices = data.getAll('devices');
    if (!devices.length) {
      setError('Choose at least one platform.');
      return;
    }
    setError('');
    setStatus('sending');
    try {
      const response = await fetch('/api/convolab/browser/auth/beta-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: data.get('email'), devices, message: data.get('message') }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Too many requests. Please try again later.'
            : 'We couldn’t send the request. Please try again.'
        );
      setStatus('sent');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'We couldn’t send the request. Please try again.'
      );
      setStatus('idle');
    }
  };
  return (
    <section className="landing-access" id="request-access" aria-labelledby="beta-heading">
      <div>
        <h2 id="beta-heading">Join the beta.</h2>
        <p>
          Help shape a nice place
          <br />
          to practice Japanese.
        </p>
        <span className="landing-pencil" aria-hidden="true" />
      </div>
      {status === 'sent' ? (
        <p role="status" className="landing-success">
          Thanks for your interest! We’ll email you about access to the beta.
        </p>
      ) : (
        <form onSubmit={submit} className="landing-form" aria-label="Request beta access">
          <fieldset disabled={status === 'sending'}>
            <label htmlFor="beta-email">
              Email
              <input
                id="beta-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <fieldset>
              <legend>Where would you use Journal?</legend>
              <p className="landing-hint">Select all that apply.</p>
              <div className="landing-devices">
                {['Web', 'iOS', 'Android'].map((device) => (
                  <label key={device} htmlFor={`beta-device-${device}`}>
                    <input
                      id={`beta-device-${device}`}
                      type="checkbox"
                      name="devices"
                      value={device}
                    />
                    <span>{device}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor="beta-message">
              Why would you like to try it?
              <span className="landing-hint" id="beta-message-hint">
                Optional. You can also tell us how you heard about Journal.
              </span>
              <textarea
                id="beta-message"
                aria-describedby="beta-message-hint"
                name="message"
                rows={3}
                maxLength={2000}
              />
            </label>
            {error && (
              <p role="alert" className="landing-error">
                {error}
              </p>
            )}
            <button className="landing-cta" type="submit">
              {status === 'sending' ? 'Sending…' : 'Request access'}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
};

export default BetaAccessForm;
