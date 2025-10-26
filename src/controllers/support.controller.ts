import type { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sendSupportEmail } from "../services/mail.service.ts";
import { validateFiles, type FileAttachment, formatFileSize } from "../utils/fileValidation.utils.ts";
import { newSuccessResponse, newErrorResponse } from "../utils/apiResponse.ts";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "support");
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent conflicts
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file (matches video limit from validation)
    files: 5, // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    // Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.mp4', '.mpeg', '.mov', '.webm'];
    
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedExts.join(', ')}`));
    }
  },
});

export const uploadSupportFiles: ReturnType<typeof upload.array> = upload.array('attachments', 5);

export const submitSupportTicket = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;
    
    // Debug: log what we're receiving
    console.log("[submitSupportTicket] Request body:", req.body);

    // Validate required fields
    if (!name || !email || !message) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Name, email, and message are required."
          )
        );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json(
          newErrorResponse(
            "Invalid Request",
            "Please provide a valid email address."
          )
        );
    }

    // Handle file attachments
    let attachments: FileAttachment[] | undefined;

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log(`[submitSupportTicket] Processing ${req.files.length} attachment(s)`);

      // Convert multer files to FileAttachment format
      attachments = req.files.map((file: Express.Multer.File) => ({
        filename: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
      }));

      // Validate all files
      const validationResult = await validateFiles(attachments);
      
      if (!validationResult.isValid) {
        // Clean up uploaded files on validation failure
        attachments.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });

        return res
          .status(400)
          .json(
            newErrorResponse(
              "File Validation Failed",
              validationResult.errors?.join("\n") || "One or more files failed validation."
            )
          );
      }

      // Log attachment info
      const totalSize = attachments.reduce((sum, file) => sum + file.size, 0);
      console.log(`[submitSupportTicket] Attachments validated: ${attachments.length} files, ${formatFileSize(totalSize)} total`);
    }

    // Send support emails
    const result = await sendSupportEmail({
      name,
      email,
      subject,
      message,
      ...(attachments && attachments.length > 0 && { attachments }),
    });

    if (!result.success) {
      // Clean up uploaded files on email failure
      if (attachments) {
        attachments.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      return res
        .status(500)
        .json(
          newErrorResponse(
            "Email Error",
            result.error || "Failed to send support emails"
          )
        );
    }

    // Clean up uploaded files after successful email
    if (attachments) {
      // Schedule cleanup after a short delay to ensure email is sent
      setTimeout(() => {
        attachments!.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`[submitSupportTicket] Cleaned up file: ${file.filename}`);
          }
        });
      }, 5000); // 5 second delay
    }

    return res
      .status(200)
      .json(
        newSuccessResponse(
          "Support Request Submitted",
          "Your support request has been received. We'll get back to you within 24-48 hours.",
          {
            messageId: result.messageId,
            attachmentsCount: attachments?.length || 0,
          }
        )
      );
  } catch (err) {
    console.error("[submitSupportTicket] Error:", err);

    // Clean up uploaded files on error
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file: Express.Multer.File) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    return res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "An error occurred. Please try again or contact support."
        )
      );
  }
};

