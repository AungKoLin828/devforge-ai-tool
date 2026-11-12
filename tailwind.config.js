// Limit utility-class scanning to the web app's HTML entry and source files.
export default {
  content: ["./apps/web/index.html", "./apps/web/src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
};
