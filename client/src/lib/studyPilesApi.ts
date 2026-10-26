import { requestJson } from './apiClient';
import { studyApiPath } from './studyApi';

export interface StudyPileCounts {
  new_count: number;
  ready_count: number;
  introduced_count: number;
}
export interface StudyPileChapter extends StudyPileCounts {
  id: string;
  title: string;
  position: number;
  is_active: boolean;
  source_reference: string | null;
}
export interface StudyPile extends StudyPileChapter {
  chapters: StudyPileChapter[];
}
export interface StudyPileCatalog {
  piles: StudyPile[];
  uncategorized: StudyPileCounts;
  learn_soon: StudyPileCounts;
}
interface StudyPilePage extends StudyPileCatalog {
  next_cursor: number | null;
}
export type StudyPileAttributes = Partial<
  Pick<StudyPileChapter, 'title' | 'position' | 'is_active' | 'source_reference'>
>;

export async function getStudyPiles(): Promise<StudyPileCatalog> {
  const piles: StudyPile[] = [];
  let cursor = 0;
  for (;;) {
    // Each cursor depends on the preceding page.
    // eslint-disable-next-line no-await-in-loop
    const page = await requestJson<StudyPilePage>(
      studyApiPath(`/piles?limit=100&cursor=${cursor}`)
    );
    piles.push(...page.piles);
    if (page.next_cursor === null) return { ...page, piles };
    if (page.next_cursor <= cursor) throw new Error('Invalid pile pagination.');
    cursor = page.next_cursor;
  }
}
export function saveStudyPile(id: string, attributes: StudyPileAttributes, pileId?: string) {
  const path = pileId
    ? `/piles/${encodeURIComponent(pileId)}/chapters/${encodeURIComponent(id)}`
    : `/piles/${encodeURIComponent(id)}`;
  return requestJson(studyApiPath(path), { method: 'PUT', body: JSON.stringify(attributes) });
}
