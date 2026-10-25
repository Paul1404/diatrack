import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readStaticFile } from "../static-file.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});

describe("static file reads", () => {
  it("returns exact bytes and refuses directories and symbolic links", async () => {
    const dir = await mkdtemp(join(tmpdir(), "diatrack-static-"));
    directories.push(dir);
    const asset = join(dir, "asset.txt");
    await writeFile(asset, "static asset");
    await symlink(asset, join(dir, "link.txt"));
    expect((await readStaticFile(asset))?.toString()).toBe("static asset");
    expect(await readStaticFile(dir)).toBeNull();
    await expect(readStaticFile(join(dir, "link.txt"))).rejects.toThrow();
    await expect(readStaticFile(join(dir, "missing.txt"))).rejects.toThrow();
  });
});
