const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  // Query all available stock to see their literal productType
  const stocks = await prisma.stockAccount.findMany({
    where: { status: "available" },
    select: { id: true, accountEmail: true, productType: true }
  });

  console.dir(stocks);

  const targetSku = "CPM-30";
  const baseType = "mobile";
  
  try {
    const stock = await prisma.stockAccount.findFirst({
        where: {
        status: "available",
        OR: [
            { productType: { equals: targetSku, mode: "insensitive" } },
            { productType: { equals: baseType, mode: "insensitive" } },
        ],
        },
        orderBy: { createdAt: "asc" },
    });
    console.log("Matched via OR?", stock);
  } catch (error) {
    console.error("OR MATCH ERROR:", error);
  }

}

main().finally(() => prisma.$disconnect());
