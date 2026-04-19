import { prisma } from "./src/lib/db";

async function main() {
    const targetSku = "CPM-30";
    const baseType = "mobile";
    
    try {
        const stock1 = await prisma.stockAccount.findFirst({
            where: {
                status: "available",
            },
        });
        console.log("Normal query stock:", stock1 !== null);

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
        console.log("Matched via OR case insensitive?", stock !== null);

        // test with null pointer
        const nullSock = await prisma.stockAccount.findFirst({
            where: {
                status: "available",
                OR: [
                    { productType: { equals: null as any, mode: "insensitive" } },
                    { productType: { equals: baseType, mode: "insensitive" } },
                ],
            }
        });
        console.log("Matched with null?", nullSock !== null);

    } catch (error) {
        console.error("OR MATCH ERROR:", error);
    }
}

main().finally(() => prisma.$disconnect());
