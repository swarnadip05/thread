import { model, models, Schema, type Model } from "../../database/mongoose-runtime.js";
import { commerceJobNames, type CommerceJobName } from "@thread/types";

export interface JobExecutionRecord {
  key: string;
  jobName: CommerceJobName;
  status: "processing" | "completed" | "failed";
  attempts: number;
  lockedAt: Date;
  completedAt?: Date;
  failureCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobExecutionSchema = new Schema<JobExecutionRecord>(
  {
    key: { type: String, required: true, maxlength: 255, immutable: true },
    jobName: { type: String, enum: commerceJobNames, required: true, immutable: true },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      required: true,
      default: "processing",
    },
    attempts: { type: Number, required: true, min: 1, default: 1 },
    lockedAt: { type: Date, required: true },
    completedAt: Date,
    failureCode: { type: String, trim: true, maxlength: 120 },
  },
  { strict: "throw", timestamps: true },
);
jobExecutionSchema.index({ key: 1 }, { unique: true, name: "job_execution_key_unique" });
jobExecutionSchema.index({ status: 1, updatedAt: 1 }, { name: "job_execution_recovery_queue" });

export const JobExecutionModel: Model<JobExecutionRecord> =
  models.JobExecution ?? model<JobExecutionRecord>("JobExecution", jobExecutionSchema);
