import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import "dotenv/config";

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types
import type { TransportOptions } from "nodemailer";

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface WelcomeEmailData {
  name: string;
  email: string;
}

// Create transporter instance
const createTransporter = (): nodemailer.Transporter => {
  // Debug environment variables
  console.log("Email config check:", {
    EMAIL_HOST: process.env.EMAIL_HOST ? "✅ Set" : "❌ Missing",
    EMAIL_USER: process.env.EMAIL_USER ? "✅ Set" : "❌ Missing", 
    EMAIL_PASS: process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing",
    EMAIL_FROM: process.env.EMAIL_FROM ? "✅ Set" : "❌ Missing"
  });

  // Validate required environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Missing required email credentials: EMAIL_USER and EMAIL_PASS must be set");
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: 465,
    secure: true,
    service: "gmail",
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
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
    });

    console.log(`Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    
    // Provide more specific error messages
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.message.includes("Missing credentials")) {
        errorMessage = "Email credentials not configured. Please check EMAIL_USER and EMAIL_PASS environment variables.";
      } else if (error.message.includes("EAUTH")) {
        errorMessage = "Email authentication failed. Please check your email credentials.";
      } else if (error.message.includes("ECONNECTION")) {
        errorMessage = "Failed to connect to email server. Please check EMAIL_HOST and EMAIL_PORT.";
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
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
