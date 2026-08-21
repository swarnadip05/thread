type ShippingDestination = {
  readonly country: string;
  readonly postalCode: string;
};
type ShippingRuleSet = {
  readonly countries: readonly string[];
  readonly postalPrefixes: readonly string[];
};

export interface ShippingProvider {
  supports(address: ShippingDestination, method: ShippingRuleSet): boolean;
}

/** Database-driven manual rates; replace this adapter when a courier quote API is approved. */
export class ManualShippingProvider implements ShippingProvider {
  supports(address: ShippingDestination, method: ShippingRuleSet): boolean {
    const country = address.country.toLocaleLowerCase("en-IN");
    const countryAllowed = method.countries.some(
      (item) => item.toLocaleLowerCase("en-IN") === country,
    );
    return (
      countryAllowed &&
      (method.postalPrefixes.length === 0 ||
        method.postalPrefixes.some((prefix) => address.postalCode.startsWith(prefix)))
    );
  }
}
