import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PracticePage from '../PracticePage';

const getEpisode = vi.fn();

vi.mock('../../hooks/useEpisodes', () => ({
  useEpisodes: () => ({ getEpisode }),
}));

const episode = {
  id: 'episode-1',
  userId: 'user-1',
  title: 'At the station',
  sourceText: '',
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  status: 'ready',
  createdAt: new Date(),
  updatedAt: new Date(),
  dialogue: {
    id: 'dialogue-1',
    episodeId: 'episode-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    speakers: [
      {
        id: 'speaker-1',
        name: 'Aki',
        voiceId: 'voice-1',
        proficiency: 'N5',
        tone: 'casual',
      },
    ],
    sentences: [
      {
        id: 'line-1',
        dialogueId: 'dialogue-1',
        speakerId: 'speaker-1',
        order: 0,
        text: '駅はどこですか。',
        translation: 'Where is the station?',
        metadata: {
          japanese: { kanji: '駅はどこですか。', kana: 'えきはどこですか。', furigana: '' },
        },
        variations: [],
        selected: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'line-2',
        dialogueId: 'dialogue-1',
        speakerId: 'speaker-1',
        order: 1,
        text: 'あそこです。',
        translation: 'It is over there.',
        metadata: {},
        variations: [],
        selected: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/app/practice/episode-1']}>
      <Routes>
        <Route path="/app/practice/:episodeId" element={<PracticePage />} />
      </Routes>
    </MemoryRouter>
  );

describe('PracticePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    getEpisode.mockReset();
    getEpisode.mockResolvedValue(episode);
  });

  it('loads the selected episode and reveals translations on demand', async () => {
    renderPage();

    expect(await screen.findByText('駅はどこですか。')).toBeInTheDocument();
    expect(getEpisode).toHaveBeenCalledWith('episode-1');
    expect(screen.queryByText('Where is the station?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show meaning' }));

    expect(screen.getByText('Where is the station?')).toBeInTheDocument();
  });

  it('moves line by line and resets the revealed meaning', async () => {
    renderPage();
    await screen.findByText('駅はどこですか。');
    fireEvent.click(screen.getByRole('button', { name: 'Show meaning' }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));

    expect(await screen.findByText('あそこです。')).toBeInTheDocument();
    expect(screen.queryByText('It is over there.')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('pairs full-episode audio with matching timing and stops it on navigation', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    getEpisode.mockResolvedValue({
      ...episode,
      audioUrl_1_0: '/audio/episode-normal.mp3',
      dialogue: {
        ...episode.dialogue,
        sentences: episode.dialogue.sentences.map((sentence, index) =>
          index === 0
            ? {
                ...sentence,
                startTime_0_85: 900,
                endTime_0_85: 1900,
                startTime_1_0: 2000,
                endTime_1_0: 3500,
              }
            : sentence
        ),
      },
    });
    renderPage();
    await screen.findByText('駅はどこですか。');

    fireEvent.click(screen.getByRole('button', { name: 'Hear line' }));

    const playback = screen.getByTestId('practice-source-audio') as HTMLAudioElement;
    expect(playback.src).toBe('http://localhost:3000/audio/episode-normal.mp3');
    expect(playback.currentTime).toBe(2);
    expect(play).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(pause).toHaveBeenCalled();
  });

  it('records and stops a local practice take', async () => {
    const trackStop = vi.fn();
    const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const recorderStart = vi.fn();
    const recorderStop = vi.fn();
    class FakeMediaRecorder {
      readonly stream = stream;

      readonly mimeType = 'audio/webm';

      private started = false;

      private listeners = new Map<string, EventListener>();

      addEventListener(type: string, listener: EventListener): void {
        this.listeners.set(type, listener);
      }

      start(): void {
        this.started = true;
        recorderStart();
      }

      stop(): void {
        expect(this.started).toBe(true);
        recorderStop();
        this.listeners.get('stop')?.(new Event('stop'));
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:practice-take'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    renderPage();
    await screen.findByText('駅はどこですか。');
    fireEvent.click(screen.getByRole('button', { name: 'Record myself' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeVisible()
    );
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recorderStart).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(recorderStop).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Your take')).toBeVisible());
    expect(trackStop).toHaveBeenCalled();
  });
});
