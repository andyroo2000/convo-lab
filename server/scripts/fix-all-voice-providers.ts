import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query'],
});

/**
 * Comprehensive voice provider fix
 * - Polly voices: No hyphens in ID (e.g., "Takumi", "Lucia", "Lupe")
 * - Azure voices: End with "Neural" (e.g., "ja-JP-NanamiNeural", "en-US-JennyNeural")
 * - Google voices: Have hyphens but don't end with "Neural" (e.g., "ja-JP-Standard-A")
 */
async function fixAllVoiceProviders() {
  console.log('🔍 Finding voice provider mismatches...\n');

  // Find all speakers
  const allSpeakers = await prisma.speaker.findMany({
    select: {
      id: true,
      name: true,
      voiceId: true,
      voiceProvider: true,
    },
  });

  const fixes: Array<{
    id: string;
    name: string;
    voiceId: string;
    currentProvider: string;
    correctProvider: string;
  }> = [];

  for (const speaker of allSpeakers) {
    const voiceId = speaker.voiceId;
    let correctProvider: string;

    // Determine correct provider based on voice ID pattern
    if (voiceId.endsWith('Neural')) {
      // Azure voices end with "Neural"
      correctProvider = 'azure';
    } else if (!voiceId.includes('-')) {
      // Polly voices have no hyphens
      correctProvider = 'polly';
    } else {
      // Google voices have hyphens but don't end with "Neural"
      correctProvider = 'google';
    }

    // Check if provider is incorrect
    if (speaker.voiceProvider !== correctProvider) {
      fixes.push({
        id: speaker.id,
        name: speaker.name,
        voiceId: speaker.voiceId,
        currentProvider: speaker.voiceProvider,
        correctProvider,
      });
    }
  }

  if (fixes.length === 0) {
    console.log('✅ No voice provider mismatches found!\n');
    return;
  }

  console.log(`Found ${fixes.length} mismatched speakers:\n`);

  // Group by type of fix
  const pollyFixes = fixes.filter((f) => f.correctProvider === 'polly');
  const azureFixes = fixes.filter((f) => f.correctProvider === 'azure');
  const googleFixes = fixes.filter((f) => f.correctProvider === 'google');

  if (pollyFixes.length > 0) {
    console.log(`📢 Polly voices (${pollyFixes.length}):`);
    pollyFixes.slice(0, 5).forEach((f) => {
      console.log(`  - ${f.name}: ${f.voiceId} (${f.currentProvider} → polly)`);
    });
    if (pollyFixes.length > 5) {
      console.log(`  ... and ${pollyFixes.length - 5} more`);
    }
    console.log();
  }

  if (azureFixes.length > 0) {
    console.log(`🎙️  Azure voices (${azureFixes.length}):`);
    azureFixes.slice(0, 5).forEach((f) => {
      console.log(`  - ${f.name}: ${f.voiceId} (${f.currentProvider} → azure)`);
    });
    if (azureFixes.length > 5) {
      console.log(`  ... and ${azureFixes.length - 5} more`);
    }
    console.log();
  }

  if (googleFixes.length > 0) {
    console.log(`🌐 Google voices (${googleFixes.length}):`);
    googleFixes.slice(0, 5).forEach((f) => {
      console.log(`  - ${f.name}: ${f.voiceId} (${f.currentProvider} → google)`);
    });
    if (googleFixes.length > 5) {
      console.log(`  ... and ${googleFixes.length - 5} more`);
    }
    console.log();
  }

  console.log('🔧 Fixing all mismatches...\n');

  // Update all mismatched speakers
  for (const fix of fixes) {
    await prisma.speaker.update({
      where: { id: fix.id },
      data: { voiceProvider: fix.correctProvider },
    });
  }

  console.log(`✅ Fixed ${fixes.length} speakers!\n`);
  console.log('Summary:');
  console.log(`  - Polly: ${pollyFixes.length} fixed`);
  console.log(`  - Azure: ${azureFixes.length} fixed`);
  console.log(`  - Google: ${googleFixes.length} fixed`);
}

fixAllVoiceProviders()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
