import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';
import { fetchStudyCapabilities, useStudyCapabilities } from '../useStudyCapabilities';

const { requestJsonMock } = vi.hoisted(() => ({ requestJsonMock: vi.fn() }));

vi.mock('../../lib/apiClient', () => ({ requestJson: requestJsonMock }));

describe('useStudyCapabilities', () => {
  beforeEach(() => requestJsonMock.mockReset());

  it('fetches and decodes the canonical Study capability document', async () => {
    requestJsonMock.mockResolvedValue(studyCapabilitiesFixture);

    await expect(fetchStudyCapabilities()).resolves.toEqual(studyCapabilitiesFixture);
    expect(requestJsonMock).toHaveBeenCalledWith('/api/study/capabilities');
  });

  it('shares the authenticated capability document through React Query', async () => {
    requestJsonMock.mockResolvedValue(studyCapabilitiesFixture);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useStudyCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(studyCapabilitiesFixture));
    expect(requestJsonMock).toHaveBeenCalledTimes(1);
  });
});
