import { useEffect, useState } from 'react';
import { CalendarCheck2, CalendarDays, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../common/ConfirmModal';
import GoogleCalendarSettingsDialog from './GoogleCalendarSettingsDialog';
import {
  GoogleCalendarRequestError,
  googleCalendarConnectPath,
  useDisconnectGoogleCalendar,
  useGoogleCalendarConnection,
  useSyncGoogleCalendar,
} from '../../hooks/useGoogleCalendarConnection';

const CALLBACK_ERRORS = new Set([
  'access_denied',
  'account_conflict',
  'invalid_state',
  'missing_refresh_token',
  'missing_token',
]);

type ConnectionQuery = ReturnType<typeof useGoogleCalendarConnection>;
type ConnectionData = NonNullable<ConnectionQuery['data']>;
type SyncMutation = ReturnType<typeof useSyncGoogleCalendar>;
type DisconnectMutation = ReturnType<typeof useDisconnectGoogleCalendar>;
type SyncStatus = NonNullable<ConnectionData['sync']>['status'] | undefined;

function scopeLabel(scope: string, t: (key: string) => string) {
  if (scope.endsWith('/auth/calendar.readonly') || scope === 'calendar.readonly') {
    return t('time.calendarConnection.scopeReadonly');
  }
  if (scope.endsWith('/auth/calendar') || scope === 'calendar') {
    return t('time.calendarConnection.scopeCalendar');
  }
  return t('time.calendarConnection.scopeOther');
}

function formatLastSync(value: string | null, fallback: string) {
  if (!value) return fallback;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toLocaleString();
}

function isReconnectError(error: unknown) {
  return error instanceof GoogleCalendarRequestError && error.kind === 'not_connected';
}

interface SyncViewState {
  status: SyncStatus;
  isActive: boolean;
  isStillRunning: boolean;
  isFailed: boolean;
  reconnectRequired: boolean;
  statusTextKey: string;
  actionTextKey: string;
}

const isServerSyncActive = (status: SyncStatus) => status === 'queued' || status === 'running';

const hasCurrentMutationError = (status: SyncStatus, calendarSync: SyncMutation) => {
  if (!calendarSync.isError) return false;
  return status !== 'queued' && status !== 'running' && status !== 'succeeded';
};

const requiresReconnect = (
  connection: ConnectionQuery,
  calendarSync: SyncMutation,
  currentMutationError: boolean
) => {
  if (
    connection.data?.sync?.status === 'failed' &&
    connection.data.sync.errorCode === 'reconnect_required'
  ) {
    return true;
  }
  return currentMutationError && isReconnectError(calendarSync.error);
};

const syncStatusTextKey = (state: {
  status: SyncStatus;
  isActive: boolean;
  isStillRunning: boolean;
  isFailed: boolean;
}) => {
  if (state.isStillRunning) return 'time.calendarConnection.syncStillRunning';
  if (state.isActive) return 'time.calendarConnection.syncing';
  if (state.isFailed) return 'time.calendarConnection.syncNeedsAttention';
  return state.status === 'succeeded'
    ? 'time.calendarConnection.syncUpToDate'
    : 'time.calendarConnection.syncReady';
};

const syncActionTextKey = (state: {
  isActive: boolean;
  isStillRunning: boolean;
  isFailed: boolean;
}) => {
  if (state.isStillRunning) return 'time.calendarConnection.syncCheckAgain';
  if (state.isActive) return 'time.calendarConnection.syncing';
  return state.isFailed ? 'time.calendarConnection.syncRetry' : 'time.calendarConnection.syncNow';
};

const syncViewState = (connection: ConnectionQuery, calendarSync: SyncMutation): SyncViewState => {
  const status = connection.data?.sync?.status;
  const serverActive = isServerSyncActive(status);
  const isStillRunning = serverActive && connection.syncPollingTimedOut;
  const isActive = isStillRunning ? false : calendarSync.isPending || serverActive;
  const currentMutationError = hasCurrentMutationError(status, calendarSync);
  const isFailed = currentMutationError || status === 'failed';
  const reconnectRequired = requiresReconnect(connection, calendarSync, currentMutationError);
  const statusState = { status, isActive, isStillRunning, isFailed };
  return {
    ...statusState,
    reconnectRequired,
    statusTextKey: syncStatusTextKey(statusState),
    actionTextKey: syncActionTextKey(statusState),
  };
};

const ConnectionHeader = () => {
  const { t } = useTranslation(['study']);
  return (
    <div className="border-b border-navy/10 bg-gradient-to-r from-blue-50 to-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="retro-caps text-coral">{t('time.calendarConnection.eyebrow')}</p>
          <h2 id="calendar-connection-title" className="retro-headline text-3xl text-navy">
            {t('time.calendarConnection.title')}
          </h2>
        </div>
        <CalendarDays className="h-9 w-9 text-blue-600" aria-hidden="true" />
      </div>
    </div>
  );
};

const CallbackNotice = ({ state, reason }: { state: string | null; reason: string | null }) => {
  const { t } = useTranslation(['study']);
  if (state === 'connected') {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
        {t('time.calendarConnection.connectedSuccess')}
      </p>
    );
  }
  if (state !== 'error') return null;
  const safeReason = reason && CALLBACK_ERRORS.has(reason) ? reason : 'unknown';
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {t(`time.calendarConnection.errors.${safeReason}`)}
    </p>
  );
};

