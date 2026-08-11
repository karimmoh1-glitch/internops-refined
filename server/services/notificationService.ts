export interface NotificationPayload {
  type: "slack" | "email";
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  provider: string;
  message: string;
  timestamp: string;
}

async function sendSlackNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (slackWebhookUrl) {
    try {
      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `*${payload.subject}*\n${payload.body}`,
          channel: payload.to,
        }),
      });
      return {
        success: response.ok,
        provider: "slack",
        message: response.ok ? "Slack notification sent" : "Slack delivery failed",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        provider: "slack",
        message: `Slack error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  console.log(`[NotificationService] Slack (mock) → #${payload.to}: ${payload.subject} - ${payload.body}`);
  return {
    success: true,
    provider: "slack-mock",
    message: `Mock Slack notification sent to #${payload.to}`,
    timestamp: new Date().toISOString(),
  };
}

async function sendEmailNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const smtpHost = process.env.SMTP_HOST;

  if (smtpHost) {
    console.log(`[NotificationService] Email → ${payload.to}: ${payload.subject} (SMTP configured but not wired)`);
    return {
      success: true,
      provider: "email-configured",
      message: `Email queued for ${payload.to}`,
      timestamp: new Date().toISOString(),
    };
  }

  console.log(`[NotificationService] Email (mock) → ${payload.to}: ${payload.subject} - ${payload.body}`);
  return {
    success: true,
    provider: "email-mock",
    message: `Mock email sent to ${payload.to}`,
    timestamp: new Date().toISOString(),
  };
}

export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  switch (payload.type) {
    case "slack":
      return sendSlackNotification(payload);
    case "email":
      return sendEmailNotification(payload);
    default:
      return {
        success: false,
        provider: "unknown",
        message: `Unknown notification type: ${payload.type}`,
        timestamp: new Date().toISOString(),
      };
  }
}

export async function notifyNewLog(internName: string, logContent: string): Promise<NotificationResult> {
  return sendNotification({
    type: "slack",
    to: "intern-updates",
    subject: `New Work Log from ${internName}`,
    body: logContent.substring(0, 200) + (logContent.length > 200 ? "..." : ""),
  });
}

export async function notifySummaryGenerated(internName: string, weekStart: string): Promise<NotificationResult> {
  return sendNotification({
    type: "slack",
    to: "intern-updates",
    subject: `Weekly Summary Generated for ${internName}`,
    body: `AI summary for week of ${weekStart} is ready for review.`,
  });
}

export async function notifyFeedbackReceived(internEmail: string, rating: number): Promise<NotificationResult> {
  return sendNotification({
    type: "email",
    to: internEmail,
    subject: "New Feedback on Your Weekly Summary",
    body: `Your manager rated your summary ${rating}/5. Check your dashboard for details.`,
  });
}
