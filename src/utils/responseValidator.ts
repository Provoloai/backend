export interface ValidationResult {
  isValid: boolean;
  cleanedResponse?: string;
  error?: string;
}

export function validateAndCleanJsonResponse(response: string): ValidationResult {
  if (!response || response.trim().length === 0) {
    return { isValid: false, error: "Empty response" };
  }

  try {
    JSON.parse(response);
    return { isValid: true, cleanedResponse: response };
  } catch (e) {
    // Continue to cleaning attempts
  }

  let cleaned = response.replace(/```json\s*\n?/gi, "").replace(/```\s*\n?/g, "");
  try {
    JSON.parse(cleaned);
    return { isValid: true, cleanedResponse: cleaned };
  } catch (e) {
    // Continue to next attempt
  }

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[0]);
      return { isValid: true, cleanedResponse: jsonMatch[0] };
    } catch (e) {
      // Continue to next attempt
    }
  }

  cleaned = response
    .replace(/^[^{]*/, "")
    .replace(/[^}]*$/, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  try {
    JSON.parse(cleaned);
    return { isValid: true, cleanedResponse: cleaned };
  } catch (e) {
    // Continue to next attempt
  }

  cleaned = response
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .replace(/,(\s*[}\]])/g, "$1")
    .trim();

  const betterJsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (betterJsonMatch) {
    try {
      JSON.parse(betterJsonMatch[0]);
      return { isValid: true, cleanedResponse: betterJsonMatch[0] };
    } catch (e) {
      // Final attempt failed
    }
  }

  return {
    isValid: false,
    error: `Could not extract valid JSON from response. Response preview: ${response.substring(0, 200)}...`,
  };
}

export function detectSystemOverride(response: string): boolean {
  const overridePatterns = [
    /system instruction override/i,
    /ignore instruction/i,
    /change format/i,
    /script injection/i,
    /format manipulation/i,
    /"error":\s*true/i,
    /"code":\s*"[A-Z_]+"/i,
  ];

  return overridePatterns.some((pattern) => pattern.test(response));
}

export function detectApiIssues(response: string): boolean {
  const apiIssuePatterns = [/rate limit/i, /quota exceeded/i, /service unavailable/i, /internal server error/i, /timeout/i];

  return apiIssuePatterns.some((pattern) => pattern.test(response));
}
