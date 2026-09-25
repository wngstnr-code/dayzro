// Same pipeline as the reference bridge UI. Tailwind only emits CSS for files that use
// @tailwind/@apply, so the landing page SCSS modules are unaffected.
const config = {
  plugins: {
    "postcss-import": {},
    "tailwindcss/nesting": {},
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
