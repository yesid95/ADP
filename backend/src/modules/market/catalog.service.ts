import { getMarketPrisma } from "../../infrastructure/database/prisma.js";

export async function getPublicCatalog() {
  const prisma = getMarketPrisma();
  const [departments, crops] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        daneCode: true,
        name: true,
        municipalities: {
          orderBy: { name: "asc" },
          select: { id: true, daneCode: true, name: true }
        }
      }
    }),
    prisma.cropVariety.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true }
    })
  ]);
  return { departments, crops };
}
