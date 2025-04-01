import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.join(__dirname, "jsons");
const outputJsonPath = path.join(__dirname, "atlases.json");
const outputTypesPath = path.join(__dirname, "types.ts");
const edgeTrim = 0; // px
const padding = 0 + edgeTrim; // px

const precise = (n) => Number(n.toPrecision(21));

// Read all atlas JSON files from /jsons
const atlasFiles = fs
  .readdirSync(inputDir)
  .filter((file) => file.endsWith(".json"));

const atlases = {};
const atlasNames = [];
const entryKeysMap = {};

for (const file of atlasFiles) {
  const atlasJson = JSON.parse(
    fs.readFileSync(path.join(inputDir, file), "utf8"),
  );
  const atlasName = path.basename(file, ".json");
  atlasNames.push(atlasName);

  const altasWidth = atlasJson.meta.size.w;
  const altasHeight = atlasJson.meta.size.h;

  const tiles =
    atlasJson.frames.reduce((acc, frame) => {
      const name = path
        .basename(frame.filename)
        .replace(/\.[^/.]+$/, "")
        .replace(/\s+|_copy/gi, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .replace(/([a-z])([A-Z])/g, "$1_$2");

      const key = name
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
        .replace(/^./, (s) => s.toLowerCase());

      const usableW = frame.frame.w - 2 * padding;
      const usableH = frame.frame.h - 2 * padding;

      const scaleX = usableW / altasWidth;
      const scaleY = usableH / altasHeight;

      const offsetX = (frame.frame.x + padding) / altasWidth;
      const offsetY = (frame.frame.y + padding) / altasHeight;

      acc[key] = {
        scale: [precise(scaleX), precise(scaleY)],
        offset: [precise(offsetX), precise(offsetY)],
      };
      return acc;
    }, {}) || {};

  atlases[atlasName] = tiles;
  entryKeysMap[atlasName] = Object.keys(tiles);
}

// Write combined JSON
fs.writeFileSync(outputJsonPath, JSON.stringify(atlases, null, 2));

// --- Generate TypeScript Types ---
const atlasEntryType = `
export type AtlasEntry = {
  scale: [number, number];
  offset: [number, number];
};
`.trim();

const valuesType =
  `type Values<T extends readonly unknown[]> = T[number];`.trim();

const atlasesType = `
const entryKeysMap = ${JSON.stringify(entryKeysMap)} as const
export type Atlases = {
  [K in keyof typeof entryKeysMap]: {
    [T in Values<typeof entryKeysMap[K]>]: AtlasEntry;
  };
}
`.trim();

const typesFileContent = [atlasEntryType, valuesType, atlasesType].join("\n\n");

fs.writeFileSync(outputTypesPath, typesFileContent);

console.log("✅ Atlases built: atlases.json + types.ts");
