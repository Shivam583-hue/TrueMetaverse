import { loadJwtSecret } from "./jwtSecret";

export const JWT_PASSWORD = loadJwtSecret();
export const JWT_ALGORITHM = "HS256" as const;
