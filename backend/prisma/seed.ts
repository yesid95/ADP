import { getPrisma, disconnectPrisma } from "../src/infrastructure/database/prisma.js";

const CASANARE_ID = 85;

const municipalities = [
  { id: 8_501, daneCode: "85001", name: "Yopal" },
  { id: 8_502, daneCode: "85010", name: "Aguazul" },
  { id: 8_503, daneCode: "85015", name: "Chámeza" },
  { id: 8_504, daneCode: "85125", name: "Hato Corozal" },
  { id: 8_505, daneCode: "85136", name: "La Salina" },
  { id: 8_506, daneCode: "85139", name: "Maní" },
  { id: 8_507, daneCode: "85162", name: "Monterrey" },
  { id: 8_508, daneCode: "85225", name: "Nunchía" },
  { id: 8_509, daneCode: "85230", name: "Orocué" },
  { id: 8_510, daneCode: "85250", name: "Paz de Ariporo" },
  { id: 8_511, daneCode: "85263", name: "Pore" },
  { id: 8_512, daneCode: "85279", name: "Recetor" },
  { id: 8_513, daneCode: "85300", name: "Sabanalarga" },
  { id: 8_514, daneCode: "85315", name: "Sácama" },
  { id: 8_515, daneCode: "85325", name: "San Luis de Palenque" },
  { id: 8_516, daneCode: "85400", name: "Támara" },
  { id: 8_517, daneCode: "85410", name: "Tauramena" },
  { id: 8_518, daneCode: "85430", name: "Trinidad" },
  { id: 8_519, daneCode: "85440", name: "Villanueva" }
] as const;

async function main(): Promise<void> {
  const prisma = getPrisma();

  await prisma.department.upsert({
    where: { id: CASANARE_ID },
    update: { daneCode: "85", name: "Casanare" },
    create: { id: CASANARE_ID, daneCode: "85", name: "Casanare" }
  });

  for (const municipality of municipalities) {
    await prisma.municipality.upsert({
      where: { daneCode: municipality.daneCode },
      update: {
        departmentId: CASANARE_ID,
        name: municipality.name
      },
      create: {
        id: municipality.id,
        departmentId: CASANARE_ID,
        daneCode: municipality.daneCode,
        name: municipality.name
      }
    });
  }

  await prisma.cropVariety.upsert({
    where: { code: "PLATANO_HARTON" },
    update: { name: "Plátano hartón", isActive: true },
    create: { code: "PLATANO_HARTON", name: "Plátano hartón", isActive: true }
  });
}

main()
  .then(() => disconnectPrisma())
  .catch(async (error: unknown) => {
    console.error(error);
    await disconnectPrisma();
    process.exitCode = 1;
  });
