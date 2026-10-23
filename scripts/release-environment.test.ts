import { afterEach, expect, test, vi } from "vitest";
import { releaseEnvironment } from "./release-environment";

afterEach(() => vi.unstubAllEnvs());

test.each([
  ["0", "postgres://postgres@127.0.0.1/diatrack_release", "http://127.0.0.1:4389"],
  ["1", "postgres://postgres@db.example.invalid/diatrack_release", "http://127.0.0.1:4389"],
  ["1", "postgres://postgres@127.0.0.1/diatrack", "http://127.0.0.1:4389"],
  ["1", "postgres://postgres@127.0.0.1/diatrack_release", "https://diatrack.example.invalid"],
])("refuses unsafe release targets (%s, %s, %s)", (optIn, database, target) => {
  vi.stubEnv("DIATRACK_RELEASE_TEST", optIn);
  vi.stubEnv("DATABASE_URL", database);
  vi.stubEnv("RELEASE_BASE_URL", target);
  expect(() => releaseEnvironment()).toThrow("Release tests require");
});
