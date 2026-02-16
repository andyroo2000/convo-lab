/* eslint-disable no-console */
/**
 * Service for managing sample content for new users
 */

import { Prisma } from '@prisma/client';

import { prisma } from '../db/client.js';

/**
 * Copy sample dialogues to a new user's library
 * Called when user completes onboarding
 */
export async function copySampleContentToUser(
  userId: string,
  targetLanguage: string,
  proficiencyLevel: string
) {
  console.log(
    `[SAMPLE] Copying sample content for user ${userId}, language: ${targetLanguage}, level: ${proficiencyLevel}`
  );

  try {
    // Get all sample episodes for the target language and proficiency level
    // Proficiency level is stored in the speakers, so we filter through the dialogue relationship
    const sampleEpisodes = await prisma.episode.findMany({
      where: {
        isSampleContent: true,
        targetLanguage,
        dialogue: {
          speakers: {
            some: {
              proficiency: proficiencyLevel,
            },
          },
        },
      },
      include: {
        dialogue: {
          include: {
            speakers: true,
            sentences: true,
          },
        },
      },
    });

    if (sampleEpisodes.length === 0) {
      console.log(`[SAMPLE] No sample content found for language: ${targetLanguage}`);
      return {
        copiedCount: 0,
        episodeIds: [],
      };
    }

    console.log(`[SAMPLE] Found ${sampleEpisodes.length} sample episodes to copy`);

    const copiedEpisodeIds: string[] = [];

    // Copy each episode to the user's library
    for (const sampleEpisode of sampleEpisodes) {
      // Create new episode for user
      const newEpisode = await prisma.episode.create({
        data: {
          userId,
          title: sampleEpisode.title,
          sourceText: sampleEpisode.sourceText,
          targetLanguage: sampleEpisode.targetLanguage,
          nativeLanguage: sampleEpisode.nativeLanguage,
          status: sampleEpisode.status,
          audioUrl: sampleEpisode.audioUrl,
          audioSpeed: sampleEpisode.audioSpeed,
          audioUrl_0_7: sampleEpisode.audioUrl_0_7,
          audioUrl_0_85: sampleEpisode.audioUrl_0_85,
          audioUrl_1_0: sampleEpisode.audioUrl_1_0,
          isSampleContent: true, // Mark as sample content so it doesn't count against quotas
        },
      });

      copiedEpisodeIds.push(newEpisode.id);

      // Copy dialogue if it exists
      if (sampleEpisode.dialogue) {
        const sampleDialogue = sampleEpisode.dialogue;

        // Create dialogue for new episode
        const newDialogue = await prisma.dialogue.create({
          data: {
            episodeId: newEpisode.id,
          },
        });

        // Copy speakers
        const speakerIdMap = new Map<string, string>();
        for (const speaker of sampleDialogue.speakers) {
          const newSpeaker = await prisma.speaker.create({
            data: {
              dialogueId: newDialogue.id,
              name: speaker.name,
              voiceId: speaker.voiceId,
              voiceProvider: speaker.voiceProvider,
              proficiency: speaker.proficiency,
              tone: speaker.tone,
              gender: speaker.gender,
              color: speaker.color,
              avatarUrl: speaker.avatarUrl,
            },
          });
          speakerIdMap.set(speaker.id, newSpeaker.id);
        }

        // Copy sentences
        for (const sentence of sampleDialogue.sentences) {
          const newSpeakerId = speakerIdMap.get(sentence.speakerId);
          if (!newSpeakerId) {
            console.error(`[SAMPLE] Speaker not found for sentence: ${sentence.id}`);
            continue;
          }

          await prisma.sentence.create({
            data: {
              dialogueId: newDialogue.id,
              speakerId: newSpeakerId,
              order: sentence.order,
              text: sentence.text,
              translation: sentence.translation,
              metadata: sentence.metadata ?? Prisma.JsonNull,
              audioUrl: sentence.audioUrl,
              startTime: sentence.startTime,
              endTime: sentence.endTime,
              startTime_0_7: sentence.startTime_0_7,
              endTime_0_7: sentence.endTime_0_7,
              startTime_0_85: sentence.startTime_0_85,
              endTime_0_85: sentence.endTime_0_85,
              startTime_1_0: sentence.startTime_1_0,
              endTime_1_0: sentence.endTime_1_0,
              variations: sentence.variations ?? Prisma.JsonNull,
              selected: sentence.selected,
            },
          });
        }
      }

      console.log(`[SAMPLE] Copied "${sampleEpisode.title}" to user library`);
    }

    console.log(
      `[SAMPLE] Successfully copied ${copiedEpisodeIds.length} dialogues to user ${userId}`
    );

    // Copy sample courses for the target language and proficiency level
    const copiedCourseIds = await copySampleCourses(userId, targetLanguage, proficiencyLevel);

    return {
      copiedCount: copiedEpisodeIds.length + copiedCourseIds.length,
      episodeIds: copiedEpisodeIds,
      courseIds: copiedCourseIds,
    };
  } catch (error) {
    console.error('[SAMPLE] Error copying sample content:', error);
    throw error;
  }
}

