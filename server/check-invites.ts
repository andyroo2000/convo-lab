import { prisma } from './src/db/client.js';

async function checkInvites() {
  const codes = await prisma.inviteCode.findMany({ take: 10 });
  console.log(JSON.stringify(codes, null, 2));
  process.exit(0);
}

checkInvites();
