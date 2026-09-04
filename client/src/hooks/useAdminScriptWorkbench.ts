import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DialogueExchange,
  LineRendering,
  PipelineStage,
  PromptMetadata,
  ScriptConfig,
  ScriptUnit,
} from '../components/courses/adminScriptWorkbenchTypes';
import getAdminScriptErrorMessage from '../components/courses/adminScriptWorkbenchErrors';
import { adminApi } from '../lib/adminApi';
import { courseApi } from '../lib/courseApi';

type PipelineData = {
  status: string;
  audioUrl: string | null;
  stage: PipelineStage;
  scriptUnits?: ScriptUnit[];
  exchanges: DialogueExchange[];
  approxDurationSeconds: number;
  scriptConfig?: ScriptConfig;
};

type PipelineSetters = {
  setActiveStep: (stage: PipelineStage) => void;
  setAudioUrl: (url: string | null) => void;
  setCourseStatus: (status: string) => void;
  setEstimatedDuration: (duration: number | null) => void;
  setExchanges: (exchanges: DialogueExchange[] | null) => void;
  setScriptConfig: (config: ScriptConfig | null) => void;
  setScriptUnits: (units: ScriptUnit[] | null) => void;
};

function applyScriptPipeline(data: PipelineData, setters: PipelineSetters) {
  if (data.stage !== 'script' || !data.scriptUnits) return false;
  setters.setScriptUnits(data.scriptUnits);
  setters.setExchanges(data.exchanges);
  setters.setEstimatedDuration(data.approxDurationSeconds);
  if (data.scriptConfig) setters.setScriptConfig(data.scriptConfig);
  setters.setActiveStep(data.audioUrl ? 'audio' : 'script');
  return true;
}

function applyExchangePipeline(data: PipelineData, setters: PipelineSetters) {
  if (data.stage !== 'exchanges' || !data.exchanges) return;
  setters.setExchanges(data.exchanges);
  setters.setActiveStep('exchanges');
}

function applyPipelineData(data: PipelineData, setters: PipelineSetters) {
  setters.setCourseStatus(data.status);
  setters.setAudioUrl(data.audioUrl);
  if (!applyScriptPipeline(data, setters)) applyExchangePipeline(data, setters);
}

async function fetchPipelineData(courseId: string, signal: AbortSignal) {
  const response = await fetch(adminApi.adminCourseOperation(courseId, 'pipeline-data'), {
    credentials: 'include',
    signal,
  });
  if (!response.ok) return null;
  return (await response.json()) as PipelineData;
}

async function fetchLineRenderings(courseId: string, signal: AbortSignal) {
  const response = await fetch(adminApi.adminCourseOperation(courseId, 'line-renderings'), {
    credentials: 'include',
    signal,
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { renderings?: LineRendering[] };
  return data.renderings ?? [];
}

type GenerationOptions<T> = {
  courseId: string;
  operation: 'generate-dialogue' | 'generate-script';
  body?: string;
  fallbackError: string;
  isCurrentCourse: () => boolean;
  onSuccess: (data: T) => void;
  setError: (error: string | null) => void;
  setLoading: (message: string | null) => void;
};

async function runGeneration<T>(options: GenerationOptions<T>) {
  try {
    const response = await fetch(
      adminApi.adminCourseOperation(options.courseId, options.operation),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: options.body,
      }
    );
    if (!response.ok) {
      throw new Error(await getAdminScriptErrorMessage(response, options.fallbackError));
    }
    const data = (await response.json()) as T;
    if (options.isCurrentCourse()) options.onSuccess(data);
  } catch (caught) {
    if (options.isCurrentCourse()) {
      options.setError(caught instanceof Error ? caught.message : options.fallbackError);
    }
  } finally {
    if (options.isCurrentCourse()) options.setLoading(null);
  }
}

function updatedExchangesForEdit(
  editingExchange: number | null,
  editForm: DialogueExchange | null,
  exchanges: DialogueExchange[] | null
) {
  if (editingExchange === null) return null;
  if (!editForm) return null;
  if (!exchanges) return null;
  const updatedExchanges = [...exchanges];
  updatedExchanges[editingExchange] = editForm;
  return updatedExchanges;
}

type SaveExchangeOptions = {
  courseId: string;
  updatedExchanges: DialogueExchange[];
  isCurrentCourse: () => boolean;
  onSuccess: () => void;
  onFinished: () => void;
  setError: (error: string | null) => void;
};

async function persistExchangeEdit(options: SaveExchangeOptions) {
  try {
    const response = await fetch(adminApi.adminCourseOperation(options.courseId, 'pipeline-data'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stage: 'exchanges', data: options.updatedExchanges }),
    });
    if (!response.ok) {
      throw new Error(await getAdminScriptErrorMessage(response, 'Failed to save exchange edit'));
    }
    if (options.isCurrentCourse()) options.onSuccess();
  } catch (caught) {
    if (options.isCurrentCourse()) {
      options.setError(caught instanceof Error ? caught.message : 'Failed to save exchange edit');
    }
  } finally {
    if (options.isCurrentCourse()) options.onFinished();
  }
}

