import { z } from "zod";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters long")
  .max(30, "Username must be at most 30 characters long")
  .regex(
    /^[a-zA-Z0-9_\- ]+$/,
    "Username can only contain letters, numbers, underscores, hyphens, and spaces"
  )
  .refine(
    (val) => !val.startsWith("-") && !val.startsWith(" "),
    "Username cannot start with a hyphen or space"
  )
  .refine(
    (val) => !val.endsWith("-") && !val.endsWith(" "),
    "Username cannot end with a hyphen or space"
  )
  .refine(
    (val) => !val.includes("--") && !val.includes("__"),
    "Username cannot contain consecutive hyphens or underscores"
  );

export function validateUsername(username: any): {
  isValid: boolean;
  error?: string;
} {
  const result = usernameSchema.safeParse(username);

  if (!result.success) {
    return {
      isValid: false,
      error: result.error.issues[0]?.message || "Invalid username",
    };
  }

  return { isValid: true };
}
