import { describe, expect, it } from "vitest";

import { loadApiConfig } from "../src/config/env.js";

const baseEnvironment: NodeJS.ProcessEnv = {
  ACCESS_TOKEN_SECRET: "access-token-secret-at-least-32-characters",
  MONGODB_URI: "mongodb://localhost:27017/thread-config-test",
  NODE_ENV: "test",
  PRODUCT_PREVIEW_SECRET: "product-preview-secret-at-least-32-characters",
  REDIS_URL: "redis://localhost:6379",
  WEB_ORIGIN: "http://localhost:3000",
};

const validCloudinary = {
  CLOUDINARY_API_KEY: "api-key-value-123",
  CLOUDINARY_API_SECRET: "secret-with-symbols_!@#$%^&*()",
  CLOUDINARY_CLOUD_NAME: "dtcedpny7",
  CLOUDINARY_PRODUCT_FOLDER: "thread/products",
};

describe("Cloudinary environment configuration", () => {
  it("returns the complete configuration for cloud identifier dtcedpny7", () => {
    expect(loadApiConfig({ ...baseEnvironment, ...validCloudinary }).cloudinary).toEqual({
      cloudName: "dtcedpny7",
      apiKey: "api-key-value-123",
      apiSecret: "secret-with-symbols_!@#$%^&*()",
      folder: "thread/products",
    });
  });

  it("accepts an all-numeric Cloudinary API key", () => {
    expect(
      loadApiConfig({
        ...baseEnvironment,
        ...validCloudinary,
        CLOUDINARY_API_KEY: "123456789012345",
      }).cloudinary?.apiKey,
    ).toBe("123456789012345");
  });

  it("requires the API secret when Cloudinary is configured", () => {
    expect(() =>
      loadApiConfig({
        ...baseEnvironment,
        ...validCloudinary,
        CLOUDINARY_API_SECRET: "",
      }),
    ).toThrow("All Cloudinary environment variables are required");
  });

  it.each(["1starts-with-a-number", "bad/name", "bad_name", "a"])(
    "rejects malformed cloud name %s",
    (cloudName) => {
      expect(() =>
        loadApiConfig({
          ...baseEnvironment,
          ...validCloudinary,
          CLOUDINARY_CLOUD_NAME: cloudName,
        }),
      ).toThrow("CLOUDINARY_CLOUD_NAME must be a valid Cloudinary cloud identifier");
    },
  );
});