const ConnectionQueryStatus = ({ connection }: { connection: ConnectionQuery }) => {
  const { t } = useTranslation(['study']);
  if (connection.isLoading) {
    return (
      <div role="status" className="flex items-center gap-3 text-gray-600">
        <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
        {t('time.calendarConnection.loading')}
      </div>
    );
  }
  if (!connection.isError) return null;
  return (
    <div className="space-y-3">
      <p role="alert" className="text-red-700">
        {t('time.calendarConnection.loadError')}
      </p>
      <button type="button" className="btn-outline" onClick={() => connection.refetch()}>
        {t('time.calendarConnection.retry')}
      </button>
    </div>
  );
};

const DisconnectedContent = () => {
  const { t } = useTranslation(['study']);
  return (
    <div className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
      <div>
        <p className="font-bold text-navy">{t('time.calendarConnection.disconnected')}</p>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          {t('time.calendarConnection.description')}
        </p>
      </div>
      <a href={googleCalendarConnectPath} className="btn-primary text-center">
        {t('time.calendarConnection.connect')}
      </a>
    </div>
  );
};

const ConnectionDetails = ({ data, sync }: { data: ConnectionData; sync: SyncViewState }) => {
  const { t } = useTranslation(['study']);
  const access =
    data.scopes.length > 0
      ? [...new Set(data.scopes.map((scope) => scopeLabel(scope, t)))].join(
          t('time.calendarConnection.scopeSeparator')
        )
      : t('time.calendarConnection.scopeUnavailable');

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">
          <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
          {t('time.calendarConnection.connected')}
        </span>
        <span className="break-all font-bold text-navy">
          {data.accountEmail || t('time.calendarConnection.accountUnavailable')}
        </span>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <dt className="retro-caps text-gray-500">{t('time.calendarConnection.lastSync')}</dt>
          <dd className="mt-1 text-sm font-bold text-navy">
            {formatLastSync(data.lastSyncedAt, t('time.calendarConnection.notSynced'))}
          </dd>
        </div>
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <dt className="retro-caps text-gray-500">{t('time.calendarConnection.syncStatus')}</dt>
          <dd className="mt-1 text-sm font-bold text-navy" aria-live="polite">
            {t(sync.statusTextKey)}
          </dd>
        </div>
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <dt className="retro-caps text-gray-500">{t('time.calendarConnection.access')}</dt>
          <dd className="mt-1 flex items-start gap-2 text-sm font-bold text-navy">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            {access}
          </dd>
        </div>
      </dl>
    </>
  );
};

const SyncFeedback = ({ sync }: { sync: SyncViewState }) => {
  const { t } = useTranslation(['study']);
  if (sync.status === 'succeeded') {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
        {t('time.calendarConnection.syncSuccess')}
      </p>
    );
  }
  if (sync.isStillRunning) {
    return (
      <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        {t('time.calendarConnection.syncStillRunningHelp')}
      </p>
    );
  }
  if (!sync.isFailed) return null;
  return (
    <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
      <p>
        {sync.reconnectRequired
          ? t('time.calendarConnection.syncReconnect')
          : t('time.calendarConnection.syncError')}
      </p>
      {sync.reconnectRequired ? (
        <a href={googleCalendarConnectPath} className="mt-2 inline-flex font-bold underline">
          {t('time.calendarConnection.reconnect')}
        </a>
      ) : null}
    </div>
  );
};

const ConnectedActions = ({
  connection,
  calendarSync,
  sync,
  openSettings,
  openDisconnect,
}: {
  connection: ConnectionQuery;
  calendarSync: SyncMutation;
  sync: SyncViewState;
  openSettings: () => void;
  openDisconnect: () => void;
}) => {
  const { t } = useTranslation(['study']);
  const triggerSync = () => {
    if (sync.isStillRunning) {
      connection.refetch().catch(() => undefined);
      return;
    }
    calendarSync.mutate();
  };

  return (
    <div className="flex flex-wrap gap-3">
      {!sync.reconnectRequired ? (
        <button
          type="button"
          className="btn-primary inline-flex min-h-11 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={triggerSync}
          disabled={sync.isActive}
        >
          {sync.isActive ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t(sync.actionTextKey)}
        </button>
      ) : null}
      <button
        type="button"
        className="btn-outline min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={openSettings}
        disabled={sync.isActive}
      >
        {t('time.calendarConnection.chooseCalendars')}
      </button>
      <button
        type="button"
        className="btn-outline min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={openDisconnect}
        disabled={sync.isActive}
      >
        {t('time.calendarConnection.disconnect')}
      </button>
    </div>
  );
};

