import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

const root = new URL("../", import.meta.url);
for (const [example, target, secrets] of [
  ["apps/api/.env.example", "apps/api/.env", ["ACCESS_TOKEN_SECRET", "PRODUCT_PREVIEW_SECRET"]],
  ["apps/web/.env.example", "apps/web/.env.local", []],
]) {
  const destination = new URL(target, root);
  const template = readFileSync(new URL(example, root), "utf8");
  const source = existsSync(destination) ? readFileSync(destination, "utf8") : template;
  const parse = (text) =>
    new Map(
      text.split(/\r?\n/).flatMap((line) => {
        const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
        return match ? [[match[1], match[2]]] : [];
      }),
    );
  const defaults = parse(template);
  const current = parse(source);
  for (const [key, value] of defaults) if (!current.get(key)?.trim()) current.set(key, value);
  for (const key of secrets)
    if (!current.get(key)?.trim()) current.set(key, randomBytes(48).toString("hex"));
  const seen = new Set();
  const lines = source
    .split(/\r?\n/)
    .filter((line) => {
      const key = /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1];
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((line) => {
      const key = /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1];
      return key ? `${key}=${current.get(key) ?? ""}` : line;
    });
  for (const [key, value] of current) if (!seen.has(key)) lines.push(`${key}=${value}`);
  writeFileSync(destination, `${lines.join("\n").trim()}\n`, { mode: 0o600 });
  process.stdout.write(
    `Prepared ${fileURLToPath(destination)}; existing non-empty values preserved.\n`,
  );
}
