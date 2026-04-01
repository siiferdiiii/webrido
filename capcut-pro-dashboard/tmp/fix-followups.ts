import 'dotenv/config';
import { prisma } from "../src/lib/db";

async function main() {
  const followups = await prisma.scheduledFollowup.findMany({
    where: { status: { in: ['pending', 'processing'] } }
  });

  console.log(`Found ${followups.length} followups to check...`);

  for (const f of followups) {
    const sentCount = await prisma.scheduledFollowupRecipient.count({
      where: {
        followupId: f.id,
        status: { not: 'pending' }
      }
    });

    const totalRecipients = f.totalRecipients || 0;
    const isCompleted = sentCount >= totalRecipients && totalRecipients > 0;
    const newStatus = isCompleted ? 'completed' : (sentCount > 0 ? 'processing' : f.status);

    await prisma.scheduledFollowup.update({
      where: { id: f.id },
      data: {
        sentCount,
        status: newStatus
      }
    });

    console.log(`Updated followup ${f.id} => sentCount=${sentCount}, status=${newStatus}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
