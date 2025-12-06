import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import env from "@/lib/env-validator.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

type EmailTemplate = "welcome" | "forgot-password" | "password-reset" | "otp";

type EmailOptionsPayload = {
  otp?: string | number;
  username?: string;
  reset_link?: string;
  login_link?: string;
  // biome-ignore lint/suspicious/noExplicitAny: <...>
  [key: string]: any;
};

interface EmailOptions {
  to: string;
  subject: string;
  template: EmailTemplate;
  payload: EmailOptionsPayload;
}

export class Mailer {
  private transporter: nodemailer.Transporter;
  private templateCache: Map<EmailTemplate, string>;

  constructor() {
    this.templateCache = new Map();
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: 587, // Standard secure port, use 465 if secure: true
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  /**
   * Loads template from disk (or cache) and replaces {{ key }} with values
   */
  private async loadAndProcessTemplate(
    templateName: EmailTemplate,
    payload: EmailOptionsPayload,
  ): Promise<string> {
    let htmlContent = this.templateCache.get(templateName);

    // 1. Load from disk if not in cache
    if (!htmlContent) {
      const templatePath = path.join(
        __dirname,
        `../templates/${templateName}.template.html`,
      );
      try {
        htmlContent = await fs.readFile(templatePath, "utf8");
        this.templateCache.set(templateName, htmlContent);
      } catch (error) {
        console.error(`Error reading template '${templateName}':`, error);
        throw new Error(`Failed to load email template: ${templateName}`);
      }
    }

    // 2. Replace {{ key }} with payload values using a single regex pass
    return htmlContent.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return payload[key] !== undefined ? String(payload[key]) : "";
    });
  }

  public async sendMail({
    to,
    subject,
    template,
    payload,
  }: EmailOptions): Promise<void> {
    // 1. DEV MODE: Log to console instead of sending real email
    if (env.ENV === "development") {
      console.log(`\n📧 [DEV EMAIL] To: ${to} | Template: ${template}`);
      console.log(`📦 Payload:`, payload);
      console.log(
        `🔗 Quick Link: ${payload.reset_link || payload.login_link || "N/A"}`,
      );
      console.log(`🔑 OTP: ${payload.otp || "N/A"}\n`);
      return;
    }

    try {
      const emailHtml = await this.loadAndProcessTemplate(template, payload);

      const mailOptions = {
        from: '"TaskMint" <no-reply@taskmint.com>',
        to,
        subject,
        html: emailHtml,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("Email sent successfully: %s", info.messageId);
    } catch (error) {
      console.error("Error sending email:", error);
      // Don't crash the app if email fails, just log it
      throw new Error("Failed to send email.");
    }
  }
}

const mailer = new Mailer();
export default mailer;
