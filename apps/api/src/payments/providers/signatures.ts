import { createHmac, timingSafeEqual } from "node:crypto";

function constantTimeHexEqual(expectedHex: string, receivedHex: string): boolean {
  if (!/^[a-fA-F0-9]+$/.test(receivedHex) || expectedHex.length !== receivedHex.length)
    return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function paymentSignature(
  secret: string,
  providerOrderId: string,
  providerPaymentId: string,
): string {
  return createHmac("sha256", secret)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest("hex");
}

export function verifyPaymentSignature(input: {
  secret: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): boolean {
  return constantTimeHexEqual(
    paymentSignature(input.secret, input.providerOrderId, input.providerPaymentId),
    input.signature,
  );
}

export function webhookSignature(secret: string, rawBody: Buffer): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyRawWebhookSignature(input: {
  secret: string;
  rawBody: Buffer;
  signature: string;
}): boolean {
  return constantTimeHexEqual(webhookSignature(input.secret, input.rawBody), input.signature);
}
