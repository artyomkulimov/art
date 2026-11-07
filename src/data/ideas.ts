/** The design explorations shown in the viewer at `/`. Each slug maps to src/pages/ideas/<slug>.astro. */
export type IdeaEntry = { slug: string; name: string; pitch: string; how: string };
export type IdeaGroup = { theme: string; ideas: IdeaEntry[] };

export const ideaGroups: IdeaGroup[] = [
  {
    theme: "Zoom & detail",
    ideas: [
      {
        slug: "zoom-reveal",
        name: "Zoom reveal",
        pitch: "Opens on a close-up detail, then slowly pulls back to the whole painting.",
        how: "Scroll or ← → for the next painting",
      },
      {
        slug: "loupe",
        name: "Loupe",
        pitch: "A magnifying lens follows your cursor over the full-resolution painting.",
        how: "Move the mouse · scroll to change power",
      },
      {
        slug: "detail-mosaic",
        name: "Detail mosaic",
        pitch: "A field of close-up crops. Click one and it grows into its painting.",
        how: "Click a tile · Esc to go back",
      },
      {
        slug: "scroll-pan",
        name: "Scroll pan",
        pitch: "Scrolling moves a camera across the painting, stopping at each detail.",
        how: "Scroll",
      },
    ],
  },
  {
    theme: "The painting is the site",
    ideas: [
      {
        slug: "full-bleed",
        name: "Full bleed",
        pitch: "Only the painting, edge to edge. Info appears when you move the mouse.",
        how: "Move the mouse · scroll for the next one",
      },
      {
        slug: "curtain",
        name: "Curtain",
        pitch: "Each painting opens from a thin slit of light, like a shutter.",
        how: "Scroll",
      },
      {
        slug: "flashlight",
        name: "Flashlight",
        pitch: "A dark room where your cursor is the only light.",
        how: "Move the mouse · click to turn the lights on",
      },
      {
        slug: "title-mask",
        name: "Title mask",
        pitch: "You see the painting through the letters of its title, then it opens up.",
        how: "Scroll",
      },
    ],
  },
  {
    theme: "Ways to browse",
    ideas: [
      {
        slug: "text-index",
        name: "Text index",
        pitch: "Just a list of titles. Hover one and the painting floods the screen.",
        how: "Hover a title · click to open",
      },
      {
        slug: "wall-canvas",
        name: "Wall",
        pitch: "One big wall you drag around. Click a painting to fly in.",
        how: "Drag · click a painting · Esc",
      },
      {
        slug: "true-scale",
        name: "True scale",
        pitch: "The paintings at their real size, next to a person.",
        how: "Scroll to walk · click a painting",
      },
      {
        slug: "stack",
        name: "Stack",
        pitch: "A pile of prints on a table. Throw the top one aside.",
        how: "Drag and throw · ← →",
      },
    ],
  },
  {
    theme: "Motion",
    ideas: [
      {
        slug: "focus-pull",
        name: "Focus pull",
        pitch: "Paintings drift in blurred and snap into focus at the centre.",
        how: "Scroll",
      },
      {
        slug: "title-sequence",
        name: "Title sequence",
        pitch: "Plays like the opening titles of a film.",
        how: "Watch · click or ← → to take over",
      },
      {
        slug: "palette-strips",
        name: "Palette strips",
        pitch: "Each painting as a band of its own colours. Hover and it blooms.",
        how: "Hover a band · click to open",
      },
      {
        slug: "dissolve",
        name: "Dissolve",
        pitch: "Paintings wash into one another like wet paint.",
        how: "Scroll or ← →",
      },
    ],
  },
];
