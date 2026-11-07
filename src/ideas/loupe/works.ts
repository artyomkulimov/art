import { getImage } from "astro:assets";
import { getPaintings } from "@/lib/paintings";

/**
 * Paintings plus the image URLs this idea needs: a near-native master for
 * sharp close-ups and a tiny placeholder that paints instantly.
 */
export const getWorks = async () => {
  const paintings = await getPaintings();
  return Promise.all(
    paintings.map(async (p) => {
      const w = Math.min(3200, p.image.width);
      const h = Math.round((w * p.image.height) / p.image.width);
      const [full, tiny] = await Promise.all([
        getImage({ src: p.image, width: w, format: "webp", quality: 82 }),
        getImage({ src: p.image, width: 64, format: "webp", quality: 60 }),
      ]);
      return {
        id: p.id,
        title: p.title,
        artist: p.artist,
        year: p.year,
        medium: p.medium,
        location: p.location,
        rights: p.rights,
        source: p.source,
        original: p.original,
        palette: p.palette,
        details: p.details,
        full: full.src,
        tiny: tiny.src,
        w,
        h,
      };
    }),
  );
};

export type Work = Awaited<ReturnType<typeof getWorks>>[number];
