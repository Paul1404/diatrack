interface ReminderTemplateData {
  deviceTypeLabel: string;
  bodyLocation: string;
  hoursRemaining: number;
  startTime: string;
  color: string;
  appUrl: string;
}

export function reminderEmailHtml(data: ReminderTemplateData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0052CC; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #F4F5F7; padding: 20px; border-radius: 0 0 8px 8px; }
    .device-card { background: white; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid ${data.color}; }
    .device-type { font-weight: bold; color: #172B4D; }
    .location { color: #6B778C; }
    .time-remaining { font-size: 18px; color: ${data.color}; font-weight: bold; }
    .cta { display: inline-block; background: #0052CC; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">DiaTrack Erinnerung</h1>
    </div>
    <div class="content">
      <p>Hallo,</p>
      <p>Dein ${data.deviceTypeLabel} läuft bald ab:</p>
      <div class="device-card">
        <div class="device-type">${data.deviceTypeLabel}</div>
        <div class="location">${data.bodyLocation}</div>
        <div class="time-remaining">Noch ca. ${data.hoursRemaining} Stunden</div>
        <p style="margin: 5px 0; color: #6B778C;">Gestartet: ${data.startTime}</p>
      </div>
      <p>Bitte plane den Wechsel rechtzeitig ein.</p>
      <a href="${data.appUrl}" class="cta">Dashboard öffnen</a>
      <p style="margin-top: 20px; color: #6B778C; font-size: 12px;">
        Diese E-Mail wurde automatisch von DiaTrack gesendet.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function smtpTestHtml(): string {
  return `<!DOCTYPE html>
<html>
<body>
  <h1>DiaTrack Test-E-Mail</h1>
  <p>Diese E-Mail bestätigt, dass die SMTP-Einstellungen korrekt konfiguriert sind.</p>
</body>
</html>`;
}
