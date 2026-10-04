export interface ReadingSummary {
  id: string;
  title: string;
  author: string;
  pageCount: number;
}

export interface ReadingSentence {
  text: string;
  translation: string;
}

export type ReadingSegment = [number, string];

export interface ReadingPage {
  number: number;
  kind: 'title' | 'text' | 'illustration';
  columns: ReadingSegment[][];
  notes?: ReadingSegment[];
  notesLeft?: number;
  biography?: ReadingSegment;
  source?: string;
  imageUrl?: string;
  imageAspectRatio?: number;
  imageCrop?: { left: number; top: number; width: number; height: number };
}

export interface ReadingDocument {
  title: string;
  author: string;
  authorReading?: string;
  illustrator?: string;
  category?: string;
  tagline?: string;
  pages: ReadingPage[];
  sentences: ReadingSentence[];
}

export interface ReadingDetail extends ReadingSummary {
  document: ReadingDocument;
  illustrationUrl: string | null;
  voiceName: string;
}
