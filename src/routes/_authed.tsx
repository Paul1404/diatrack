import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Layout } from "~/components/layout";
import { fetchSession } from "~/lib/auth-server";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const session = await fetchSession();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
