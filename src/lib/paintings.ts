import { getCollection } from "astro:content";
import yaml from "@/data/paintings.yaml?raw";

// Keep paintings in the order they are written in paintings.yaml.
const order = [...yaml.matchAll(/^- id: (.+)$/gm)].map((m) => m[1].trim());

/** All paintings, in the order they appear in src/data/paintings.yaml. */
export const getPaintings = async () => {
  const entries = await getCollection("paintings");
  return entries
    .map((e) => ({ id: e.id, ...e.data }))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
};

export type Painting = Awaited<ReturnType<typeof getPaintings>>[number];
