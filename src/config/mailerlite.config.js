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


export default mailerlite;
