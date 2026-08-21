import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OrderDto, PublicSiteSettingsDto } from "@thread/types";

export class PackingSlipProvider {
  async generate(order: OrderDto, settings: PublicSiteSettingsDto): Promise<Buffer> {
    const document = await PDFDocument.create();
    const page = document.addPage([595, 842]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    page.drawText(`${settings.brandName} packing slip`, {
      x: 48,
      y: 785,
      size: 20,
      font: bold,
      color: rgb(0.07, 0.07, 0.07),
    });
    const lines = [
      `Order: ${order.orderNumber}`,
      `Ship to: ${order.address.fullName}`,
      order.address.addressLine1,
      ...(order.address.addressLine2 ? [order.address.addressLine2] : []),
      `${order.address.city}, ${order.address.state} ${order.address.postalCode}`,
      order.address.country,
      `Phone: ${order.address.phone}`,
    ];
    lines.forEach((line, index) =>
      page.drawText(line, { x: 48, y: 745 - index * 18, size: 10, font }),
    );
    let y = 590;
    page.drawText("Pack these items", { x: 48, y, size: 13, font: bold });
    y -= 26;
    order.items.forEach((item) => {
      page.drawText(`${item.quantity} x ${item.title} / ${item.colour} / ${item.size}`, {
        x: 48,
        y,
        size: 10,
        font,
        maxWidth: 490,
      });
      y -= 22;
    });
    page.drawText("Prices are intentionally omitted from this fulfilment document.", {
      x: 48,
      y: 60,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    return Buffer.from(await document.save());
  }
}
