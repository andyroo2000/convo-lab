import { fireEvent, render, screen } from '@testing-library/react';
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
});
