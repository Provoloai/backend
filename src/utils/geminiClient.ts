import { gemini } from "../config/gemini.config.ts";
import { validateAndCleanJsonResponse, detectSystemOverride, detectApiIssues } from "./responseValidator.ts";

export async function callGemini(prompt: string, systemInstruction: string, maxRetries: number = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[callGemini] Attempt ${attempt}/${maxRetries + 1}`);

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: systemInstruction }] },
          { role: "user", parts: [{ text: prompt }] },
        ],
      });

      if (!response) {
        throw new Error("No response received from Gemini");
      }

      let responseText = "";

      if (typeof response.text === "string") {
        responseText = response.text;
      } else if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        responseText = response.candidates[0].content.parts[0].text;
      } else {
        console.error("[callGemini] Unexpected response structure:", JSON.stringify(response, null, 2));
        throw new Error("Could not extract text from Gemini response");
      }

      if (!responseText || responseText.trim().length === 0) {
        throw new Error("Empty response received from Gemini");
      }

      if (detectApiIssues(responseText)) {
        throw new Error(`API issue detected in response: ${responseText.substring(0, 200)}`);
      }

      if (detectSystemOverride(responseText)) {
        console.log("[callGemini] System override response detected, returning as-is");
        return responseText.trim();
      }

      const validation = validateAndCleanJsonResponse(responseText);
      if (!validation.isValid) {
        if (attempt <= maxRetries) {
          console.warn(`[callGemini] Invalid JSON on attempt ${attempt}, retrying... Error: ${validation.error}`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        } else {
          throw new Error(`Invalid JSON after ${maxRetries + 1} attempts: ${validation.error}`);
        }
      }

      console.log(`[callGemini] Success on attempt ${attempt}. Response length: ${responseText.length} characters`);
      console.log(`[callGemini] Response preview: ${responseText.substring(0, 100)}...`);

      return validation.cleanedResponse || responseText.trim();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[callGemini] Attempt ${attempt} failed:`, lastError.message);

      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(`[callGemini] All ${maxRetries + 1} attempts failed`);
  throw new Error(`Gemini API call failed after ${maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`);
}
