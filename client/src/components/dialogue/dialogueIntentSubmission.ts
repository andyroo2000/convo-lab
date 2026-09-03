import {
  acknowledgeGenerationIntent,
  type GenerationIntent,
} from '../../lib/generationIntentStore';
import {
  isAcknowledgedGenerationFailure,
  isDefinitiveGenerationRejection,
} from '../../lib/generationRequest';
import type { DialogueGenerationIntentPayload } from './dialogueGenerationRequest';
import type { DialogueGeneratorState } from './useDialogueGeneratorState';

const createIntentEpisode = (
  state: DialogueGeneratorState,
  intent: GenerationIntent<DialogueGenerationIntentPayload>
) => {
  const request = { ...intent.payload.episode, id: intent.intentId };
  return intent.payload.viewAsUserId
    ? state.createEpisode(request, intent.payload.viewAsUserId)
    : state.createEpisode(request);
};

const generateIntentDialogue = (
  state: DialogueGeneratorState,
  intent: GenerationIntent<DialogueGenerationIntentPayload>,
  episodeId: string
) =>
  state.generateDialogue({
    episodeId,
    speakers: intent.payload.dialogue.speakers,
    variationCount: intent.payload.dialogue.variationCount,
    dialogueLength: intent.payload.dialogue.dialogueLength,
    options: {
      ...intent.payload.dialogue.options,
      clientRequestId: intent.intentId,
      ...(intent.payload.viewAsUserId ? { viewAsUserId: intent.payload.viewAsUserId } : {}),
    },
  });

export const acknowledgeRejectedDialogueIntent = (
  state: DialogueGeneratorState,
  intent: GenerationIntent<DialogueGenerationIntentPayload>,
  error: unknown
) => {
  const acknowledgedFailure = isAcknowledgedGenerationFailure(error, intent.intentId);
  const definitiveRejection = isDefinitiveGenerationRejection(error);
  if (acknowledgedFailure) acknowledgeGenerationIntent(intent);
  if (definitiveRejection) acknowledgeGenerationIntent(intent);
  if (!acknowledgedFailure && !definitiveRejection) state.setConflictedIntent(intent);
};

export const submitDialogueIntent = async (
  state: DialogueGeneratorState,
  intent: GenerationIntent<DialogueGenerationIntentPayload>
) => {
  const episode = await createIntentEpisode(state, intent);
  if (episode.id !== intent.intentId) {
    throw new Error('The server created a different episode for this generation request.');
  }
  state.setGeneratedEpisodeId(episode.id);
  const acknowledgement = await generateIntentDialogue(state, intent, episode.id);
  if (acknowledgement.clientRequestId !== intent.intentId) {
    throw new Error('The server acknowledged a different generation request.');
  }
  if (acknowledgement.state === 'failed') {
    acknowledgeGenerationIntent(intent);
    throw new Error(acknowledgement.message || 'Dialogue generation failed.');
  }
  acknowledgeGenerationIntent(intent);
  state.setJobId(acknowledgement.jobId);
};
