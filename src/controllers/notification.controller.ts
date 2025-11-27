import type { Response, Request } from "express";
import {
  getUserNotifications,
  deleteUserNotification,
  broadcastToAll,
  broadcastToTier,
} from "../services/notification.service.ts";
import { newErrorResponse, newSuccessResponse } from "../utils/apiResponse.ts";

// --- User-facing Controllers ---
export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.userID)
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));

    const { limit, startAfter } = req.query;

    const limitStr = limit as string | undefined;
    const parsedLimit = limitStr ? parseInt(limitStr, 10) : undefined;

    const options: { limit?: number; startAfter?: string } = {};
    if (parsedLimit !== undefined && !Number.isNaN(parsedLimit)) {
      options.limit = parsedLimit;
    }
    if (startAfter !== undefined) {
      options.startAfter = startAfter as string;
    }

    const result = await getUserNotifications(req.userID, options);
    res
      .status(200)
      .json(
        newSuccessResponse(
          "Notifications fetched successfully",
          "Notifications retrieved",
          result
        )
      );
  } catch (error) {
    console.error("[getMyNotifications] Error fetching notifications:", error);
    res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "Failed to retrieve your notifications. Please try again later."
        )
      );
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    if (!req.userID)
      return res
        .status(401)
        .json(newErrorResponse("Unauthorized", "User not authenticated"));

    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json(
          newErrorResponse("Invalid Request", "Notification ID is required")
        );
    }
    const wasDeleted = await deleteUserNotification(id, req.userID);

    if (!wasDeleted) {
      return res
        .status(404)
        .json(
          newErrorResponse(
            "Not Found",
            "Notification not found or access denied"
          )
        );
    }

    res
      .status(200)
      .json(
        newSuccessResponse(
          "Notification Deleted",
          "Notification deleted successfully",
          null
        )
      );
  } catch (error) {
    console.error("[deleteNotification] Error deleting notification:", error);
    res
      .status(500)
      .json(
        newErrorResponse(
          "Internal Server Error",
          "Failed to delete notification. Please try again later."
        )
      );
  }
};

// --- Admin Broadcast Controllers ---
export const broadcastToAllUsers = async (req: Request, res: Response) => {
  try {
    const { title, message, link } = req.body;
    if (!title || !message) {
      return res
        .status(400)
        .json(
          newErrorResponse("Invalid Request", "Title and message are required")
        );
    }

    await broadcastToAll(title, message, link);
    res
      .status(202)
      .json(
        newSuccessResponse(
          "Broadcast Initiated",
          "Broadcast to all users initiated.",
          null
        )
      );
  } catch (error) {
    res
      .status(500)
      .json(
        newErrorResponse("Broadcast Error", "Error broadcasting notification")
      );
  }
};

export const broadcastToTierController = async (
  req: Request,
  res: Response
) => {
  try {
    const { tierSlug } = req.params;
    const { title, message, link } = req.body;

    if (!tierSlug) {
      return res
        .status(400)
        .json(
          newErrorResponse("Invalid Request", "tierSlug parameter is required")
        );
    }

    if (!title || !message) {
      return res
        .status(400)
        .json(
          newErrorResponse("Invalid Request", "Title and message are required")
        );
    }

    await broadcastToTier(tierSlug, title, message, link);
    res
      .status(202)
      .json(
        newSuccessResponse(
          "Broadcast Initiated",
          `Broadcast to tier '${tierSlug}' initiated.`,
          null
        )
      );
  } catch (error) {
    res
      .status(500)
      .json(newErrorResponse("Broadcast Error", "Error broadcasting to tier"));
  }
};
