import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('restores the exchange and reports the API error when saving fails', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/courses/course-a/pipeline-data') && init?.method === 'PUT') {
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'Exchange could not be saved' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/courses/course-a/pipeline-data')) {
        return Promise.resolve(exchangeResponse('Original'));
      }
      if (url.includes('/courses/course-a/build-prompt')) {
        return Promise.resolve(
          new Response(JSON.stringify({ prompt: 'Prompt', metadata: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
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

    render(<AdminScriptWorkbench courseId="course-a" />);

    fireEvent.click(await screen.findByText('Original dialogue'));
    fireEvent.change(screen.getByLabelText('Text (L2)'), {
      target: { value: 'Edited dialogue' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Exchange could not be saved')).toBeInTheDocument();
    });
    expect(screen.getByText('Original dialogue')).toBeInTheDocument();
    expect(screen.queryByText('Edited dialogue')).not.toBeInTheDocument();
  });
});
