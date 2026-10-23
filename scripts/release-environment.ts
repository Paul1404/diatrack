/** Release fixtures may only write to the explicitly opted-in local test database. */
export function releaseEnvironment() {
  const database = new URL(process.env.DATABASE_URL ?? "postgres://invalid/invalid");
  const baseURL = process.env.RELEASE_BASE_URL ?? "http://127.0.0.1:4389";
  const target = new URL(baseURL);
  const localHosts = ["127.0.0.1", "localhost", "[::1]"];
  if (
    process.env.DIATRACK_RELEASE_TEST !== "1" ||
    !localHosts.includes(database.hostname) ||
    database.pathname !== "/diatrack_release" ||
    !localHosts.includes(target.hostname) ||
    target.protocol !== "http:"
  ) {
    throw new Error(
      "Release tests require DIATRACK_RELEASE_TEST=1, a local diatrack_release database and a local HTTP server",
    );
  }
  return { baseURL, databaseURL: database.href };
}
