export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const invalidCredentialsError = () =>
  new AuthError("INVALID_CREDENTIALS", 401, "Email or password is incorrect.");
export const invalidSessionError = () =>
  new AuthError("INVALID_SESSION", 401, "Your session is invalid or has expired.");
