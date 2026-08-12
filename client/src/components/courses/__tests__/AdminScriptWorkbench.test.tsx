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

function editableCourseFetch(putResponse: Response | Promise<Response>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/courses/course-a/pipeline-data') && init?.method === 'PUT') {
      return Promise.resolve(putResponse);
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
}

describe('AdminScriptWorkbench', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not overlap slow audio status polls', async () => {
    let resolveStatus!: (response: Response) => void;
    const statusResponse = new Promise<Response>((resolve) => {
      resolveStatus = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/courses/course-a/pipeline-data')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'draft',
              audioUrl: null,
              stage: 'script',
              scriptUnits: [],
              exchanges: [],
              approxDurationSeconds: 0,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
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
      if (url.includes('/courses/course-a/generate-audio')) {
        return Promise.resolve(new Response(null, { status: 202 }));
      }
      if (url.includes('/courses/course-a/status')) return statusResponse;
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    let pollStatus: (() => Promise<void>) | undefined;
    const realSetInterval = window.setInterval.bind(window);
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay, ...args) => {
      if (delay === 3000) {
        pollStatus = callback as () => Promise<void>;
        return 1 as unknown as NodeJS.Timeout;
      }
      return realSetInterval(callback, delay, ...args) as unknown as NodeJS.Timeout;
    });

    const { unmount } = render(<AdminScriptWorkbench courseId="course-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate Audio' }));
    await waitFor(() => expect(pollStatus).toBeDefined());

    let firstPoll: Promise<void> | undefined;
    await act(async () => {
      firstPoll = pollStatus?.();
      pollStatus?.();
      await Promise.resolve();
    });

    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/status'))
    ).toHaveLength(1);
    const statusRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/status'));
    const statusSignal = statusRequest?.[1]?.signal;
    expect(statusSignal?.aborted).toBe(false);

    unmount();

    expect(statusSignal?.aborted).toBe(true);

    resolveStatus(
      new Response(JSON.stringify({ status: 'generating', audioUrl: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await act(async () => firstPoll);
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

  it('serializes exchange saves and keeps the edit available when saving fails', async () => {
    let resolvePut!: (response: Response) => void;
    const putResponse = new Promise<Response>((resolve) => {
      resolvePut = resolve;
    });
    const fetchMock = editableCourseFetch(putResponse);
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminScriptWorkbench courseId="course-a" />);

    fireEvent.click(await screen.findByText('Original dialogue'));
    fireEvent.change(screen.getByLabelText('Text (L2)'), {
      target: { value: 'Edited dialogue' },
    });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    act(() => {
      saveButton.click();
      saveButton.click();
    });

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByDisplayValue('Edited dialogue')).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Add vocabulary item' })).toBeDisabled();
    expect(screen.getByText('Original dialogue')).toBeInTheDocument();

    await act(async () => {
      resolvePut(
        new Response(JSON.stringify({ message: 'Exchange could not be saved' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await putResponse;
    });

    await waitFor(() => {
      expect(screen.getByText('Exchange could not be saved')).toBeInTheDocument();
    });
    expect(screen.getByText('Original dialogue')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edited dialogue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('ignores an exchange save that completes in a later session for the same course', async () => {
    let resolveOldSave!: (response: Response) => void;
    const oldSaveResponse = new Promise<Response>((resolve) => {
      resolveOldSave = resolve;
    });
    let courseALoads = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/courses/course-a/pipeline-data') && init?.method === 'PUT') {
        return oldSaveResponse;
      }
      if (url.includes('/courses/course-a/pipeline-data')) {
        courseALoads += 1;
        return Promise.resolve(exchangeResponse(courseALoads === 1 ? 'Original' : 'Current A'));
      }
      if (url.includes('/courses/course-b/pipeline-data')) {
        return Promise.resolve(exchangeResponse('Course B'));
      }
      if (url.includes('/build-prompt')) {
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

    const { rerender } = render(<AdminScriptWorkbench courseId="course-a" />);

    fireEvent.click(await screen.findByText('Original dialogue'));
    fireEvent.change(screen.getByLabelText('Text (L2)'), {
      target: { value: 'Stale edited dialogue' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    rerender(<AdminScriptWorkbench courseId="course-b" />);
    expect(await screen.findByText('Course B dialogue')).toBeInTheDocument();
    rerender(<AdminScriptWorkbench courseId="course-a" />);
    expect(await screen.findByText('Current A dialogue')).toBeInTheDocument();

    await act(async () => {
      resolveOldSave(new Response(null, { status: 204 }));
      await oldSaveResponse;
    });

    expect(screen.getByText('Current A dialogue')).toBeInTheDocument();
    expect(screen.queryByText('Stale edited dialogue')).not.toBeInTheDocument();
  });

  it('stays on dialogue when building script configuration fails', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/courses/course-a/build-script-config')) {
        return Promise.resolve(
          new Response('<html>Bad gateway</html>', {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
          })
        );
      }
      if (url.includes('/courses/course-a/pipeline-data') && init?.method !== 'PUT') {
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

    fireEvent.click(await screen.findByRole('button', { name: 'Configure Script' }));

    expect(await screen.findByText('Failed to build script config')).toBeInTheDocument();
    expect(screen.getByText('Original dialogue')).toBeInTheDocument();
  });

  it('shows a fallback when dialogue generation returns a blank message', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/courses/course-a/pipeline-data')) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: 'draft', audioUrl: null, stage: 'prompt' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/courses/course-a/build-prompt')) {
        return Promise.resolve(
          new Response(JSON.stringify({ prompt: 'Prompt', metadata: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/courses/course-a/generate-dialogue')) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: '   ' }), {
            status: 500,
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

    await screen.findByDisplayValue('Prompt');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Dialogue' }));

    expect(await screen.findByText('Failed to generate dialogue')).toBeInTheDocument();
  });

  it('does not navigate the next course when an old config request completes', async () => {
    let resolveOldConfig!: (response: Response) => void;
    const oldConfigResponse = new Promise<Response>((resolve) => {
      resolveOldConfig = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/courses/course-a/build-script-config')) return oldConfigResponse;
      if (url.includes('/courses/course-a/pipeline-data')) {
        return Promise.resolve(exchangeResponse('Course A'));
      }
      if (url.includes('/courses/course-b/pipeline-data')) {
        return Promise.resolve(exchangeResponse('Course B'));
      }
      if (url.includes('/build-prompt')) {
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

    const { rerender } = render(<AdminScriptWorkbench courseId="course-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Script' }));

    rerender(<AdminScriptWorkbench courseId="course-b" />);
    expect(await screen.findByText('Course B dialogue')).toBeInTheDocument();

    await act(async () => {
      resolveOldConfig(
        new Response(JSON.stringify({ config: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await oldConfigResponse;
    });

    expect(screen.getByText('Course B dialogue')).toBeInTheDocument();
  });

  it('shows a fallback error when the API message is empty', async () => {
    vi.stubGlobal(
      'fetch',
      editableCourseFetch(
        new Response(JSON.stringify({ message: '   ' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    render(<AdminScriptWorkbench courseId="course-a" />);

    fireEvent.click(await screen.findByText('Original dialogue'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to save exchange edit')).toBeInTheDocument();
  });
});
