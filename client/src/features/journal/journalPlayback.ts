export default function focusJournalAudio(active: HTMLAudioElement) {
  document.querySelectorAll<HTMLAudioElement>('audio[data-journal-audio]').forEach((player) => {
    if (player !== active) player.pause();
  });
}