export default function useAdminScriptWorkbench(courseId: string, readOnly: boolean) {
  const courseSession = useRef({ courseId, token: Symbol(courseId) });
  const exchangeSaveInFlight = useRef(false);
  if (courseSession.current.courseId !== courseId) {
    courseSession.current = { courseId, token: Symbol(courseId) };
  }
  const courseSessionToken = courseSession.current.token;
  const [activeStep, setActiveStep] = useState<PipelineStage>('prompt');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [promptMetadata, setPromptMetadata] = useState<PromptMetadata | null>(null);
  const [exchanges, setExchanges] = useState<DialogueExchange[] | null>(null);
  const [editingExchange, setEditingExchange] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DialogueExchange | null>(null);
  const [savingExchange, setSavingExchange] = useState(false);
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig | null>(null);
  const [scriptUnits, setScriptUnits] = useState<ScriptUnit[] | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);
  const [lineRenderings, setLineRenderings] = useState<LineRendering[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [courseStatus, setCourseStatus] = useState('draft');
  const [audioPolling, setAudioPolling] = useState(false);
  const isCurrentCourse = useCallback(
    () => courseSession.current.token === courseSessionToken,
    [courseSessionToken]
  );

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
          throw new Error(await getAdminScriptErrorMessage(response, 'Failed to build prompt'));
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
    const isActive = () => !cancelled && isCurrentCourse();

    setActiveStep('prompt');
    setLoading(null);
    setError(null);
    setPrompt('');
    setPromptMetadata(null);
    setExchanges(null);
    setEditingExchange(null);
    setEditForm(null);
    exchangeSaveInFlight.current = false;
    setSavingExchange(false);
    setScriptConfig(null);
    setScriptUnits(null);
    setEstimatedDuration(null);
    setSelectedUnitIndex(null);
    setLineRenderings([]);
    setAudioUrl(null);
    setCourseStatus('draft');
    setAudioPolling(false);

    const loadPipeline = async () => {
      try {
        const data = await fetchPipelineData(courseId, controller.signal);
        if (!data) return;
        if (!isActive()) return;

        applyPipelineData(data, {
          setActiveStep,
          setAudioUrl,
          setCourseStatus,
          setEstimatedDuration,
          setExchanges,
          setScriptConfig,
          setScriptUnits,
        });

        if (!readOnly) await handleBuildPrompt(true);
        if (!isActive()) return;

        const view = await fetchLineRenderings(courseId, controller.signal);
        if (view && isActive()) setLineRenderings(view);
      } catch {
        // Existing pipeline data and renderings are optional; start fresh on failure.
      }
    };

    loadPipeline().catch(() => undefined);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [courseId, handleBuildPrompt, isCurrentCourse, readOnly]);

  useEffect(() => {
    if (!audioPolling) return undefined;
    let cancelled = false;
    let requestInFlight = false;
    const controller = new AbortController();
    const interval = setInterval(async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(courseApi.operation(courseId, 'status'), {
          credentials: 'include',
          signal: controller.signal,
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
      } finally {
        requestInFlight = false;
      }
    }, 3000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [audioPolling, courseId, isCurrentCourse]);

  const handleGenerateDialogue = async () => {
    setLoading('Generating dialogue (this may take 30-60s)...');
    setError(null);
    await runGeneration<{ exchanges: DialogueExchange[] }>({
      courseId,
      operation: 'generate-dialogue',
      body: JSON.stringify({ customPrompt: prompt }),
      fallbackError: 'Failed to generate dialogue',
      isCurrentCourse,
      onSuccess: (data) => {
        setExchanges(data.exchanges);
        setScriptUnits(null);
        setAudioUrl(null);
        setActiveStep('exchanges');
      },
      setError,
      setLoading,
    });
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
          throw new Error(
            await getAdminScriptErrorMessage(response, 'Failed to build script config')
          );
        }
        const data = await response.json();
        if (!isCurrentCourse()) return false;
        setScriptConfig(data.config);
        return true;
      } catch (caught) {
        if (!silent && isCurrentCourse()) {
          setError(caught instanceof Error ? caught.message : 'Failed to build script config');
        }
        return false;
      } finally {
        if (!silent && isCurrentCourse()) setLoading(null);
      }
    },
    [courseId, isCurrentCourse]
  );

  const handleGenerateScript = async () => {
    setLoading('Generating script (this may take 30-60s)...');
    setError(null);
    await runGeneration<{ scriptUnits: ScriptUnit[]; estimatedDurationSeconds: number }>({
      courseId,
      operation: 'generate-script',
      fallbackError: 'Failed to generate script',
      isCurrentCourse,
      onSuccess: (data) => {
        setScriptUnits(data.scriptUnits);
        setEstimatedDuration(data.estimatedDurationSeconds);
        setAudioUrl(null);
        setActiveStep('script');
      },
      setError,
      setLoading,
    });
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
        throw new Error(
          await getAdminScriptErrorMessage(response, 'Failed to start audio generation')
        );
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
    const updatedExchanges = updatedExchangesForEdit(editingExchange, editForm, exchanges);
    if (!updatedExchanges) return;
    if (exchangeSaveInFlight.current) return;
    exchangeSaveInFlight.current = true;
    setSavingExchange(true);
    setError(null);
    await persistExchangeEdit({
      courseId,
      updatedExchanges,
      isCurrentCourse,
      onSuccess: () => {
        setExchanges(updatedExchanges);
        setEditingExchange(null);
        setEditForm(null);
      },
      onFinished: () => {
        exchangeSaveInFlight.current = false;
        setSavingExchange(false);
      },
      setError,
    });
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
    savingExchange,
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
