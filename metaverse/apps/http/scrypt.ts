import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const keyLength = 32;

export const hash = async (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");

    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) reject(error);
      resolve(`${salt}.${derivedKey.toString("hex")}`);
    });
  });
};

export const compare = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const [salt, hashKey] = hash.split(".");
    const hashKeyBuff = Buffer.from(hashKey, "hex");
    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) reject(error);
      resolve(timingSafeEqual(hashKeyBuff, derivedKey));
    });
  });
};
