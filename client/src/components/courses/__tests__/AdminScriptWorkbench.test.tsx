import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminScriptWorkbench from '../AdminScriptWorkbench';

vi.mock('../LineTTSTester', () => ({ default: () => null }));

function exchangeResponse(name: string) {
  return new Response(
    JSON.stringify({
      status: 'draft',
      audioUrl: null,
      stage: 'exchanges',
      exchanges: [
        {
          order: 0,
          speakerName: name,
          relationshipName: 'friend',
          speakerVoiceId: 'voice-1',
          textL2: `${name} dialogue`,
          readingL2: null,
          translationL1: `${name} translation`,
          vocabularyItems: [],
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('AdminScriptWorkbench', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores pipeline hydration that completes after the course changes', async () => {
    let resolveFirstCourse!: (response: Response) => void;
    const firstCourseResponse = new Promise<Response>((resolve) => {
      resolveFirstCourse = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/courses/course-a/pipeline-data')) return firstCourseResponse;
      if (url.includes('/courses/course-b/pipeline-data')) {
        return Promise.resolve(exchangeResponse('Course B'));
      }
      if (url.includes('/line-renderings')) {
        return Promise.resolve(
          new Response(JSON.stringify({ renderings: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(<AdminScriptWorkbench courseId="course-a" readOnly />);
    rerender(<AdminScriptWorkbench courseId="course-b" readOnly />);

    expect(await screen.findByText('Course B dialogue')).toBeInTheDocument();

    await act(async () => {
      resolveFirstCourse(exchangeResponse('Course A'));
      await firstCourseResponse;
    });

    expect(screen.getByText('Course B dialogue')).toBeInTheDocument();
    expect(screen.queryByText('Course A dialogue')).not.toBeInTheDocument();
  });
});
