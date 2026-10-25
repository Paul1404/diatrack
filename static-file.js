import { constants } from "node:fs";
import { open } from "node:fs/promises";

// Inspect and read the same open file, even if its pathname is replaced.
export async function readStaticFile(filePath) {
  const file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (!(await file.stat()).isFile()) return null;
    return await file.readFile();
  } finally {
    await file.close();
  }
}
