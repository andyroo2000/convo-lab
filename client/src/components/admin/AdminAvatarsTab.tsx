import { useEffect, useRef, useState } from 'react';
import { Area } from 'react-easy-crop';
import {
  adminApi,
  getAdminSpeakerAvatarOriginal,
  getAdminSpeakerAvatars,
  recropAdminSpeakerAvatar,
  uploadAdminSpeakerAvatar,
  type AdminReadRequestInit,
  type AdminSpeakerAvatar,
  type AdminUser,
} from '../../lib/adminApi';
import AvatarCropperModal from './AvatarCropperModal';

interface AdminAvatarsTabProps {
  users: AdminUser[];
  isUsersLoading: boolean;
  refreshUsers: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_SPEAKER_AVATARS = [
  'ja-female-casual.jpg',
  'ja-female-polite.jpg',
  'ja-female-formal.jpg',
  'ja-male-casual.jpg',
  'ja-male-polite.jpg',
  'ja-male-formal.jpg',
];

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

interface AbortControllerRef {
  current: AbortController | null;
}

const isCurrentRequest = (
  controller: AbortController,
  controllerRef: AbortControllerRef
): boolean => {
  if (controller.signal.aborted) return false;
  return controllerRef.current === controller;
};

const shouldIgnoreRequestError = (
  error: unknown,
  controller: AbortController,
  controllerRef: AbortControllerRef
): boolean => {
  if (isAbortError(error)) return true;
  return !isCurrentRequest(controller, controllerRef);
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const formatAvatarTitle = (filename: string): string => {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const parts = nameWithoutExt.split('-');
  const languageMap: Record<string, string> = { ja: 'Japanese' };
  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  const language = languageMap[parts[0]] || capitalize(parts[0]);

  return `${language} ${capitalize(parts[1])} - ${capitalize(parts[2])}`;
};

const getAvatarColorClass = (color?: string): string => {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    cyan: 'bg-cyan-500',
  };

  return color ? colorMap[color] || 'bg-indigo-500' : 'bg-indigo-500';
};

const AdminAvatarsTab = ({
  users,
  isUsersLoading,
  refreshUsers,
  showToast,
}: AdminAvatarsTabProps) => {
  const [speakerAvatars, setSpeakerAvatars] = useState<AdminSpeakerAvatar[]>([]);
  const [isSpeakerAvatarsLoading, setIsSpeakerAvatarsLoading] = useState(false);
  const [speakerAvatarsError, setSpeakerAvatarsError] = useState('');
  const [loadingSpeakerAvatarOriginal, setLoadingSpeakerAvatarOriginal] = useState<string | null>(
    null
  );
  const [cropperOpen, setCropperOpen] = useState(false);
  const [activeCropperSessionId, setActiveCropperSessionId] = useState(0);
  const [cropperImageUrl, setCropperImageUrl] = useState('');
  const [cropperTitle, setCropperTitle] = useState('');
  const [cropperSaveHandler, setCropperSaveHandler] = useState<
    ((blob: Blob, cropArea: Area) => Promise<void>) | null
  >(null);
  const speakerAvatarsReadControllerRef = useRef<AbortController | null>(null);
  const speakerAvatarOriginalReadControllerRef = useRef<AbortController | null>(null);
  const speakerAvatarMutationControllerRef = useRef<AbortController | null>(null);
  const cropperObjectUrlRef = useRef<string | null>(null);
  const cropperSessionRef = useRef(0);

  const revokeCropperObjectUrl = () => {
    const objectUrl = cropperObjectUrlRef.current;
    if (!objectUrl) return;

    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(objectUrl);
    cropperObjectUrlRef.current = null;
  };

  const beginCropperSession = () => {
    cropperSessionRef.current += 1;
    const sessionId = cropperSessionRef.current;
    setActiveCropperSessionId(sessionId);
    return sessionId;
  };

  const closeCropperSession = (expectedSessionId?: number) => {
    if (expectedSessionId !== undefined && cropperSessionRef.current !== expectedSessionId) {
      return false;
    }

    cropperSessionRef.current += 1;
    revokeCropperObjectUrl();
    setCropperOpen(false);
    setCropperImageUrl('');
    setCropperTitle('');
    setCropperSaveHandler(null);
    return true;
  };

  const fetchSpeakerAvatars = async (
    bustCache = false,
    init?: AdminReadRequestInit
  ): Promise<void> => {
    setIsSpeakerAvatarsLoading(true);
    setSpeakerAvatarsError('');
    try {
      setSpeakerAvatars(await getAdminSpeakerAvatars(bustCache ? Date.now() : undefined, init));
    } catch (err) {
      if (isAbortError(err)) return;
      setSpeakerAvatarsError(getErrorMessage(err, 'Failed to fetch speaker avatars'));
    } finally {
      if (!init?.signal?.aborted) setIsSpeakerAvatarsLoading(false);
    }
  };

  const refreshSpeakerAvatars = (bustCache = false): Promise<void> => {
    speakerAvatarsReadControllerRef.current?.abort();
    const controller = new AbortController();
    speakerAvatarsReadControllerRef.current = controller;

    return fetchSpeakerAvatars(bustCache, { signal: controller.signal }).finally(() => {
      if (speakerAvatarsReadControllerRef.current === controller) {
        speakerAvatarsReadControllerRef.current = null;
      }
    });
  };

  interface SpeakerAvatarMutationOptions {
    cropperSessionId: number;
    failureMessage: string;
    mutate: (signal: AbortSignal) => Promise<unknown>;
    successMessage: string;
  }

  const runSpeakerAvatarMutation = async ({
    cropperSessionId,
    failureMessage,
    mutate,
    successMessage,
  }: SpeakerAvatarMutationOptions): Promise<void> => {
    speakerAvatarMutationControllerRef.current?.abort();
    const controller = new AbortController();
    speakerAvatarMutationControllerRef.current = controller;

    try {
      await mutate(controller.signal);
      if (!isCurrentRequest(controller, speakerAvatarMutationControllerRef)) return;

      if (closeCropperSession(cropperSessionId)) {
        showToast(successMessage, 'success');
      }
      await refreshSpeakerAvatars(true);
    } catch (err) {
      if (shouldIgnoreRequestError(err, controller, speakerAvatarMutationControllerRef)) return;
      showToast(getErrorMessage(err, failureMessage), 'error');
    } finally {
      if (speakerAvatarMutationControllerRef.current === controller) {
        speakerAvatarMutationControllerRef.current = null;
      }
    }
  };

  const handleRecropSpeaker = async (filename: string) => {
    speakerAvatarOriginalReadControllerRef.current?.abort();
    const controller = new AbortController();
    speakerAvatarOriginalReadControllerRef.current = controller;
    setLoadingSpeakerAvatarOriginal(filename);

    try {
      const data = await getAdminSpeakerAvatarOriginal(filename, { signal: controller.signal });
      if (!isCurrentRequest(controller, speakerAvatarOriginalReadControllerRef)) return;

      const cropperSessionId = beginCropperSession();
      revokeCropperObjectUrl();
      setCropperImageUrl(data.originalUrl);
      setCropperTitle(`Re-crop ${filename}`);
      setCropperSaveHandler(() => async (_blob: Blob, cropArea: Area) => {
        await runSpeakerAvatarMutation({
          cropperSessionId,
          failureMessage: 'Failed to re-crop speaker avatar',
          mutate: (signal) => recropAdminSpeakerAvatar(filename, cropArea, { signal }),
          successMessage: 'Speaker avatar re-cropped successfully',
        });
      });
      setCropperOpen(true);
    } catch (err) {
      if (shouldIgnoreRequestError(err, controller, speakerAvatarOriginalReadControllerRef)) return;
      showToast(getErrorMessage(err, 'Failed to load original image'), 'error');
    } finally {
      if (speakerAvatarOriginalReadControllerRef.current === controller) {
        speakerAvatarOriginalReadControllerRef.current = null;
        if (!controller.signal.aborted) setLoadingSpeakerAvatarOriginal(null);
      }
    }
  };

  const handleUploadNewSpeaker = (filename: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      speakerAvatarOriginalReadControllerRef.current?.abort();
      speakerAvatarOriginalReadControllerRef.current = null;
      setLoadingSpeakerAvatarOriginal(null);
      const cropperSessionId = beginCropperSession();
      revokeCropperObjectUrl();
      const url = URL.createObjectURL(file);
      cropperObjectUrlRef.current = url;
      setCropperImageUrl(url);
      setCropperTitle(`Upload New ${filename}`);
      setCropperSaveHandler(() => async (_blob: Blob, cropArea: Area) => {
        await runSpeakerAvatarMutation({
          cropperSessionId,
          failureMessage: 'Failed to upload speaker avatar',
          mutate: (signal) => uploadAdminSpeakerAvatar(filename, file, cropArea, { signal }),
          successMessage: 'Speaker avatar updated successfully',
        });
      });
      setCropperOpen(true);
    };
    input.click();
  };

