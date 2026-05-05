import StudyCardImageControls from './StudyCardImageControls';

const StudyCandidatePreviewImage = ({
  altText,
  imagePrompt,
  imagePromptId,
  imagePromptLabel,
  isRegenerating,
  isRegenerateDisabled,
  onImagePromptChange,
  onRegenerate,
  previewUrl,
  regenerateError = null,
  regenerateLabel,
  title,
}: {
  altText: string;
  imagePrompt: string;
  imagePromptId: string;
  imagePromptLabel: string;
  isRegenerating: boolean;
  isRegenerateDisabled?: boolean;
  onImagePromptChange: (value: string) => void;
  onRegenerate: () => void;
  previewUrl: string | null;
  regenerateError?: string | null;
  regenerateLabel: string;
  title: string;
}) => (
  <StudyCardImageControls
    altText={altText}
    imagePlacement="prompt"
    imagePrompt={imagePrompt}
    imagePromptId={imagePromptId}
    imagePromptLabel={imagePromptLabel}
    isRegenerateDisabled={isRegenerateDisabled}
    isRegenerating={isRegenerating}
    onImagePlacementChange={() => undefined}
    onImagePromptChange={onImagePromptChange}
    onRegenerate={onRegenerate}
    previewUrl={previewUrl}
    regenerateError={regenerateError}
    regenerateLabel={regenerateLabel}
    showImagePlacement={false}
    title={title}
  />
);

export default StudyCandidatePreviewImage;
