import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface NotificationRecord {
  userId: Types.ObjectId;
  type: "order" | "payment" | "inventory" | "system";
  title: string;
  message: string;
  href?: string;
  orderId?: Types.ObjectId;
  dedupeKey: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    type: {
      type: String,
      enum: ["order", "payment", "inventory", "system"],
      required: true,
      immutable: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140, immutable: true },
    message: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
    href: { type: String, trim: true, maxlength: 500, immutable: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", immutable: true },
    dedupeKey: { type: String, required: true, maxlength: 255, immutable: true },
    readAt: Date,
  },
  { strict: "throw", timestamps: true },
);
notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, name: "notification_user_dedupe_unique" },
);
notificationSchema.index(
  { userId: 1, readAt: 1, createdAt: -1 },
  { name: "notification_user_unread" },
);

export const NotificationModel: Model<NotificationRecord> =
  models.Notification ?? model<NotificationRecord>("Notification", notificationSchema);
