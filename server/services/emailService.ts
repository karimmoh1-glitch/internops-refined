import { Resend } from "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

const sentEmails: EmailMessage[] = [];

function getFromEmail(): string {
  return process.env.EMAIL_FROM || "InternOps <noreply@internops.dev>";
}

// Platform-level recipients notified on every new application, in addition
// to the applying company's own admin users (who are notified separately,
// via their real account emails, same as every other admin notification in
// this file). Configured entirely through environment — never hardcoded,
// so this file has no knowledge of any specific person's address.
export function getAdminNotificationEmails(): string[] {
  return (process.env.ADMIN_NOTIFICATION_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

function getResendClient(): { client: Resend; fromEmail: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[RESEND] No RESEND_API_KEY environment variable found");
    return null;
  }
  return {
    client: new Resend(apiKey),
    fromEmail: getFromEmail(),
  };
}

function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<div style="background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden">
<div style="background:linear-gradient(135deg,#EF7878 0%,#e85d5d 100%);padding:24px 28px">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">InternOps</h1>
</div>
<div style="padding:28px">
<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:19px;font-weight:600;line-height:1.4">${title}</h2>
${body}
</div>
<div style="padding:16px 28px;background:#fafafa;border-top:1px solid #f0f0f0">
<p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5">This is an automated message from InternOps. Please do not reply directly.</p>
</div>
</div>
</div>
</body>
</html>`;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  sentEmails.push(msg);
  const resend = getResendClient();

  if (!resend) {
    console.log("[MOCK EMAIL] Resend not configured. To: " + msg.to + " | Subject: " + msg.subject);
    return;
  }

  try {
    const result = await resend.client.emails.send({
      from: resend.fromEmail,
      to: [msg.to],
      subject: msg.subject,
      text: msg.body,
      html: msg.html || undefined,
    });
    if (result.error) {
      console.error("[RESEND ERROR]", result.error);
    } else {
      console.log("[EMAIL SENT] To: " + msg.to + " | ID: " + (result.data?.id || "unknown"));
    }
  } catch (err: any) {
    console.error("[EMAIL ERROR] " + err.message);
  }
}

export function getSentEmails(): EmailMessage[] { return sentEmails; }

export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
  return password;
}

export function sendCredentialsEmail(email: string, name: string, role: string, password: string): Promise<void> {
  return sendEmail({
    to: email,
    subject: "Welcome to InternOps - Your " + role + " Account",
    body: "Hello " + name + ",\n\nYour " + role + " account has been created.\nEmail: " + email + "\nPassword: " + password,
    html: emailWrapper("Welcome, " + name + "!", "<p>Your <strong>" + role + "</strong> account has been created.</p><p><strong>Email:</strong> " + email + "<br><strong>Password:</strong> " + password + "</p>"),
  });
}

export function sendVerificationEmail(email: string, verifyLink: string): Promise<void> {
  return sendEmail({
    to: email,
    subject: "Verify your InternOps email address",
    body: "Verify your email: " + verifyLink + "\n\nThis link expires in 24 hours. If you didn't create an InternOps account, you can ignore this email.",
    html: emailWrapper("Verify your email",
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Click the button below to confirm this is your email address. This link expires in 24 hours.</p>" +
      "<div style=\"text-align:center;margin:24px 0\">" +
        "<a href=\"" + verifyLink + "\" style=\"display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#EF7878 0%,#e85d5d 100%);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px\">Verify Email</a>" +
      "</div>" +
      "<p style=\"color:#a1a1aa;font-size:13px;line-height:1.5\">If you didn't create an InternOps account, you can safely ignore this email.</p>"
    ),
  });
}

export function sendInternInviteEmail(email: string, inviteLink: string, companyName: string, inviterName?: string): Promise<void> {
  return sendEmail({
    to: email,
    subject: "Invitation to join " + companyName + " on InternOps",
    body: (inviterName ? inviterName + " invited you" : "You've been invited") + " to join " + companyName + " on InternOps: " + inviteLink + "\n\nThis link expires in 48 hours.",
    html: emailWrapper("Join " + companyName,
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">" + (inviterName ? "<strong>" + inviterName + "</strong> invited you" : "You've been invited") + " to join <strong>" + companyName + "</strong> as an intern on InternOps.</p>" +
      "<div style=\"text-align:center;margin:24px 0\">" +
        "<a href=\"" + inviteLink + "\" style=\"display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#EF7878 0%,#e85d5d 100%);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px\">Accept Invitation</a>" +
      "</div>" +
      "<p style=\"color:#a1a1aa;font-size:13px;line-height:1.5\">This invitation expires in 48 hours.</p>"
    ),
  });
}

export function sendPlanSubmittedEmail(adminEmail: string, internName: string, projectTitle: string, versionNumber: number): Promise<void> {
  return sendEmail({
    to: adminEmail,
    subject: "Plan Review Needed: " + projectTitle,
    body: internName + " submitted plan v" + versionNumber + " for " + projectTitle,
    html: emailWrapper("Plan Review Needed", "<p><strong>" + internName + "</strong> submitted plan v" + versionNumber + " for <strong>" + projectTitle + "</strong>.</p>"),
  });
}

export function sendPlanApprovedEmail(internEmail: string, projectTitle: string, versionNumber: number, comment?: string): Promise<void> {
  return sendEmail({
    to: internEmail,
    subject: "Plan Approved: " + projectTitle,
    body: "Plan v" + versionNumber + " for " + projectTitle + " approved. " + (comment || ""),
    html: emailWrapper("Plan Approved!", "<p>Your plan v" + versionNumber + " for <strong>" + projectTitle + "</strong> has been approved.</p>"),
  });
}

export function sendRevisionRequestedEmail(internEmail: string, projectTitle: string, versionNumber: number, comment: string): Promise<void> {
  return sendEmail({
    to: internEmail,
    subject: "Revision Requested: " + projectTitle,
    body: "Revision requested for plan v" + versionNumber + ": " + comment,
    html: emailWrapper("Revision Requested", "<p>Changes requested for <strong>" + projectTitle + "</strong>: " + comment + "</p>"),
  });
}

export function sendCommentEmail(internEmail: string, managerName: string, projectTitle: string, commentText: string, type: "plan" | "log"): Promise<void> {
  return sendEmail({
    to: internEmail,
    subject: "New Comment: " + projectTitle,
    body: managerName + " commented: " + commentText,
    html: emailWrapper("New Comment", "<p><strong>" + managerName + "</strong> commented: " + commentText + "</p>"),
  });
}

export function sendNewInternJoinedEmail(adminEmail: string, internName: string, companyName: string): Promise<void> {
  return sendEmail({
    to: adminEmail,
    subject: "New Intern Joined: " + internName,
    body: internName + " joined " + companyName,
    html: emailWrapper("New Intern Joined", "<p><strong>" + internName + "</strong> joined <strong>" + companyName + "</strong>.</p>"),
  });
}

export function sendApplicationReceivedEmail(applicantEmail: string, applicantName: string, companyName: string): Promise<void> {
  return sendEmail({
    to: applicantEmail,
    subject: "Your InternOps application has been received",
    body: "Hi " + applicantName + ",\n\nYour application to " + companyName + " has been received and is pending review. We'll email you as soon as there's an update.",
    html: emailWrapper("Application received",
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Hi " + applicantName + ",</p>" +
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Thanks for applying to <strong>" + companyName + "</strong>. Your application has been received and is now pending review.</p>" +
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">We'll email you as soon as there's an update — no action is needed from you right now.</p>"
    ),
  });
}

export function sendNewApplicationAdminEmail(adminEmail: string, applicantName: string, applicantEmail: string, companyName: string, reviewLink: string, details: { skills?: string | null; motivation?: string | null }): Promise<void> {
  const detailRows = [
    details.skills ? "<p style=\"color:#52525b;font-size:14px;line-height:1.6\"><strong>Skills:</strong> " + details.skills + "</p>" : "",
    details.motivation ? "<p style=\"color:#52525b;font-size:14px;line-height:1.6\"><strong>Why they want to join:</strong> " + details.motivation + "</p>" : "",
  ].join("");
  return sendEmail({
    to: adminEmail,
    subject: "New application: " + applicantName + " — " + companyName,
    body: applicantName + " (" + applicantEmail + ") applied to " + companyName + ". Review: " + reviewLink,
    html: emailWrapper("New internship application",
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\"><strong>" + applicantName + "</strong> (" + applicantEmail + ") applied to <strong>" + companyName + "</strong>.</p>" +
      detailRows +
      "<div style=\"text-align:center;margin:24px 0\">" +
        "<a href=\"" + reviewLink + "\" style=\"display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#EF7878 0%,#e85d5d 100%);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px\">Review Application</a>" +
      "</div>"
    ),
  });
}

export function sendApplicationApprovedEmail(applicantEmail: string, applicantName: string, companyName: string, loginLink: string): Promise<void> {
  return sendEmail({
    to: applicantEmail,
    subject: "You're in! Your " + companyName + " application was approved",
    body: "Hi " + applicantName + ",\n\nGreat news — your application to " + companyName + " has been approved. Log in to get started: " + loginLink,
    html: emailWrapper("Application approved!",
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Hi " + applicantName + ",</p>" +
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Great news — your application to <strong>" + companyName + "</strong> has been approved.</p>" +
      "<div style=\"text-align:center;margin:24px 0\">" +
        "<a href=\"" + loginLink + "\" style=\"display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#EF7878 0%,#e85d5d 100%);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px\">Log In</a>" +
      "</div>"
    ),
  });
}

export function sendApplicationRejectedEmail(applicantEmail: string, applicantName: string, companyName: string): Promise<void> {
  return sendEmail({
    to: applicantEmail,
    subject: "Update on your " + companyName + " application",
    body: "Hi " + applicantName + ",\n\nThank you for your interest in " + companyName + ". After careful review, we won't be moving forward with your application at this time. We appreciate the time you took to apply and wish you the best in your search.",
    html: emailWrapper("Application update",
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Hi " + applicantName + ",</p>" +
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Thank you for your interest in <strong>" + companyName + "</strong>. After careful review, we won't be moving forward with your application at this time.</p>" +
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">We appreciate the time you took to apply, and wish you the best in your search.</p>"
    ),
  });
}

export function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  return sendEmail({
    to: email,
    subject: "Reset your InternOps password",
    body: "Reset your password: " + resetLink + "\n\nThis link expires in 1 hour. If you didn't request this, please ignore this email.",
    html: emailWrapper("Reset Your Password", 
      "<p style=\"color:#52525b;font-size:15px;line-height:1.6\">Click the button below to reset your password. This link expires in 1 hour.</p>" +
      "<div style=\"text-align:center;margin:24px 0\">" +
        "<a href=\"" + resetLink + "\" style=\"display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#EF7878 0%,#e85d5d 100%);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px\">Reset Password</a>" +
      "</div>" +
      "<p style=\"color:#a1a1aa;font-size:13px;line-height:1.5\">If you didn't request a password reset, you can safely ignore this email.</p>"
    ),
  });
}
