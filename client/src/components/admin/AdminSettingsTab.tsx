import { useEffect, useRef, useState } from 'react';
import {
  getAdminFeatureFlags,
  getAdminPronunciationDictionary,
  updateAdminFeatureFlag,
  updateAdminPronunciationDictionary,
  type AdminFeatureFlagKey,
  type AdminFeatureFlags,
  type AdminPronunciationDictionary,
  type AdminReadRequestInit,
} from '../../lib/adminApi';

interface AdminSettingsTabProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const formatKeepKanjiText = (keepKanji: string[]) => keepKanji.filter(Boolean).join('\n');

const formatForceKanaText = (forceKana: Record<string, string>) =>
  Object.entries(forceKana)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([word, kana]) => `${word}=${kana}`)
    .join('\n');

const parseKeepKanjiText = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const parseForceKanaText = (text: string) => {
  const entries: Record<string, string> = {};
  const errors: string[] = [];

  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s*[:=]\s*|\t/).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Line ${index + 1}: expected "word=reading"`);
      return;
    }

    const word = parts[0].trim();
    const kana = parts.slice(1).join(' ').trim();
    if (!word || !kana) {
      errors.push(`Line ${index + 1}: missing word or reading`);
      return;
    }

    entries[word] = kana;
  });

  return { entries, errors };
};

const AdminSettingsTab = ({ showToast }: AdminSettingsTabProps) => {
  const [featureFlags, setFeatureFlags] = useState<AdminFeatureFlags | null>(null);
  const [isFeatureFlagsLoading, setIsFeatureFlagsLoading] = useState(false);
  const [featureFlagsError, setFeatureFlagsError] = useState('');
  const [savingFeatureFlags, setSavingFeatureFlags] = useState<ReadonlySet<AdminFeatureFlagKey>>(
    () => new Set()
  );
  const [pronunciationDictionary, setPronunciationDictionary] =
    useState<AdminPronunciationDictionary | null>(null);
  const [pronunciationLoading, setPronunciationLoading] = useState(false);
  const [pronunciationSaving, setPronunciationSaving] = useState(false);
  const [keepKanjiText, setKeepKanjiText] = useState('');
  const [forceKanaText, setForceKanaText] = useState('');
  const [verbKanaText, setVerbKanaText] = useState('');
  const featureFlagsReadControllerRef = useRef<AbortController | null>(null);
  const pronunciationReadControllerRef = useRef<AbortController | null>(null);
  const featureFlagsReadRevisionRef = useRef(0);
  const featureFlagMutationsRef = useRef(new Set<AdminFeatureFlagKey>());
  const featureFlagMutationControllersRef = useRef(new Map<AdminFeatureFlagKey, AbortController>());
  const pronunciationMutationRef = useRef(false);
  const pronunciationMutationControllerRef = useRef<AbortController | null>(null);

  const fetchFeatureFlags = async (init?: AdminReadRequestInit): Promise<void> => {
    setIsFeatureFlagsLoading(true);
    setFeatureFlagsError('');
    try {
      const data = await getAdminFeatureFlags(init);
      featureFlagsReadRevisionRef.current += 1;
      setFeatureFlags(data);
    } catch (err) {
      if (isAbortError(err)) return;
      setFeatureFlagsError(err instanceof Error ? err.message : 'Failed to fetch feature flags');
    } finally {
      if (!init?.signal?.aborted) setIsFeatureFlagsLoading(false);
    }
  };

  const refreshFeatureFlags = (): Promise<void> => {
    featureFlagsReadControllerRef.current?.abort();
    const controller = new AbortController();
    featureFlagsReadControllerRef.current = controller;

    return fetchFeatureFlags({ signal: controller.signal }).finally(() => {
      if (featureFlagsReadControllerRef.current === controller) {
        featureFlagsReadControllerRef.current = null;
      }
    });
  };

  const updateFeatureFlag = async (key: AdminFeatureFlagKey, value: boolean) => {
    if (!featureFlags || featureFlagMutationsRef.current.has(key)) return;

    const previousValue = featureFlags[key];
    const readRevision = featureFlagsReadRevisionRef.current;
    const controller = new AbortController();
    featureFlagMutationsRef.current.add(key);
    featureFlagMutationControllersRef.current.set(key, controller);
    setSavingFeatureFlags(new Set(featureFlagMutationsRef.current));
    setFeatureFlags((current) => (current ? { ...current, [key]: value } : current));

    try {
      const updated = await updateAdminFeatureFlag(key, value, { signal: controller.signal });
      setFeatureFlags((current) => (current ? { ...current, [key]: updated[key] } : updated));
      showToast('Settings updated successfully', 'success');
    } catch (err) {
      if (isAbortError(err)) return;
      if (featureFlagsReadRevisionRef.current === readRevision) {
        setFeatureFlags((current) => (current ? { ...current, [key]: previousValue } : current));
      }
      showToast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
    } finally {
      if (featureFlagMutationControllersRef.current.get(key) === controller) {
        featureFlagMutationControllersRef.current.delete(key);
        featureFlagMutationsRef.current.delete(key);
        if (!controller.signal.aborted) {
          setSavingFeatureFlags(new Set(featureFlagMutationsRef.current));
        }
      }
    }
  };

  const fetchPronunciationDictionary = async (init?: AdminReadRequestInit): Promise<void> => {
    setPronunciationLoading(true);
    try {
      const data = await getAdminPronunciationDictionary(init);
      setPronunciationDictionary(data);
      setKeepKanjiText(formatKeepKanjiText(data.keepKanji || []));
      setForceKanaText(formatForceKanaText(data.forceKana || {}));
      setVerbKanaText(formatForceKanaText(data.verbKana || {}));
    } catch (err) {
      if (isAbortError(err)) return;
      showToast(
        err instanceof Error ? err.message : 'Failed to fetch pronunciation dictionary',
        'error'
      );
    } finally {
      if (!init?.signal?.aborted) setPronunciationLoading(false);
    }
  };

  const refreshPronunciationDictionary = (): Promise<void> => {
    if (pronunciationMutationRef.current) return Promise.resolve();

    pronunciationReadControllerRef.current?.abort();
    const controller = new AbortController();
    pronunciationReadControllerRef.current = controller;

    return fetchPronunciationDictionary({ signal: controller.signal }).finally(() => {
      if (pronunciationReadControllerRef.current === controller) {
        pronunciationReadControllerRef.current = null;
      }
    });
  };

  const handleSavePronunciationDictionary = async () => {
    if (pronunciationMutationRef.current) return;

    const keepKanji = parseKeepKanjiText(keepKanjiText);
    const { entries: forceKana, errors } = parseForceKanaText(forceKanaText);
    const { entries: verbKana, errors: verbKanaErrors } = parseForceKanaText(verbKanaText);

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }
    if (verbKanaErrors.length > 0) {
      showToast(verbKanaErrors[0], 'error');
      return;
    }

    const submittedText = {
      keepKanji: keepKanjiText,
      forceKana: forceKanaText,
      verbKana: verbKanaText,
    };
    const controller = new AbortController();
    pronunciationMutationRef.current = true;
    pronunciationMutationControllerRef.current = controller;
    setPronunciationSaving(true);
    try {
      const updated = await updateAdminPronunciationDictionary(
        { keepKanji, forceKana, verbKana },
        { signal: controller.signal }
      );
      setPronunciationDictionary(updated);
      setKeepKanjiText((current) =>
        current === submittedText.keepKanji ? formatKeepKanjiText(updated.keepKanji || []) : current
      );
      setForceKanaText((current) =>
        current === submittedText.forceKana ? formatForceKanaText(updated.forceKana || {}) : current
      );
      setVerbKanaText((current) =>
        current === submittedText.verbKana ? formatForceKanaText(updated.verbKana || {}) : current
      );
      showToast('Pronunciation dictionary updated', 'success');
    } catch (err) {
      if (isAbortError(err)) return;
      showToast(
        err instanceof Error ? err.message : 'Failed to update pronunciation dictionary',
        'error'
      );
    } finally {
      if (pronunciationMutationControllerRef.current === controller) {
        pronunciationMutationControllerRef.current = null;
        pronunciationMutationRef.current = false;
        if (!controller.signal.aborted) setPronunciationSaving(false);
      }
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    refreshFeatureFlags();
    refreshPronunciationDictionary();

    return () => {
      featureFlagsReadControllerRef.current?.abort();
      featureFlagsReadControllerRef.current = null;
      pronunciationReadControllerRef.current?.abort();
      pronunciationReadControllerRef.current = null;
      featureFlagMutationControllersRef.current.forEach((controller) => controller.abort());
      pronunciationMutationControllerRef.current?.abort();
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <>
      {featureFlagsError && (
        <div className="retro-admin-v3-alert is-error mb-6">{featureFlagsError}</div>
      )}

      <div className="retro-admin-v3-pane">
        <h2 className="text-xl font-semibold text-navy mb-2">Feature Visibility Settings</h2>
        <p className="text-sm text-gray-600 mb-6">
          Control which content types are visible to non-admin users. Admins can always see all
          content types.
        </p>

        {isFeatureFlagsLoading && (
          <div className="text-center py-12 text-gray-500">Loading settings...</div>
        )}
        {!isFeatureFlagsLoading && featureFlags && (
          <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
            <div className="space-y-6">
              <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-semibold text-navy">
                    Comprehensible Input Dialogues
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    AI-generated dialogues calibrated to user proficiency level
                  </p>
                </div>
                <label
                  htmlFor="toggle-dialogues"
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    id="toggle-dialogues"
                    type="checkbox"
                    checked={featureFlags.dialoguesEnabled}
                    disabled={savingFeatureFlags.has('dialoguesEnabled')}
                    onChange={(event) =>
                      updateFeatureFlag('dialoguesEnabled', event.target.checked)
                    }
                    className="sr-only peer"
                    aria-label="Toggle AI-Generated Dialogues"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-semibold text-navy">Script Player</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Japanese script creation with timed audio and illustrations
                  </p>
                </div>
                <label
                  htmlFor="toggle-scripts"
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    id="toggle-scripts"
                    type="checkbox"
                    checked={featureFlags.scriptsEnabled}
                    disabled={savingFeatureFlags.has('scriptsEnabled')}
                    onChange={(event) => updateFeatureFlag('scriptsEnabled', event.target.checked)}
                    className="sr-only peer"
                    aria-label="Toggle Script Player"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-semibold text-navy">Guided Audio Course</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Audio-only lessons built from dialogues—perfect for commutes
                  </p>
                </div>
                <label
                  htmlFor="toggle-audio-course"
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    id="toggle-audio-course"
                    type="checkbox"
                    checked={featureFlags.audioCourseEnabled}
                    disabled={savingFeatureFlags.has('audioCourseEnabled')}
                    onChange={(event) =>
                      updateFeatureFlag('audioCourseEnabled', event.target.checked)
                    }
                    className="sr-only peer"
                    aria-label="Toggle Guided Audio Course"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="flex items-center justify-between py-4">
                <div>
                  <h3 className="text-base font-semibold text-navy">Study / Flashcards</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Server-side Japanese SRS with import, review history, and study pages
                  </p>
                </div>
                <label
                  htmlFor="toggle-study"
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    id="toggle-study"
                    type="checkbox"
                    checked={featureFlags.flashcardsEnabled}
                    disabled={savingFeatureFlags.has('flashcardsEnabled')}
                    onChange={(event) =>
                      updateFeatureFlag('flashcardsEnabled', event.target.checked)
                    }
                    className="sr-only peer"
                    aria-label="Toggle Study and Flashcards"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg retro-admin-v3-note">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Visibility settings only affect non-admin users.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="retro-admin-v3-pane mt-10">
        <h2 className="text-xl font-semibold text-navy mb-2">Pronunciation Dictionaries</h2>
        <p className="text-sm text-gray-600 mb-6">
          Keep-kanji words stay in kanji for TTS. Force-kana words replace kanji with kana.
          Verb-kana words derive common godan stems for TTS. Enter one item per line. Kana formats:
          word=reading.
        </p>

        {pronunciationLoading ? (
          <div className="text-center py-12 text-gray-500">Loading pronunciation dictionary...</div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-base font-semibold text-navy mb-2">Keep-Kanji</h3>
                <textarea
                  value={keepKanjiText}
                  onChange={(event) => setKeepKanjiText(event.target.value)}
                  rows={12}
                  className="retro-admin-v3-input w-full p-3 text-sm font-mono text-gray-800"
                  placeholder="例: 橋"
                />
              </div>
              <div>
                <h3 className="text-base font-semibold text-navy mb-2">Force-Kana</h3>
                <textarea
                  value={forceKanaText}
                  onChange={(event) => setForceKanaText(event.target.value)}
                  rows={12}
                  className="retro-admin-v3-input w-full p-3 text-sm font-mono text-gray-800"
                  placeholder="例: 北海道=ほっかいどう"
                />
              </div>
              <div>
                <h3 className="text-base font-semibold text-navy mb-2">Verb-Kana</h3>
                <textarea
                  value={verbKanaText}
                  onChange={(event) => setVerbKanaText(event.target.value)}
                  rows={12}
                  className="retro-admin-v3-input w-full p-3 text-sm font-mono text-gray-800"
                  placeholder="例: 話す=はなす"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-gray-500">
                Updated:{' '}
                {pronunciationDictionary?.updatedAt
                  ? new Date(pronunciationDictionary.updatedAt).toLocaleString()
                  : '-'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={refreshPronunciationDictionary}
                  className="retro-admin-v3-btn-secondary text-sm"
                  disabled={pronunciationSaving}
                >
                  Reload
                </button>
                <button
                  type="button"
                  onClick={handleSavePronunciationDictionary}
                  className="retro-admin-v3-btn-primary text-sm"
                  disabled={pronunciationSaving}
                >
                  {pronunciationSaving ? 'Saving...' : 'Save Dictionary'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminSettingsTab;
