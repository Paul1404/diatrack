import { createFileRoute } from "@tanstack/react-router";
import { ensureDatabaseReady } from "~/server/db";

async function handle(): Promise<Response> {
  try {
    await ensureDatabaseReady();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: handle,
    },
  },
});
