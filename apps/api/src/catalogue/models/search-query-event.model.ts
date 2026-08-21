import { model, models, Schema, type Model } from "../../database/mongoose-runtime.js";

export interface SearchQueryEvent {
  queryHash: string;
  queryLength: number;
  resultCount: number;
  occurredAt: Date;
}

const searchQueryEventSchema = new Schema<SearchQueryEvent>(
  {
    queryHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    queryLength: { type: Number, required: true, min: 1, max: 120 },
    resultCount: { type: Number, required: true, min: 0, max: 1_000_000 },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { strict: "throw", versionKey: false },
);

searchQueryEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 7_776_000 });
searchQueryEventSchema.index({ queryHash: 1, occurredAt: -1 });

export const SearchQueryEventModel: Model<SearchQueryEvent> =
  models.SearchQueryEvent ?? model<SearchQueryEvent>("SearchQueryEvent", searchQueryEventSchema);
