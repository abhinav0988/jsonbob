import { HTTPException } from "hono/http-exception";

export class AppError extends HTTPException {
  constructor(
    status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(status as 400, { message });
  }
}

export function errorBody(err: AppError | HTTPException, requestId: string) {
  if (err instanceof AppError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    };
  }
  return {
    error: {
      code: "HTTP_ERROR",
      message: err.message,
      details: null,
      requestId,
    },
  };
}

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}
