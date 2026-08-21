import mongoose from "mongoose";

export * from "mongoose";

// Mongoose's CommonJS entry exposes `models` on its default export, but Node's
// native ESM bridge does not synthesize that named export.
export const models = mongoose.models;
