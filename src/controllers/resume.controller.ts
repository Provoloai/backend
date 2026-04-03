import type { Request, Response } from "express";
import multer from "multer";
import { newErrorResponse, newSuccessResponse } from "../utils/apiResponse.ts";
import type { SaveResumeRequest, Resume } from "../types/resume.ts";
import { resumeService } from "../services/resume.service.ts";
import { importResumeFromPdf } from "../services/resume-import.service.ts";

const MAX_RESUME_IMPORT_SIZE = 5 * 1024 * 1024;

const resumePdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_IMPORT_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const isPdf =
      file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);

    if (!isPdf) {
      callback(new Error("Only PDF resumes are supported"));
      return;
    }

    callback(null, true);
  },
}).single("resume");

function runResumePdfUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    resumePdfUpload(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export const saveResume = async (req: Request, res: Response) => {
  try {
    const { resumeId, title, content, template } =
      req.body as SaveResumeRequest;
    const uid = req.userID;

    if (!uid) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    if (!content) {
      return res
        .status(400)
        .json(newErrorResponse("Bad Request", "Content is required"));
    }

    const resumeData: Partial<Resume> = {
      title: title || "Untitled Resume",
      template: template || "classic",
      content,
    };

    if (resumeId) {
      try {
        await resumeService.updateResume(uid, resumeId, resumeData);
        return res.json(
          newSuccessResponse("Success", "Resume updated successfully", {
            id: resumeId,
          }),
        );
      } catch (error: any) {
        if (
          error.message === "Resume not found" ||
          error.message === "Unauthorized access to this resume"
        ) {
          return res
            .status(error.message === "Resume not found" ? 404 : 403)
            .json(
              newErrorResponse(
                error.message === "Resume not found"
                  ? "Not Found"
                  : "Forbidden",
                error.message,
              ),
            );
        }
        throw error;
      }
    } else {
      try {
        const quotaResult = await resumeService.validateResumeQuota(uid);
        if (!quotaResult.allowed) {
          const limitText =
            quotaResult.limit === -1
              ? "unlimited"
              : quotaResult.limit.toString();
          return res
            .status(429)
            .json(
              newErrorResponse(
                "Quota Exceeded",
                `You’ve used up your available monthly resume creation quota. Please upgrade your plan for unlimited resumes. Current usage: ${quotaResult.count}/${limitText}.`,
              ),
            );
        }
      } catch (err) {
        console.error("Quota check error:", err);
        return res
          .status(500)
          .json(
            newErrorResponse("Internal Server Error", "Failed to check quota"),
          );
      }

      const newResume = await resumeService.createResume(uid, resumeData);

      return res.json(
        newSuccessResponse("Success", "Resume created successfully", {
          id: newResume.id,
        }),
      );
    }
  } catch (error) {
    console.error("Save Resume Error:", error);
    return res
      .status(500)
      .json(newErrorResponse("Internal Server Error", "Failed to save resume"));
  }
};

export const listResumes = async (req: Request, res: Response) => {
  try {
    const uid = req.userID;
    if (!uid) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    const resumes = await resumeService.getResumes(uid);

    return res.json(
      newSuccessResponse("Success", "Resumes fetched successfully", resumes),
    );
  } catch (error) {
    console.error("List Resumes Error:", error);
    return res
      .status(500)
      .json(
        newErrorResponse("Internal Server Error", "Failed to fetch resumes"),
      );
  }
};

export const importResumePdf = async (req: Request, res: Response) => {
  try {
    const uid = req.userID;

    if (!uid) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    await runResumePdfUpload(req, res);

    if (!req.file) {
      return res
        .status(400)
        .json(newErrorResponse("Bad Request", "Resume PDF is required"));
    }

    const importedResume = await importResumeFromPdf(
      req.file.buffer,
      req.file.originalname,
    );

    return res.json(
      newSuccessResponse(
        "Success",
        "Resume PDF imported successfully",
        importedResume,
      ),
    );
  } catch (error) {
    console.error("Import Resume PDF Error:", error);

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Resume PDF exceeds the 5MB upload limit"
          : error.message;

      return res.status(400).json(newErrorResponse("Bad Request", message));
    }

    if (error instanceof Error) {
      return res
        .status(400)
        .json(newErrorResponse("Bad Request", error.message));
    }

    return res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "Failed to import resume PDF",
        ),
      );
  }
};

export const getResumeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const uid = req.userID;

    if (!uid) {
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));
    }

    if (!id) {
      return res
        .status(400)
        .json(newErrorResponse("Bad Request", "Resume ID is required"));
    }

    try {
      const resume = await resumeService.getResumeById(uid, id);
      return res.json(
        newSuccessResponse("Success", "Resume fetched successfully", resume),
      );
    } catch (error: any) {
      if (
        error.message === "Resume not found" ||
        error.message === "Unauthorized access to this resume"
      ) {
        return res
          .status(error.message === "Resume not found" ? 404 : 403)
          .json(
            newErrorResponse(
              error.message === "Resume not found" ? "Not Found" : "Forbidden",
              error.message,
            ),
          );
      }
      throw error;
    }
  } catch (error) {
    console.error("Get Resume Error:", error);
    return res
      .status(500)
      .json(newErrorResponse("Internal Server Error", "Error fetching resume"));
  }
};
