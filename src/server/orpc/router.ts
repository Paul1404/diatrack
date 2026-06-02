import * as admin from "./procedures/admin";
import * as devices from "./procedures/devices";
import * as enums from "./procedures/enums";
import * as settings from "./procedures/settings";
import * as stats from "./procedures/stats";

export const router = {
  devices: {
    list: devices.list,
    get: devices.get,
    create: devices.create,
    update: devices.update,
    end: devices.end,
    reportFailure: devices.reportFailure,
    remove: devices.remove,
    clearHistory: devices.clearHistory,
  },
  stats: {
    overview: stats.overview,
    failures: stats.failures,
    history: stats.history,
  },
  settings: {
    get: settings.get,
    update: settings.update,
  },
  admin: {
    getSettings: admin.getSettings,
    updateSettings: admin.updateSettings,
    testSmtp: admin.testSmtp,
    listEmailLogs: admin.listEmailLogs,
    clearEmailLogs: admin.clearEmailLogs,
  },
  enums: {
    bodyLocations: enums.bodyLocations,
    failureReasons: enums.failureReasons,
    deviceTypes: enums.deviceTypes,
  },
};

export type AppRouter = typeof router;
