import argon2 from "argon2";

const options = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

const dummyPasswordHashPromise = argon2.hash("THREAD-dummy-password-value", options);

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export async function verifyPassword(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  const hash = passwordHash ?? (await dummyPasswordHashPromise);
  try {
    const valid = await argon2.verify(hash, password);
    return passwordHash === undefined ? false : valid;
  } catch {
    return false;
  }
}
