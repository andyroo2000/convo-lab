import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DialogueExchange,
  LineRendering,
  PipelineStage,
  PromptMetadata,
  ScriptConfig,
  ScriptUnit,
} from '../components/courses/adminScriptWorkbenchTypes';
import { adminApi } from '../lib/adminApi';
import { courseApi } from '../lib/courseApi';

export default function useAdminScriptWorkbench(courseId: string, readOnly: boolean) {
  const currentCourseId = useRef(courseId);
  currentCourseId.current = courseId;
  const [activeStep, setActiveStep] = useState<PipelineStage>('prompt');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [promptMetadata, setPromptMetadata] = useState<PromptMetadata | null>(null);
  const [exchanges, setExchanges] = useState<DialogueExchange[] | null>(null);
  const [editingExchange, setEditingExchange] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DialogueExchange | null>(null);
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig | null>(null);
  const [scriptUnits, setScriptUnits] = useState<ScriptUnit[] | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);
  const [lineRenderings, setLineRenderings] = useState<LineRendering[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [courseStatus, setCourseStatus] = useState('draft');
  const [audioPolling, setAudioPolling] = useState(false);
  const isCurrentCourse = useCallback(() => currentCourseId.current === courseId, [courseId]);

  const handleBuildPrompt = useCallback(
    async (silent = false) => {
      if (!silent) setLoading('Building prompt...');
      setError(null);
      try {
        const response = await fetch(adminApi.adminCourseOperation(courseId, 'build-prompt'), {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to build prompt');
        }
        const data = await response.json();
        if (!isCurrentCourse()) return;
        setPrompt(data.prompt);
        setPromptMetadata(data.metadata);
      } catch (caught) {
        if (!silent && isCurrentCourse()) {
          setError(caught instanceof Error ? caught.message : 'Failed to build prompt');
        }
      } finally {
        if (!silent && isCurrentCourse()) setLoading(null);
      }
    },
    [courseId, isCurrentCourse]
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const isActive = () => !cancelled && currentCourseId.current === courseId;

    setActiveStep('prompt');
    setLoading(null);
    setError(null);
    setPrompt('');
    setPromptMetadata(null);
    setExchanges(null);
    setEditingExchange(null);
    setEditForm(null);
    setScriptConfig(null);
    setScriptUnits(null);
    setEstimatedDuration(null);
    setSelectedUnitIndex(null);
    setLineRenderings([]);
    setAudioUrl(null);
    setCourseStatus('draft');
    setAudioPolling(false);

    const loadPipelineData = async () => {
      try {
        const response = await fetch(adminApi.adminCourseOperation(courseId, 'pipeline-data'), {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!isActive()) return;

        setCourseStatus(data.status);
        setAudioUrl(data.audioUrl);
        if (data.stage === 'script' && data.scriptUnits) {
          setScriptUnits(data.scriptUnits);
          setExchanges(data.exchanges);
          setEstimatedDuration(data.approxDurationSeconds);
          if (data.scriptConfig) setScriptConfig(data.scriptConfig);
          setActiveStep(data.audioUrl ? 'audio' : 'script');
        } else if (data.stage === 'exchanges' && data.exchanges) {
          setExchanges(data.exchanges);
          setActiveStep('exchanges');
        }

        if (!readOnly) await handleBuildPrompt(true);
        if (!isActive()) return;

        const renderingsResponse = await fetch(
          adminApi.adminCourseOperation(courseId, 'line-renderings'),
          { credentials: 'include', signal: controller.signal }
        );
        if (!renderingsResponse.ok) return;
        const renderingsData = await renderingsResponse.json();
        if (isActive()) setLineRenderings(renderingsData.renderings || []);
      } catch {
        // Existing pipeline data and renderings are optional; start fresh on failure.
      }
    };

    loadPipelineData().catch(() => undefined);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [courseId, handleBuildPrompt, readOnly]);

  useEffect(() => {
    if (!audioPolling) return undefined;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(courseApi.operation(courseId, 'status'), {
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled || !isCurrentCourse()) return;
        setCourseStatus(data.status);
        if (data.status === 'ready' && data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setAudioPolling(false);
        } else if (data.status === 'error') {
          setError('Audio generation failed');
          setAudioPolling(false);
        }
      } catch {
        // Ignore polling errors and retry on the next interval.
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [audioPolling, courseId, isCurrentCourse]);

  const handleGenerateDialogue = async () => {
    setLoading('Generating dialogue (this may take 30-60s)...');
    setError(null);
    try {
      const response = await fetch(adminApi.adminCourseOperation(courseId, 'generate-dialogue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customPrompt: prompt }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate dialogue');
      }
      const data = await response.json();
      if (!isCurrentCourse()) return;
      setExchanges(data.exchanges);
      setScriptUnits(null);
      setAudioUrl(null);
      setActiveStep('exchanges');
    } catch (caught) {
      if (isCurrentCourse()) {
        setError(caught instanceof Error ? caught.message : 'Failed to generate dialogue');
      }
    } finally {
      if (isCurrentCourse()) setLoading(null);
    }
  };

  const handleBuildScriptConfig = useCallback(
    async (silent = false) => {
      if (!silent) setLoading('Building script configuration...');
      setError(null);
      try {
        const response = await fetch(
          adminApi.adminCourseOperation(courseId, 'build-script-config'),
          { method: 'POST', credentials: 'include' }
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to build script config');
        }
        const data = await response.json();
        if (isCurrentCourse()) setScriptConfig(data.config);
      } catch (caught) {
        if (!silent && isCurrentCourse()) {
          setError(caught instanceof Error ? caught.message : 'Failed to build script config');
        }
      } finally {
        if (!silent && isCurrentCourse()) setLoading(null);
      }
    },
    [courseId, isCurrentCourse]
  );

  const handleGenerateScript = async () => {
    setLoading('Generating script (this may take 30-60s)...');
    setError(null);
    try {
      const response = await fetch(adminApi.adminCourseOperation(courseId, 'generate-script'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate script');
      }
      const data = await response.json();
      if (!isCurrentCourse()) return;
      setScriptUnits(data.scriptUnits);
      setEstimatedDuration(data.estimatedDurationSeconds);
      setAudioUrl(null);
      setActiveStep('script');
    } catch (caught) {
      if (isCurrentCourse()) {
        setError(caught instanceof Error ? caught.message : 'Failed to generate script');
      }
    } finally {
      if (isCurrentCourse()) setLoading(null);
    }
  };

  const handleGenerateAudio = async () => {
    setLoading('Queuing audio generation...');
    setError(null);
    try {
      const response = await fetch(adminApi.adminCourseOperation(courseId, 'generate-audio'), {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start audio generation');
      }
      if (!isCurrentCourse()) return;
      setCourseStatus('generating');
      setAudioPolling(true);
      setActiveStep('audio');
    } catch (caught) {
      if (isCurrentCourse()) {
        setError(caught instanceof Error ? caught.message : 'Failed to start audio generation');
      }
    } finally {
      if (isCurrentCourse()) setLoading(null);
    }
  };

  const handleSaveExchangeEdit = async () => {
    if (editingExchange === null || !editForm || !exchanges) return;
    const updatedExchanges = [...exchanges];
    updatedExchanges[editingExchange] = editForm;
    setExchanges(updatedExchanges);
    setEditingExchange(null);
    setEditForm(null);
    try {
      await fetch(adminApi.adminCourseOperation(courseId, 'pipeline-data'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage: 'exchanges', data: updatedExchanges }),
      });
    } catch {
      if (isCurrentCourse()) setError('Failed to save exchange edit');
    }
  };

  const openExchangeEditor = (index: number, exchange: DialogueExchange) => {
    setEditingExchange(index);
    setEditForm({ ...exchange, vocabularyItems: [...exchange.vocabularyItems] });
  };

  return {
    activeStep,
    audioUrl,
    courseStatus,
    editForm,
    editingExchange,
    error,
    estimatedDuration,
    exchanges,
    handleBuildPrompt,
    handleBuildScriptConfig,
    handleGenerateAudio,
    handleGenerateDialogue,
    handleGenerateScript,
    handleSaveExchangeEdit,
    lineRenderings,
    loading,
    openExchangeEditor,
    prompt,
    promptMetadata,
    scriptConfig,
    scriptUnits,
    selectedUnitIndex,
    setActiveStep,
    setEditForm,
    setEditingExchange,
    setLineRenderings,
    setPrompt,
    setScriptConfig,
    setSelectedUnitIndex,
  };
}
