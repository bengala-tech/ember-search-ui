/** A guide rendered at build time by markdown.mjs. */
declare module '*.md' {
  const guide: {
    title: string;
    html: string;
    toc: { id: string; text: string; level: 2 | 3 }[];
  };
  export default guide;
}
