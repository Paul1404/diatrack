import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/react-router";
import { router } from "~/server/orpc/router";

const handler = new RPCHandler(router);

async function handle({ request }: { request: Request }): Promise<Response> {
  const { matched, response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: { headers: request.headers },
  });
  if (matched && response) return response;
  return new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
    },
  },
});
