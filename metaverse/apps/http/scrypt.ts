import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const keyLength = 32;

const parseHexKey = (value: string | undefined): Buffer | null => {
  if (!value || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    return null;
  }
  return Buffer.from(value, "hex");
};

export const hash = async (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");

    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
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
    const expected = parseHexKey(hashKey);

    scrypt(password, salt ?? "", keyLength, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      if (!expected || expected.length !== derivedKey.length) {
        resolve(false);
        return;
      }
      resolve(timingSafeEqual(expected, derivedKey));
    });
  });
};
