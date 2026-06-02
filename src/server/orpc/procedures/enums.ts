import { BODY_LOCATION_LABELS, DEVICE_TYPE_LABELS, FAILURE_REASON_LABELS } from "~/server/labels";
import { authed } from "~/server/orpc/context";

export interface EnumOption {
  value: string;
  label: string;
}

const toOptions = (map: Record<string, string>): EnumOption[] =>
  Object.entries(map).map(([value, label]) => ({ value, label }));

export const bodyLocations = authed.handler(
  async (): Promise<EnumOption[]> => toOptions(BODY_LOCATION_LABELS),
);

export const failureReasons = authed.handler(
  async (): Promise<EnumOption[]> => toOptions(FAILURE_REASON_LABELS),
);

export const deviceTypes = authed.handler(
  async (): Promise<EnumOption[]> => toOptions(DEVICE_TYPE_LABELS),
);
