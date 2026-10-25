import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("patched Drizzle loader dependency", () => {
  it("keeps synchronous and asynchronous TypeScript transforms usable by the legacy loader", async () => {
    const kitRequire = createRequire(require.resolve("drizzle-kit"));
    const loaderRequire = createRequire(kitRequire.resolve("@esbuild-kit/esm-loader"));
    const { transformSync, transform } = loaderRequire("@esbuild-kit/core-utils");
    const source = "const value: number = 42; export default value;";
    const synchronous = transformSync(source, "/tmp/compatibility.ts");
    expect(synchronous.code).not.toContain(": number");
    const module = { exports: {} as { default?: number } };
    new Function("module", "exports", "require", synchronous.code)(module, module.exports, require);
    expect(module.exports.default).toBe(42);
    expect(synchronous.map).toBeDefined();

    const asynchronous = await transform(source, "/tmp/compatibility.ts");
    expect(asynchronous.code).not.toContain(": number");
    const url = `data:text/javascript;base64,${Buffer.from(asynchronous.code).toString("base64")}`;
    const loaded = await import(/* @vite-ignore */ url);
    expect(loaded.default).toBe(42);
    expect(asynchronous.map).toBeDefined();
  });
});
