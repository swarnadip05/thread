import { model, models, Schema, type Model } from "../database/mongoose-runtime.js";

interface SeedMigrationRecord {
  version: string;
  description: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const seedMigrationSchema = new Schema<SeedMigrationRecord>(
  {
    version: { type: String, required: true, immutable: true },
    description: { type: String, required: true, trim: true },
    appliedAt: { type: Date, default: Date.now, required: true },
  },
  { strict: "throw", timestamps: true },
);
seedMigrationSchema.index({ version: 1 }, { unique: true, name: "seed_migration_version_unique" });
export const SeedMigrationModel: Model<SeedMigrationRecord> =
  models.SeedMigration ?? model<SeedMigrationRecord>("SeedMigration", seedMigrationSchema);
