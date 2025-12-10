import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import env from "@/lib/env-validator.js";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

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
      port: 2525,
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      logger: true,
      debug: true,
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
        from: `"TaskMint" <${env.EMAIL_ADDR}>`,
        to,
        subject,
        html: emailHtml,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("Email sent successfully: %s", info.messageId);
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email.");
    }
  }
}

const mailer = new Mailer();
export default mailer;
