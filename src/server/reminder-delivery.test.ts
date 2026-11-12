import { describe, expect, it, vi } from "vitest";
import { deliverAndRecordReminder } from "~/server/reminder-delivery";

describe("reminder delivery", () => {
  it("keeps failed SMTP delivery eligible for retry", async () => {
    const record = vi.fn();
    expect(await deliverAndRecordReminder(async () => false, record)).toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it("records a reminder after SMTP accepts it", async () => {
    const record = vi.fn();
    expect(await deliverAndRecordReminder(async () => true, record)).toBe(true);
    expect(record).toHaveBeenCalledOnce();
  });
});
