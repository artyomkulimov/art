import { getCollection } from "astro:content";
import { resolve } from "node:path";
import yaml from "@/data/paintings.yaml?raw";

// Keep paintings in the order they are written in paintings.yaml.
const order = [...yaml.matchAll(/^- id: (.+)$/gm)].map((m) => m[1].trim());

// The raw `image:` path of each entry, for build-time image processing.
const imagePaths = new Map(
  [...yaml.matchAll(/^- id: (.+)$[\s\S]*?^ {2}image: (.+)$/gm)].map((m) => [
    m[1].trim(),
    m[2].trim(),
  ])
);

/** All paintings, in the order they appear in src/data/paintings.yaml. */
export const getPaintings = async () => {
  const entries = await getCollection("paintings");
  return entries
    .map((e) => ({ id: e.id, ...e.data }))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
};

export type Painting = Awaited<ReturnType<typeof getPaintings>>[number];

/** Absolute path of a painting's master image on disk (build time only). */
export const imagePathOf = (id: string) =>
  resolve(process.cwd(), "src/data", imagePaths.get(id) ?? "");
