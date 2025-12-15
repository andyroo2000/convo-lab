import { prisma } from './src/db/client.js';
import crypto from 'crypto';

async function createInvite() {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const invite = await prisma.inviteCode.create({
    data: { code }
  });
  console.log(`✅ Created new invite code: ${invite.code}`);
  process.exit(0);
}

createInvite();
