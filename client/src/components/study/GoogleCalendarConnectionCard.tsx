import { useEffect, useState } from 'react';
import { CalendarCheck2, CalendarDays, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../common/ConfirmModal';
import {
  googleCalendarConnectPath,
  useDisconnectGoogleCalendar,
  useGoogleCalendarConnection,
} from '../../hooks/useGoogleCalendarConnection';

const CALLBACK_ERRORS = new Set([
  'access_denied',
  'account_conflict',
  'invalid_state',
  'missing_refresh_token',
  'missing_token',
]);

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

const GoogleCalendarConnectionCard = () => {
  const { t } = useTranslation(['study']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [callbackResult] = useState(() => ({
    state: searchParams.get('calendarConnection'),
    reason: searchParams.get('reason'),
  }));
  const connection = useGoogleCalendarConnection();
  const disconnect = useDisconnectGoogleCalendar();
  const callbackState = callbackResult.state;
  const callbackReason = callbackResult.reason;
  const safeReason =
    callbackReason && CALLBACK_ERRORS.has(callbackReason) ? callbackReason : 'unknown';

  useEffect(() => {
    if (callbackState !== 'connected' && callbackState !== 'error') return;

    connection.refetch().catch(() => undefined);
    const cleanParams = new URLSearchParams(searchParams);
    cleanParams.delete('calendarConnection');
    cleanParams.delete('reason');
    setSearchParams(cleanParams, { replace: true });
    // This effect handles only the callback parameters present on mount/navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackState, callbackReason]);

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

      <div className="space-y-5 p-6">
        {callbackState === 'connected' ? (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {t('time.calendarConnection.connectedSuccess')}
          </p>
        ) : null}
        {callbackState === 'error' ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {t(`time.calendarConnection.errors.${safeReason}`)}
          </p>
        ) : null}

        {connection.isLoading ? (
          <div role="status" className="flex items-center gap-3 text-gray-600">
            <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
            {t('time.calendarConnection.loading')}
          </div>
        ) : null}

        {connection.isError ? (
          <div className="space-y-3">
            <p role="alert" className="text-red-700">
              {t('time.calendarConnection.loadError')}
            </p>
            <button type="button" className="btn-outline" onClick={() => connection.refetch()}>
              {t('time.calendarConnection.retry')}
            </button>
          </div>
        ) : null}

        {!connection.isError && connection.data && !connection.data.connected ? (
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
        ) : null}

        {!connection.isError && connection.data?.connected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">
                <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
                {t('time.calendarConnection.connected')}
              </span>
              <span className="break-all font-bold text-navy">
                {connection.data.accountEmail || t('time.calendarConnection.accountUnavailable')}
              </span>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
                <dt className="retro-caps text-gray-500">
                  {t('time.calendarConnection.lastSync')}
                </dt>
                <dd className="mt-1 text-sm font-bold text-navy">
                  {formatLastSync(
                    connection.data.lastSyncedAt,
                    t('time.calendarConnection.notSynced')
                  )}
                </dd>
              </div>
              <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
                <dt className="retro-caps text-gray-500">{t('time.calendarConnection.access')}</dt>
                <dd className="mt-1 flex items-start gap-2 text-sm font-bold text-navy">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  {connection.data.scopes.length > 0
                    ? [
                        ...new Set(connection.data.scopes.map((scope) => scopeLabel(scope, t))),
                      ].join(t('time.calendarConnection.scopeSeparator'))
                    : t('time.calendarConnection.scopeUnavailable')}
                </dd>
              </div>
            </dl>

            <button type="button" className="btn-outline" onClick={() => setDisconnectOpen(true)}>
              {t('time.calendarConnection.disconnect')}
            </button>
          </div>
        ) : null}
      </div>

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
    </section>
  );
};

export default GoogleCalendarConnectionCard;
