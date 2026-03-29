const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const countNull = await prisma.transaction.count({ where: { lynkIdRef: null } });
  console.log('Null Lynk IDs:', countNull);
  const total = await prisma.transaction.count();
  console.log('Total Transaksi:', total);
  
  // Let's also check for duplicates
  const grouped = await prisma.transaction.groupBy({
    by: ['lynkIdRef'],
    having: {
      lynkIdRef: {
        _count: {
          gt: 1
        }
      }
    },
    where: {
      lynkIdRef: {
        not: null
      }
    }
  });
  console.log('Duplicate Lynk.id count:', grouped.length);
}

main().finally(() => prisma.$disconnect());
