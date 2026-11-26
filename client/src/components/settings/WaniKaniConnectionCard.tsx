import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectedBadge, LastSyncRow } from './ConnectionStatus';
import {
  useConnectWaniKani,
  useDisconnectWaniKani,
  useKnownKanji,
  useSyncWaniKani,
} from '../../hooks/useKnownKanji';

function useWaniKaniConnection() {
  const { t } = useTranslation('study');
  const connection = useKnownKanji();
  const connect = useConnectWaniKani();
  const disconnect = useDisconnectWaniKani();
  const sync = useSyncWaniKani();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : fallback);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim() || busy) return;
    await run(async () => {
      await connect.mutateAsync(token.trim());
      setToken('');
      await sync.mutateAsync();
    }, t('settings.wanikaniConnectFailed'));
  };
  return {
    t,
    connection,
    token,
    setToken,
    busy,
    syncing: sync.isPending,
    error,
    submit,
    sync: () => run(() => sync.mutateAsync(), t('settings.wanikaniSyncFailed')),
    disconnect: () => run(() => disconnect.mutateAsync(), t('settings.failedSave')),
  };
}

type ConnectionModel = ReturnType<typeof useWaniKaniConnection>;

const ConnectedWaniKani = ({ model }: { model: ConnectionModel }) => {
  const { t, connection, busy } = model;
  const lastSynced = connection.data?.wanikani.lastSyncedAt;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <ConnectedBadge />
        <span className="text-[#63705e]">{t('settings.viaApiKey')}</span>
      </div>
      <dl>
        <LastSyncRow timestamp={lastSynced ?? null} />
      </dl>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="calendar-action calendar-action-primary disabled:opacity-50"
          disabled={busy}
          onClick={model.sync}
        >
          {model.syncing ? t('settings.wanikaniSyncing') : t('settings.wanikaniSync')}
        </button>
        <button
          type="button"
          className="calendar-action disabled:opacity-50"
          disabled={busy}
          onClick={model.disconnect}
        >
          {t('settings.wanikaniDisconnect')}
        </button>
      </div>
    </>
  );
};

const WaniKaniConnectForm = ({ model }: { model: ConnectionModel }) => (
  <form onSubmit={model.submit} className="space-y-3">
    <label className="retro-settings-label" htmlFor="settings-wanikani-token">
      {model.t('settings.wanikaniToken')}
      <input
        id="settings-wanikani-token"
        type="password"
        className="retro-settings-input mt-2"
        value={model.token}
        onChange={(event) => model.setToken(event.target.value)}
        placeholder={model.t('settings.wanikaniTokenPlaceholder')}
        autoComplete="off"
        spellCheck={false}
        disabled={model.busy}
        required
      />
    </label>
    <p className="retro-settings-helper">{model.t('settings.wanikaniTokenHelp')}</p>
    <button
      type="submit"
      className="retro-settings-btn-primary"
      disabled={model.busy || !model.token.trim()}
    >
      {model.busy ? model.t('settings.wanikaniConnecting') : model.t('settings.wanikaniConnect')}
    </button>
  </form>
);

const WaniKaniConnectionCard = () => {
  const model = useWaniKaniConnection();
  const { t, connection } = model;
  return (
    <section aria-label="WaniKani" className="space-y-3 pb-6">
      <h3 className="text-2xl font-medium" style={{ fontFamily: 'inherit' }}>
        WaniKani
      </h3>
      {connection.isLoading && <p role="status">{t('settings.kanjiKnowledgeLoading')}</p>}
      {connection.isError && <p role="alert">{t('settings.kanjiKnowledgeFailed')}</p>}
      {connection.data &&
        (connection.data.wanikani.connected ? (
          <ConnectedWaniKani model={model} />
        ) : (
          <WaniKaniConnectForm model={model} />
        ))}
      {model.error && (
        <p role="alert" className="text-red-700">
          {model.error}
        </p>
      )}
    </section>
  );
};

export default WaniKaniConnectionCard;
