/** Only persist sent state after SMTP accepts the message. */
export async function deliverAndRecordReminder(
  send: () => Promise<boolean>,
  record: () => Promise<unknown>,
): Promise<boolean> {
  if (!(await send())) return false;
  await record();
  return true;
}
