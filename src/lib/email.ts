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

/**
 * Validates that the email configuration is ready for sending.
 * Returns null if valid, or an error message string if not.
 */
export function validateEmailConfig(): string | null {
  if (!process.env.RESEND_API_KEY) {
    return "RESEND_API_KEY environment variable is not set. Emails cannot be sent.";
  }
  const from = process.env.EMAIL_FROM;
  if (!from) {
    return "EMAIL_FROM environment variable is not set. Using default which may not work with your Resend account. Please set EMAIL_FROM to a verified domain address.";
  }
  return null;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  const from = process.env.EMAIL_FROM || "Potter's Wheel <noreply@potterswheel.com>";

  if (!to) {
    throw new Error("Recipient email address is required");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`Invalid recipient email address format: "${to}"`);
  }

  try {
    const { data, error } = await getResend().emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
    });

    if (error) {
      console.error(`Resend API error for ${to}:`, JSON.stringify(error));
      throw new Error(`Resend API error for ${to}: ${error.message}`);
    }

    console.log(`Email sent successfully to ${to}, id: ${data?.id}`);
    return data;
  } catch (err) {
    // Re-throw if it's already our formatted error
    if (err instanceof Error && err.message.startsWith("Resend API error")) {
      throw err;
    }
    // Network or SDK-level error
    console.error(`Email send failed for ${to}:`, err);
    throw new Error(
      `Failed to send email to ${to}: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
