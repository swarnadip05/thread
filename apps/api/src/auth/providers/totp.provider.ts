export interface TotpProvider {
  verify(code: string, encryptedSecret: string): Promise<boolean>;
}

/** TOTP remains disabled until a reviewed secret-encryption and recovery-code provider is supplied. */
export class DisabledTotpProvider implements TotpProvider {
  async verify(): Promise<boolean> {
    return false;
  }
}
