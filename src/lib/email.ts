import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Please set it in your environment variables."
    );
  }
  if (!resend) {
    resend = new Resend(apiKey);
  }
  return resend;
}

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  const from = process.env.EMAIL_FROM || "Potter's Wheel <noreply@potterswheel.com>";

  if (!to) {
    throw new Error("Recipient email address is required");
  }

  const { data, error } = await getResend().emails.send({
    from,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(`Failed to send email to ${to}: ${error.message}`);
  }

  return data;
}
