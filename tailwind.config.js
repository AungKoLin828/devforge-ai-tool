// Limit utility-class scanning to the app's HTML entry and frontend source files.
export default {
  content: ["./frontend/index.html", "./frontend/src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
};
