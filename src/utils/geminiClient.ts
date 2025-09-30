import { gemini } from "../config/gemini.config.ts";

export async function callGemini(prompt: string, systemInstruction: string): Promise<string> {
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: systemInstruction }] },
      { role: "user", parts: [{ text: prompt }] },
    ],
  });
  // Try to extract the text from the response
  if (response && typeof response.text === "string") {
    return response.text;
  }
  // Fallback: try to stringify the whole response for debugging
  return JSON.stringify(response || {});
}
