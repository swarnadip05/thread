import { readFile } from "node:fs/promises";

export interface E2eIdentity {
  readonly email: string;
  readonly password: string;
}

export interface E2eRuntime {
  readonly admin: E2eIdentity;
  readonly customer: E2eIdentity;
  readonly productSlug: string;
  readonly variantId: string;
}

export async function readRuntime(): Promise<E2eRuntime> {
  return JSON.parse(await readFile(".e2e/runtime.json", "utf8")) as E2eRuntime;
}