/**
 * Copy sample audio courses to a new user's library
 */
async function copySampleCourses(
  userId: string,
  targetLanguage: string,
  proficiencyLevel: string
): Promise<string[]> {
  console.log(
    `[SAMPLE] Copying sample courses for user ${userId}, language: ${targetLanguage}, level: ${proficiencyLevel}`
  );

  try {
    // Get proficiency level field name based on language
    const levelField = 'jlptLevel';

    // Get all sample courses for the target language and proficiency level
    const sampleCourses = await prisma.course.findMany({
      where: {
        isSampleContent: true,
        targetLanguage,
        [levelField]: proficiencyLevel,
      },
      include: {
        coreItems: true,
        courseEpisodes: {
          include: {
            episode: true,
          },
        },
      },
    });

    if (sampleCourses.length === 0) {
      console.log(
        `[SAMPLE] No sample courses found for language: ${targetLanguage}, level: ${proficiencyLevel}`
      );
      return [];
    }

    console.log(`[SAMPLE] Found ${sampleCourses.length} sample courses to copy`);

    const copiedCourseIds: string[] = [];

    // Copy each course to the user's library
    for (const sampleCourse of sampleCourses) {
      // First, get the user's corresponding sample episode IDs
      // (The course episodes reference sample episodes, but we need to link to the user's copied versions)
      const originalEpisodeIds = sampleCourse.courseEpisodes.map((ce) => ce.episodeId);

      // Find the user's copied versions of these episodes by matching title and language
      const userEpisodes = await prisma.episode.findMany({
        where: {
          userId,
          targetLanguage,
          isSampleContent: true,
          title: {
            in: sampleCourse.courseEpisodes.map((ce) => ce.episode.title),
          },
        },
      });

      // If user doesn't have the required episodes, skip this course
      if (userEpisodes.length !== originalEpisodeIds.length) {
        console.log(
          `[SAMPLE] Skipping course "${sampleCourse.title}" - user missing required episodes`
        );
        continue;
      }

      // Create new course for user
      const newCourse = await prisma.course.create({
        data: {
          userId,
          title: sampleCourse.title,
          description: sampleCourse.description,
          status: sampleCourse.status,
          isSampleContent: true, // Mark as sample content so it doesn't count against quotas
          nativeLanguage: sampleCourse.nativeLanguage,
          targetLanguage: sampleCourse.targetLanguage,
          maxLessonDurationMinutes: sampleCourse.maxLessonDurationMinutes,
          l1VoiceId: sampleCourse.l1VoiceId,
          l1VoiceProvider: sampleCourse.l1VoiceProvider,
          jlptLevel: sampleCourse.jlptLevel,
          speaker1Gender: sampleCourse.speaker1Gender,
          speaker2Gender: sampleCourse.speaker2Gender,
          speaker1VoiceId: sampleCourse.speaker1VoiceId,
          speaker1VoiceProvider: sampleCourse.speaker1VoiceProvider,
          speaker2VoiceId: sampleCourse.speaker2VoiceId,
          speaker2VoiceProvider: sampleCourse.speaker2VoiceProvider,
          scriptJson: sampleCourse.scriptJson ?? Prisma.JsonNull,
          approxDurationSeconds: sampleCourse.approxDurationSeconds,
          audioUrl: sampleCourse.audioUrl,
          timingData: sampleCourse.timingData ?? Prisma.JsonNull,
        },
      });

      copiedCourseIds.push(newCourse.id);

      // Link the user's episodes to the new course
      await Promise.all(
        sampleCourse.courseEpisodes.map(async (originalCourseEpisode) => {
          // Find the user's episode that matches this original episode
          const userEpisode = userEpisodes.find(
            (ep) => ep.title === originalCourseEpisode.episode.title
          );

          if (userEpisode) {
            await prisma.courseEpisode.create({
              data: {
                courseId: newCourse.id,
                episodeId: userEpisode.id,
                order: originalCourseEpisode.order,
              },
            });
          }
        })
      );

      // Copy core items
      for (const coreItem of sampleCourse.coreItems) {
        await prisma.courseCoreItem.create({
          data: {
            courseId: newCourse.id,
            textL2: coreItem.textL2,
            readingL2: coreItem.readingL2,
            translationL1: coreItem.translationL1,
            complexityScore: coreItem.complexityScore,
            sourceEpisodeId: coreItem.sourceEpisodeId,
            sourceSentenceId: coreItem.sourceSentenceId,
            sourceUnitIndex: coreItem.sourceUnitIndex,
            components: coreItem.components ?? Prisma.JsonNull,
          },
        });
      }

      console.log(`[SAMPLE] Copied course "${sampleCourse.title}" to user library`);
    }

    console.log(`[SAMPLE] Successfully copied ${copiedCourseIds.length} courses to user ${userId}`);

    return copiedCourseIds;
  } catch (error) {
    console.error('[SAMPLE] Error copying sample courses:', error);
    // Don't throw - just return empty array so dialogue copying can still succeed
    return [];
  }
}