  const handleUploadUserAvatar = (user: AdminUser) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      speakerAvatarOriginalReadControllerRef.current?.abort();
      speakerAvatarOriginalReadControllerRef.current = null;
      setLoadingSpeakerAvatarOriginal(null);
      const cropperSessionId = beginCropperSession();
      revokeCropperObjectUrl();
      const url = URL.createObjectURL(file);
      cropperObjectUrlRef.current = url;
      setCropperImageUrl(url);
      setCropperTitle(`Upload Avatar for ${user.displayName || user.name}`);
      setCropperSaveHandler(() => async (_blob: Blob, cropArea: Area) => {
        try {
          const formData = new FormData();
          formData.append('image', file, 'avatar.jpg');
          formData.append('cropArea', JSON.stringify(cropArea));

          const response = await fetch(adminApi.userAvatarUpload(user.id), {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          if (!response.ok) throw new Error('Failed to upload user avatar');

          if (closeCropperSession(cropperSessionId)) {
            showToast('User avatar updated successfully', 'success');
          }
          refreshUsers();
        } catch (err) {
          showToast(getErrorMessage(err, 'Failed to upload user avatar'), 'error');
        }
      });
      setCropperOpen(true);
    };
    input.click();
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    refreshSpeakerAvatars();

    return () => {
      speakerAvatarsReadControllerRef.current?.abort();
      speakerAvatarsReadControllerRef.current = null;
      speakerAvatarOriginalReadControllerRef.current?.abort();
      speakerAvatarOriginalReadControllerRef.current = null;
      speakerAvatarMutationControllerRef.current?.abort();
      speakerAvatarMutationControllerRef.current = null;
      closeCropperSession();
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="retro-admin-v3-pane">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-navy mb-4">Speaker Avatars</h2>
        <p className="text-sm text-gray-600 mb-6">
          Manage the 6 speaker avatar images used in dialogues and courses
        </p>

        {speakerAvatarsError && (
          <div className="retro-admin-v3-alert is-error mb-6">{speakerAvatarsError}</div>
        )}

        {isSpeakerAvatarsLoading ? (
          <div className="text-center py-12 text-gray-500">Loading speaker avatars...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {DEFAULT_SPEAKER_AVATARS.map((filename) => {
              const avatar = speakerAvatars.find((candidate) => candidate.filename === filename);

              if (avatar) {
                return (
                  <div
                    key={filename}
                    className="bg-white rounded-lg shadow p-4 retro-admin-v3-card"
                  >
                    <div className="aspect-square w-32 h-32 mx-auto mb-3 rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={avatar.croppedUrl}
                        alt={filename}
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          const image = event.currentTarget;
                          image.src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23ddd" width="128" height="128"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                    <p
                      className="text-xs sm:text-sm text-gray-700 text-center mb-3 font-medium"
                      title={filename}
                    >
                      {formatAvatarTitle(filename)}
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleRecropSpeaker(filename)}
                        disabled={loadingSpeakerAvatarOriginal === filename}
                        className="retro-admin-v3-btn-secondary text-xs sm:text-sm py-1"
                      >
                        {loadingSpeakerAvatarOriginal === filename ? 'Loading...' : 'Re-crop'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUploadNewSpeaker(filename)}
                        className="retro-admin-v3-btn-primary text-xs sm:text-sm py-1"
                      >
                        Upload New
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={filename}
                  className="bg-white rounded-lg shadow p-4 border-2 border-dashed border-gray-300 retro-admin-v3-card"
                >
                  <div className="aspect-square w-32 h-32 mx-auto mb-3 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <p
                    className="text-xs sm:text-sm text-gray-700 text-center mb-3 font-medium"
                    title={filename}
                  >
                    {formatAvatarTitle(filename)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleUploadNewSpeaker(filename)}
                    className="retro-admin-v3-btn-primary text-xs sm:text-sm py-1 w-full"
                  >
                    Upload
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-navy mb-4">User Avatars</h2>
        <p className="text-sm text-gray-600 mb-6">Manage custom avatar images for users</p>

        {isUsersLoading ? (
          <div className="text-center py-12 text-gray-500">Loading users...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    User
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Avatar
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4">
                      <div>
                        <div className="font-medium text-navy whitespace-nowrap">
                          {user.displayName || user.name}
                        </div>
                        <div className="text-sm text-gray-500 whitespace-nowrap">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center text-white font-semibold ${getAvatarColorClass(
                              user.avatarColor
                            )}`}
                          >
                            {(user.displayName || user.name).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleUploadUserAvatar(user)}
                        className="btn-primary text-xs sm:text-sm whitespace-nowrap"
                      >
                        Upload Avatar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12 text-gray-500">No users found</div>
            )}
          </div>
        )}
      </div>

      <AvatarCropperModal
        isOpen={cropperOpen}
        onClose={() => closeCropperSession(activeCropperSessionId)}
        imageUrl={cropperImageUrl}
        onSave={cropperSaveHandler || (async () => {})}
        title={cropperTitle}
      />
    </div>
  );
};

export default AdminAvatarsTab;
