import nodemailer from "nodemailer";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function roleLabel(role: string): string {
  return role === "VIEWER" ? "view and comment" : "edit";
}

export async function sendProjectInviteEmail(params: {
  to: string;
  inviterName: string;
  projectName: string;
  role: string;
  inviteUrl: string;
}): Promise<{ sent: boolean; devPreview?: string }> {
  const from = process.env.SMTP_FROM!;
  const permission = roleLabel(params.role);

  const subject = `${params.inviterName} invited you to “${params.projectName}” on Manifold`;
  const text = [
    `${params.inviterName} invited you to collaborate on “${params.projectName}” on Manifold.`,
    ``,
    `You’ll be able to ${permission} on this manuscript.`,
    ``,
    `Open the invitation:`,
    params.inviteUrl,
    ``,
    `This link expires in 14 days.`,
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1d27; max-width: 520px;">
      <p><strong>${escapeHtml(params.inviterName)}</strong> invited you to collaborate on
      <strong>${escapeHtml(params.projectName)}</strong> on Manifold.</p>
      <p>You’ll be able to <strong>${permission}</strong> on this manuscript.</p>
      <p style="margin: 28px 0;">
        <a href="${params.inviteUrl}" style="display: inline-block; background: #6c9eff; color: #0f1117; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600;">
          Open manuscript
        </a>
      </p>
      <p style="font-size: 13px; color: #5c6370;">Or copy this link:<br>
      <a href="${params.inviteUrl}">${params.inviteUrl}</a></p>
      <p style="font-size: 12px; color: #8b92a8;">This invitation expires in 14 days.</p>
    </div>
  `.trim();

  if (!isEmailConfigured()) {
    console.log("[email:dev] Project invite (SMTP not configured)");
    console.log(`  To: ${params.to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  URL: ${params.inviteUrl}`);
    return { sent: false, devPreview: params.inviteUrl };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from,
    to: params.to,
    subject,
    text,
    html,
  });

  return { sent: true };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
