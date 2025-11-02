export interface NewUser {
  userId: string;
  email: string;
  displayName: string | null;
  tierId: string;
  mailerliteId: string | null;
  polarId: string | null;
  portfolioLink: string | null;
  professionalTitle: string | null;
  emailVerified: boolean;
  otp: string | null;
  otpExpires: Date | null;
  updatedAt: Date | undefined;
  createdAt: Date | undefined;
}

export interface User extends NewUser {
  id: string;
}