const ConnectedContent = ({
  connection,
  calendarSync,
  openSettings,
  openDisconnect,
}: {
  connection: ConnectionQuery;
  calendarSync: SyncMutation;
  openSettings: () => void;
  openDisconnect: () => void;
}) => {
  const data = connection.data!;
  const sync = syncViewState(connection, calendarSync);
  return (
    <div className="space-y-5">
      <ConnectionDetails data={data} sync={sync} />
      <SyncFeedback sync={sync} />
      <ConnectedActions
        connection={connection}
        calendarSync={calendarSync}
        sync={sync}
        openSettings={openSettings}
        openDisconnect={openDisconnect}
      />
    </div>
  );
};

const ConnectionContent = ({
  connection,
  calendarSync,
  openSettings,
  openDisconnect,
}: {
  connection: ConnectionQuery;
  calendarSync: SyncMutation;
  openSettings: () => void;
  openDisconnect: () => void;
}) => {
  if (connection.isError || !connection.data) return null;
  if (!connection.data.connected) return <DisconnectedContent />;
  return (
    <ConnectedContent
      connection={connection}
      calendarSync={calendarSync}
      openSettings={openSettings}
      openDisconnect={openDisconnect}
    />
  );
};

const refreshCalendarSettings = async (connection: ConnectionQuery) => {
  const result = await connection.refetch();
  if (result.isError) throw result.error;
  return result.data?.settings ?? null;
};

const ConnectionOverlays = ({
  connection,
  disconnect,
  disconnectOpen,
  settingsOpen,
  closeDisconnect,
  confirmDisconnect,
  closeSettings,
}: {
  connection: ConnectionQuery;
  disconnect: DisconnectMutation;
  disconnectOpen: boolean;
  settingsOpen: boolean;
  closeDisconnect: () => void;
  confirmDisconnect: () => void;
  closeSettings: () => void;
}) => {
  const { t } = useTranslation(['study']);
  return (
    <>
      <ConfirmModal
        isOpen={disconnectOpen}
        title={t('time.calendarConnection.disconnectTitle')}
        message={t('time.calendarConnection.disconnectMessage')}
        confirmLabel={t('time.calendarConnection.disconnect')}
        cancelLabel={t('time.edit.cancel')}
        isLoading={disconnect.isPending}
        onCancel={closeDisconnect}
        onConfirm={confirmDisconnect}
      >
        {disconnect.isError ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {t('time.calendarConnection.disconnectError')}
          </p>
        ) : null}
      </ConfirmModal>
      {settingsOpen ? (
        <GoogleCalendarSettingsDialog
          settings={connection.data?.settings ?? null}
          refreshSettings={() => refreshCalendarSettings(connection)}
          onClose={closeSettings}
        />
      ) : null}
    </>
  );
};

const GoogleCalendarConnectionCard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callbackResult] = useState(() => ({
    state: searchParams.get('calendarConnection'),
    reason: searchParams.get('reason'),
  }));
  const connection = useGoogleCalendarConnection();
  const disconnect = useDisconnectGoogleCalendar();
  const calendarSync = useSyncGoogleCalendar();

  useEffect(() => {
    if (callbackResult.state !== 'connected' && callbackResult.state !== 'error') return;
    connection.refetch().catch(() => undefined);
    const cleanParams = new URLSearchParams(searchParams);
    cleanParams.delete('calendarConnection');
    cleanParams.delete('reason');
    setSearchParams(cleanParams, { replace: true });
    // This effect handles only the callback parameters present on mount/navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackResult.state, callbackResult.reason]);

  const confirmDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => {
        disconnect.reset();
        setDisconnectOpen(false);
      },
    });
  };
  const closeDisconnect = () => {
    disconnect.reset();
    setDisconnectOpen(false);
  };

  return (
    <section
      className="retro-paper-panel overflow-hidden"
      aria-labelledby="calendar-connection-title"
    >
      <ConnectionHeader />
      <div className="space-y-5 p-6">
        <CallbackNotice state={callbackResult.state} reason={callbackResult.reason} />
        <ConnectionQueryStatus connection={connection} />
        <ConnectionContent
          connection={connection}
          calendarSync={calendarSync}
          openSettings={() => setSettingsOpen(true)}
          openDisconnect={() => setDisconnectOpen(true)}
        />
      </div>
      <ConnectionOverlays
        connection={connection}
        disconnect={disconnect}
        disconnectOpen={disconnectOpen}
        settingsOpen={settingsOpen}
        closeDisconnect={closeDisconnect}
        confirmDisconnect={confirmDisconnect}
        closeSettings={() => setSettingsOpen(false)}
      />
    </section>
  );
};

export default GoogleCalendarConnectionCard;
