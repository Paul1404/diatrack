import type { BodyLocation, DeviceType, EmailStatus, FailureReason } from "~/server/db/schema";

// German labels. Kept server-side so the API stays the source of truth for copy.

export const BODY_LOCATION_LABELS: Record<BodyLocation, string> = {
  abdomen_left: "Bauch links",
  abdomen_right: "Bauch rechts",
  thigh_left: "Oberschenkel links",
  thigh_right: "Oberschenkel rechts",
  upper_arm_left: "Oberarm links",
  upper_arm_right: "Oberarm rechts",
  buttock_left: "Gesäß links",
  buttock_right: "Gesäß rechts",
  lower_back_left: "Unterer Rücken links",
  lower_back_right: "Unterer Rücken rechts",
};

export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
  clogged: "Verstopft",
  fell_off: "Abgefallen / Pflaster löst sich",
  sensor_error: "Sensor-Fehler / Keine Werte",
  skin_reaction: "Hautreaktion / Rötung",
  other: "Sonstiges",
};

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  sensor: "Sensor",
  catheter: "Katheter",
};

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  success: "Erfolgreich",
  failed: "Fehlgeschlagen",
  skipped: "Übersprungen",
};

export function bodyLocationLabel(loc: BodyLocation): string {
  return BODY_LOCATION_LABELS[loc] ?? loc;
}
