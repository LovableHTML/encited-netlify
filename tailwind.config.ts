import config from "@netlify/sdk/ui/react/tailwind-config";

// The Netlify preset sets `prefix: "tw-"` — utilities in src/ui must be
// written as tw-* (e.g. tw-my-3) or they silently compile to nothing.
export default {
  presets: [config],
  content: ["./src/ui/index.html", "./src/ui/**/*.{js,jsx,ts,tsx}"],
};
