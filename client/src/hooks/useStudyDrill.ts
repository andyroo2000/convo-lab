import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import playableDrill from '../utils/playableDrill';
import {
  dailyAudioPracticeKeys,
  useRecentDailyAudioPractice,
  useDailyAudioPractice,
  useCreateDailyAudioPractice,
  useDailyAudioPracticeStatus,
} from './useDailyAudioPractice';
import { useStudyCapabilities } from './useStudyCapabilities';
import type { DailyAudioPractice } from '../types';

const expiry = 90 * 60 * 1000;
function todayDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function useActiveGeneration(practice?: DailyAudioPractice) {
  const until = practice?.status === 'generating' ? Date.parse(practice.updatedAt) + expiry : 0;
  const [clock, setClock] = useState(Date.now);
  const remaining = until - Math.max(clock, Date.now());
  const active = remaining > 0;
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setClock(Date.now()), remaining + 1);
    return () => window.clearTimeout(timer);
  }, [active, remaining]);
  return active;
}
function useCompletedDrill(today: DailyAudioPractice | undefined, terminal?: string) {
  const client = useQueryClient();
  const finished = terminal === 'ready' || terminal === 'error';
  useEffect(() => {
    if (!finished) return;
    if (today?.status !== 'generating') return;
    client.invalidateQueries({ queryKey: dailyAudioPracticeKeys.detail(today.id) });
    client.invalidateQueries({ queryKey: dailyAudioPracticeKeys.list() });
  }, [client, today, finished]);
}
export default function useStudyDrill() {
  const client = useQueryClient();
  const recent = useRecentDailyAudioPractice();
  const capabilities = useStudyCapabilities();
  const create = useCreateDailyAudioPractice();
  const practices = [...(recent.data ?? [])].sort((a, b) =>
    b.practiceDate.localeCompare(a.practiceDate)
  );
  const today = practices.find((p) => p.practiceDate === todayDate());
  const recordings = practices.filter(playableDrill);
  const [preferred, setPreferred] = useState<string>();
  const latest = recordings.find((p) => p.id === preferred) ?? recordings[0];
  const detail = useDailyAudioPractice(latest?.id);
  const recording = detail.data ?? latest;
  const active = useActiveGeneration(today);
  const status = useDailyAudioPracticeStatus(today?.id, active);
  useCompletedDrill(today, status.data?.status);
  const generate = async (minutes: number) => {
    const practice = await create.mutateAsync(minutes);
    setPreferred(undefined);
    client.removeQueries({ queryKey: dailyAudioPracticeKeys.status(practice.id), exact: true });
    client.setQueryData<DailyAudioPractice[]>(dailyAudioPracticeKeys.list(), (old) => [
      practice,
      ...(old ?? []).filter((p) => p.id !== practice.id),
    ]);
  };
  return {
    recent,
    capabilities,
    create,
    recording,
    recordings,
    setPreferred,
    detail,
    generate,
    active,
    today,
    progress: status.data?.progress,
  };
}
