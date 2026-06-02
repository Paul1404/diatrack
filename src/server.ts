import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { startScheduler } from "~/server/scheduler";

// Boot the in-process reminder scheduler once when the server entry loads.
startScheduler();

const fetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(...args: Parameters<typeof fetch>) {
    return fetch(...args);
  },
};
