export interface Notification {
  id: string; // Firestore document ID
  recipient: string; // Corresponds to a User's ID (UID)
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: FirebaseFirestore.Timestamp;
}
