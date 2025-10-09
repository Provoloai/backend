import "dotenv/config";
import MailerLite from "@mailerlite/mailerlite-nodejs";

// Validate required environment variables
if (!process.env.MAILERLITE_API_KEY || !process.env.MAILERLITE_GROUP_ID) {
  console.error(
    "MailerLite configuration is incomplete. Email subscriptions will be disabled."
  );
}

const mailerlite = new MailerLite({
  api_key: process.env.MAILERLITE_API_KEY,
});

export const subscribeUser = async (name, email) => {
  // Validate inputs
  if (!name || !email) {
    throw new Error("Name and email are required for subscription");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  // Check if required environment variables are set
  if (!process.env.MAILERLITE_API_KEY || !process.env.MAILERLITE_GROUP_ID) {
    throw new Error("MailerLite configuration is incomplete");
  }

  try {
    const result = await mailerlite.subscribers.createOrUpdate({
      email,
      fields: {
        name: name.trim(),
      },
      groups: [process.env.MAILERLITE_GROUP_ID],
      status: "active",
      subscribed_at: new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 19),
      opted_in_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    });

    return result;
  } catch (err) {
    console.error("MailerLite subscription failed:", err);
    throw err;
  }
};

export default mailerlite;
