import type { DeliveryCheckDto } from "@thread/types";

export interface DeliveryEligibilityProvider {
  check(postalCode: string): Promise<DeliveryCheckDto>;
}

/**
 * Conservative local adapter. Configured prefixes are operational rules, not delivery promises;
 * when no rules exist the response explicitly requires confirmation.
 */
export class RulesBasedDeliveryProvider implements DeliveryEligibilityProvider {
  constructor(private readonly serviceablePrefixes: readonly string[]) {}

  async check(postalCode: string): Promise<DeliveryCheckDto> {
    if (this.serviceablePrefixes.length === 0) {
      return {
        postalCode,
        status: "confirmation_required",
        message: "Postcode accepted. Delivery availability will be confirmed before dispatch.",
      };
    }
    const serviceable = this.serviceablePrefixes.some((prefix) => postalCode.startsWith(prefix));
    return serviceable
      ? {
          postalCode,
          status: "serviceable",
          message: "Delivery is available under the currently configured serviceability rules.",
        }
      : {
          postalCode,
          status: "not_serviceable",
          message: "This postcode is not covered by the currently configured delivery rules.",
        };
  }
}
