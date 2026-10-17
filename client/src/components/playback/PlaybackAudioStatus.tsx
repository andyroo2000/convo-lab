import AudioPlayer from '../AudioPlayer';

interface PlaybackAudioStatusProps {
  audioRef: (element: HTMLAudioElement | null) => void;
  currentAudioUrl?: string;
}

const PlaybackAudioStatus = ({ audioRef, currentAudioUrl }: PlaybackAudioStatusProps) => (
  <div className="retro-paper-panel border-x-2 border-b-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.9)] px-4 sm:px-5 py-3">
    {currentAudioUrl ? (
      <AudioPlayer src={currentAudioUrl} audioRef={audioRef} key={currentAudioUrl} />
    ) : (
      <p className="text-sm text-gray-600">No saved audio is available for this dialogue.</p>
    )}
  </div>
);

export default PlaybackAudioStatus;
