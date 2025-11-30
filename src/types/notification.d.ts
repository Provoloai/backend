export enum NotificationCategory {
  SYSTEM = "system",
  USER = "user",
  PROMOTION = "promotion",
  ADMIN = "admin",
  OTHER = "other",
}

export interface Notification {
  id: string; // Firestore document ID
  recipient: string; // Corresponds to a User's ID (UID)
  title: string;
  message: string;
  read: boolean;
  link?: string;
  category: NotificationCategory;
  createdAt: FirebaseFirestore.Timestamp;
}
