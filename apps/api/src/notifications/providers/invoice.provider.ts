import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OrderDto, PublicSiteSettingsDto } from "@thread/types";

export interface InvoiceProvider {
  generate(order: OrderDto, settings: PublicSiteSettingsDto): Promise<Buffer>;
}

function rupees(paise: number): string {
  return `INR ${(paise / 100).toFixed(2)}`;
}

export class PdfInvoiceProvider implements InvoiceProvider {
  async generate(order: OrderDto, settings: PublicSiteSettingsDto): Promise<Buffer> {
    const document = await PDFDocument.create();
    const page = document.addPage([595, 842]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    page.drawText(settings.brandName, {
      x: 48,
      y: 784,
      size: 24,
      font: bold,
      color: rgb(0.07, 0.07, 0.07),
    });
    page.drawText("Order invoice", { x: 48, y: 754, size: 14, font: bold });
    const businessLines = [
      settings.legalName,
      settings.addressLine1,
      `${settings.locality}, ${settings.city} ${settings.postalCode}`,
      `${settings.state}, ${settings.country}`,
      `GSTIN: ${settings.gstin}`,
      `Order: ${order.orderNumber}`,
      `Created: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
    ];
    businessLines.forEach((line, index) =>
      page.drawText(line, { x: 48, y: 724 - index * 18, size: 10, font }),
    );
    let y = 570;
    page.drawText("Items", { x: 48, y, size: 13, font: bold });
    y -= 24;
    order.items.forEach((item) => {
      page.drawText(`${item.title} / ${item.colour} / ${item.size} x ${item.quantity}`, {
        x: 48,
        y,
        size: 9,
        font,
        maxWidth: 360,
      });
      page.drawText(rupees(item.lineSubtotalPaise + item.taxPaise), {
        x: 455,
        y,
        size: 9,
        font,
      });
      y -= 20;
    });
    y -= 16;
    const totals = [
      ["Subtotal", order.totals.subtotalPaise],
      ["Discount", -order.totals.discountPaise],
      ["Shipping", order.totals.shippingPaise],
      ["Configured tax", order.totals.taxPaise],
      ["Total", order.totals.totalPaise],
    ] as const;
    totals.forEach(([label, value], index) => {
      const rowFont = index === totals.length - 1 ? bold : font;
      page.drawText(label, { x: 350, y: y - index * 20, size: 10, font: rowFont });
      page.drawText(rupees(value), { x: 455, y: y - index * 20, size: 10, font: rowFont });
    });
    page.drawText("Generated from the server-confirmed order snapshot.", {
      x: 48,
      y: 60,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    return Buffer.from(await document.save());
  }
}
