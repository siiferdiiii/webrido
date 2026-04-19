import { prisma } from "./src/lib/db";
import * as fs from "fs";

async function main() {
    const stockCounts = await prisma.stockAccount.groupBy({
      by: ["productType"],
      where: { status: "available" },
      _sum: { maxSlots: true, usedSlots: true },
      _count: true,
    });

    console.log(stockCounts);
    
    // Check raw values
    const raw = await prisma.stockAccount.findMany({ select: { id: true, productType: true, status: true, usedSlots: true, maxSlots: true } });
    fs.writeFileSync("db_dump.json", JSON.stringify(raw, null, 2));

}

main().finally(() => prisma.$disconnect());
