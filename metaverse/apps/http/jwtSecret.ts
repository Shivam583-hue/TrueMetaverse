const DEV_JWT_SECRET = "local-development-jwt-secret";
const MIN_SECRET_LENGTH = 32;

export const loadJwtSecret = (env: NodeJS.ProcessEnv = process.env): string => {
  const secret = env.JWT_PASSWORD;
  const isProduction = env.NODE_ENV === "production";

  if (!secret) {
    if (isProduction) {
      throw new Error(
        "JWT_PASSWORD is required when NODE_ENV=production. Refusing to start with the public development signing key.",
      );
    }
    console.warn(
      "[auth] JWT_PASSWORD is not set, falling back to the public development signing key. Never use this outside local development.",
    );
    return DEV_JWT_SECRET;
  }

  if (isProduction && secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_PASSWORD must be at least ${MIN_SECRET_LENGTH} characters when NODE_ENV=production (got ${secret.length}).`,
    );
  }

  return secret;
};
