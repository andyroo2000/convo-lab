#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Manually copy sample content to a user
 * Usage: PROD_DATABASE_URL="..." npx tsx scripts/copy-sample-content-to-user.ts <email> <level>
 */

import { PrismaClient } from '@prisma/client';

const email = process.argv[2];
const targetLanguage = 'ja';
const proficiencyLevel = process.argv[3];

if (!email || !proficiencyLevel) {
  console.error('❌ Error: Missing arguments');
  console.log('Usage: npx tsx scripts/copy-sample-content-to-user.ts <email> <level>');
  console.log('Example: npx tsx scripts/copy-sample-content-to-user.ts user@example.com N4');
  process.exit(1);
}

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL,
    },
  },
});

async function copySampleContentToUser(
  userId: string,
  targetLanguage: string,
  proficiencyLevel: string
) {
  console.log(
    `[SAMPLE] Copying sample content for user ${userId}, language: ${targetLanguage}, level: ${proficiencyLevel}`
  );

  try {
    // Get all sample episodes for the target language and proficiency level
    const sampleEpisodes = await prodPrisma.episode.findMany({
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
      console.log(`[SAMPLE] No sample content found for language: ${targetLanguage}, level: ${proficiencyLevel}`);
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
      const newEpisode = await prodPrisma.episode.create({
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
          isSampleContent: true,
        },
      });

      copiedEpisodeIds.push(newEpisode.id);

      // Copy dialogue if it exists
      if (sampleEpisode.dialogue) {
        const sampleDialogue = sampleEpisode.dialogue;

        // Create dialogue for new episode
        const newDialogue = await prodPrisma.dialogue.create({
          data: {
            episodeId: newEpisode.id,
          },
        });

        // Copy speakers
        const speakerIdMap = new Map<string, string>();
        for (const speaker of sampleDialogue.speakers) {
          const newSpeaker = await prodPrisma.speaker.create({
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

          await prodPrisma.sentence.create({
            data: {
              dialogueId: newDialogue.id,
              speakerId: newSpeakerId,
              order: sentence.order,
              text: sentence.text,
              translation: sentence.translation,
              metadata: sentence.metadata as any,
              audioUrl: sentence.audioUrl,
              startTime: sentence.startTime,
              endTime: sentence.endTime,
              startTime_0_7: sentence.startTime_0_7,
              endTime_0_7: sentence.endTime_0_7,
              startTime_0_85: sentence.startTime_0_85,
              endTime_0_85: sentence.endTime_0_85,
              startTime_1_0: sentence.startTime_1_0,
              endTime_1_0: sentence.endTime_1_0,
              variations: sentence.variations as any,
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

    // Copy sample courses
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

async function copySampleCourses(
  userId: string,
  targetLanguage: string,
  proficiencyLevel: string
): Promise<string[]> {
  console.log(
    `[SAMPLE] Copying sample courses for user ${userId}, language: ${targetLanguage}, level: ${proficiencyLevel}`
  );

  try {
    // Get all sample courses for the target language and proficiency level
    const sampleCourses = await prodPrisma.course.findMany({
      where: {
        isSampleContent: true,
        targetLanguage,
        jlptLevel: proficiencyLevel,
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
      const originalEpisodeIds = sampleCourse.courseEpisodes.map((ce) => ce.episodeId);

      // Find the user's copied versions of these episodes by matching title and language
      const userEpisodes = await prodPrisma.episode.findMany({
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
      const newCourse = await prodPrisma.course.create({
        data: {
          userId,
          title: sampleCourse.title,
          description: sampleCourse.description,
          status: sampleCourse.status,
          isSampleContent: true,
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
          scriptJson: sampleCourse.scriptJson as any,
          approxDurationSeconds: sampleCourse.approxDurationSeconds,
          audioUrl: sampleCourse.audioUrl,
          timingData: sampleCourse.timingData as any,
        },
      });

      copiedCourseIds.push(newCourse.id);

      // Link the user's episodes to the new course
      await Promise.all(
        sampleCourse.courseEpisodes.map(async (originalCourseEpisode) => {
          const userEpisode = userEpisodes.find(
            (ep) => ep.title === originalCourseEpisode.episode.title
          );

          if (userEpisode) {
            await prodPrisma.courseEpisode.create({
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
        await prodPrisma.courseCoreItem.create({
          data: {
            courseId: newCourse.id,
            textL2: coreItem.textL2,
            readingL2: coreItem.readingL2,
            translationL1: coreItem.translationL1,
            complexityScore: coreItem.complexityScore,
            sourceEpisodeId: coreItem.sourceEpisodeId,
            sourceSentenceId: coreItem.sourceSentenceId,
            components: coreItem.components as any,
          },
        });
      }

      console.log(`[SAMPLE] Copied course "${sampleCourse.title}" to user library`);
    }

    console.log(`[SAMPLE] Successfully copied ${copiedCourseIds.length} courses to user ${userId}`);

    return copiedCourseIds;
  } catch (error) {
    console.error('[SAMPLE] Error copying sample courses:', error);
    return [];
  }
}

async function run() {
  try {
    console.log(`🔍 Finding user: ${email}...`);

    const user = await prodPrisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (${user.id})\n`);

    const result = await copySampleContentToUser(user.id, targetLanguage, proficiencyLevel);

    console.log('\n✨ Copy complete!');
    console.log(`   - Total items: ${result.copiedCount}`);
    console.log(`   - Dialogues: ${result.episodeIds?.length || 0}`);
    console.log(`   - Courses: ${result.courseIds?.length || 0}`);
  } catch (error) {
    console.error('❌ Copy failed:', error);
    throw error;
  } finally {
    await prodPrisma.$disconnect();
  }
}

run()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
