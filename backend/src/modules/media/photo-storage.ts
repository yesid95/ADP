import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { getEnv } from "../../config/env.js";

function privateRoot(): string {
  return resolve(getEnv().PRIVATE_UPLOAD_DIR);
}

function absoluteStoragePath(storageKey: string): string {
  const root = privateRoot();
  const target = resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Storage key escapes the private upload directory");
  }
  return target;
}

export async function writePrivatePhoto(
  storageKey: string,
  contents: Buffer
): Promise<void> {
  const target = absoluteStoragePath(storageKey);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, { flag: "wx", mode: 0o600 });
}

export async function readPrivatePhoto(storageKey: string): Promise<Buffer> {
  return readFile(absoluteStoragePath(storageKey));
}

export async function removePrivatePhoto(storageKey: string): Promise<void> {
  try {
    await unlink(absoluteStoragePath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
