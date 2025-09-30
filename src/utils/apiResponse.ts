export interface APIResponse<T = any> {
  title: string;
  message: string;
  status: "success" | "error";
  data: T;
}

export function newSuccessResponse<T>(title: string, message: string, data: T): APIResponse<T> {
  return {
    title,
    message,
    status: "success",
    data,
  };
}

export function newErrorResponse(title: string, message: string): APIResponse<null> {
  return {
    title,
    message,
    status: "error",
    data: null,
  };
}
