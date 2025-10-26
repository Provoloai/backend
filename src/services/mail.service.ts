import nodemailer from "nodemailer";
import type { SendMailOptions, TransportOptions } from "nodemailer";

type Attachment = {
  filename?: string;
  path?: string;
  content?: string | Buffer;
  contentType?: string;
  cid?: string;
  encoding?: string;
  href?: string;
  httpHeaders?: Record<string, string>;
};
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import "dotenv/config";
import type { FileAttachment } from "../utils/fileValidation.utils.ts";

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
}

interface WelcomeEmailData {
  name: string;
  email: string;
}

interface SupportEmailData {
  name: string;
  email: string;
  subject?: string;
  message: string;
  attachments?: FileAttachment[];
}

// Create transporter instance
const createTransporter = (): nodemailer.Transporter => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
  } as TransportOptions);
};

// Load email template
const loadEmailTemplate = (templateName: string): string => {
  try {
    const templatePath = path.join(
      __dirname,
      "..",
      "mails",
      `${templateName}.html`
    );
    return fs.readFileSync(templatePath, "utf8");
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    throw new Error(`Email template ${templateName} not found`);
  }
};

// Replace template variables
const replaceTemplateVariables = (
  template: string,
  variables: Record<string, string>
): string => {
  let processedTemplate = template;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    processedTemplate = processedTemplate.replace(placeholder, value);
  });

  return processedTemplate;
};

// Send mail function
const sendMail = async (
  mailOptions: MailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const transporter = createTransporter();
    const mailData: SendMailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      ...(mailOptions.text && { text: mailOptions.text }),
      ...(mailOptions.attachments && mailOptions.attachments.length > 0 && { attachments: mailOptions.attachments }),
    };

    const info = await transporter.sendMail(mailData);

    console.log(`Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Send welcome email
export const sendWelcomeEmail = async (
  data: WelcomeEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // Load the welcome email template
    const template = loadEmailTemplate("welcome_email");

    // Replace template variables
    const htmlContent = replaceTemplateVariables(template, {
      name: data.name,
      email: data.email,
    });

    // Send the email
    return await sendMail({
      to: data.email,
      subject: "Welcome to Provolo! 🎉",
      html: htmlContent,
      text: `Welcome to Provolo, ${data.name}! We're excited to have you on board.`,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send welcome email",
    };
  }
};

// Send premium welcome email
export const sendPremiumWelcomeEmail = async (
  email: string,
  name?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // Load the premium welcome email template
    const template = loadEmailTemplate("premium_welcome_email");

    // Replace template variables
    const htmlContent = replaceTemplateVariables(template, {
      name: name || email.split("@")[0] || "User", // Use email prefix if no name provided
      email: email,
    });

    // Send the email
    return await sendMail({
      to: email,
      subject: "🎉 Welcome to Provolo Pro! Your premium journey starts now",
      html: htmlContent,
      text: `Welcome to Provolo Pro! You now have access to all our premium features and unlimited possibilities.`,
    });
  } catch (error) {
    console.error("Error sending premium welcome email:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send premium welcome email",
    };
  }
};

const convertToNodemailerAttachments = (
  attachments?: FileAttachment[]
): Attachment[] => {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments.map((file) => ({
    filename: file.filename,
    path: file.path,
    contentType: file.mimetype,
  }));
};

export const sendSupportEmail = async (
  data: SupportEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const adminTemplate = loadEmailTemplate("support_ticket_to_admin");

    const adminVariables = {
      name: data.name,
      email: data.email,
      subject: data.subject || "Support Request",
      message: data.message,
    };

    const adminHtmlContent = replaceTemplateVariables(adminTemplate, adminVariables);

    const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || "";

    if (!supportEmail) {
      throw new Error("Support email address not configured");
    }

    const nodemailerAttachments = convertToNodemailerAttachments(data.attachments);

    let emailText = `New Support Ticket\n\nFrom: ${data.name} (${data.email})\nSubject: ${data.subject || "Support Request"}\n\nMessage:\n${data.message}\n\n`;
    if (nodemailerAttachments.length > 0) {
      emailText += `Attachments: ${nodemailerAttachments.map((att) => att.filename).join(", ")}\n\n`;
    }

    const transporter = createTransporter();
    const mailData: SendMailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER!,
      to: supportEmail,
      replyTo: data.email,
      subject: `New Support Ticket: ${data.subject || "Provolo Support"}`,
      html: adminHtmlContent,
      text: emailText,
      ...(nodemailerAttachments.length > 0 && { attachments: nodemailerAttachments }),
    };

    const info = await transporter.sendMail(mailData);

    console.log(`Support email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending support email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send support email",
    };
  }
};

// Send custom email
export const sendCustomEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const mailOptions: MailOptions = {
    to,
    subject,
    html,
  };

  if (text) {
    mailOptions.text = text;
  }

  return await sendMail(mailOptions);
};

// Test email configuration
export const testEmailConnection = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("Email service connection verified successfully");
    return { success: true };
  } catch (error) {
    console.error("Email service connection failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
};

// Export default transporter for backward compatibility
export const transporter = createTransporter();
export default transporter;
