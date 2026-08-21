import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface InvoiceRecord {
  orderId: Types.ObjectId;
  orderNumber: string;
  content: Buffer;
  sha256: string;
  bytes: number;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<InvoiceRecord>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    orderNumber: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    content: { type: Buffer, required: true, select: false, immutable: true },
    sha256: { type: String, required: true, maxlength: 64, immutable: true },
    bytes: { type: Number, required: true, min: 1, max: 2_000_000, immutable: true },
    generatedAt: { type: Date, required: true, immutable: true },
  },
  { strict: "throw", timestamps: true },
);
invoiceSchema.index({ orderId: 1 }, { unique: true, name: "invoice_order_unique" });

export const InvoiceModel: Model<InvoiceRecord> =
  models.Invoice ?? model<InvoiceRecord>("Invoice", invoiceSchema);
