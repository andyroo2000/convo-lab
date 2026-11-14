let latest = 0;
export function claimJournalAudio() {
  latest += 1;
  document
    .querySelectorAll<HTMLAudioElement>('audio[data-journal-audio]')
    .forEach((audio) => audio.pause());
  return latest;
}
export const isCurrentJournalAudio = (intent: number) => intent === latest;
