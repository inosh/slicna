const SLICNA_IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const SLICNA_CONFIG = {
  API_BASE_URL: SLICNA_IS_LOCAL
    ? "http://localhost:3000/api"
    : "https://api.slicna.lk/api",

  // "demo": pages use the sample content in demo-data.js and forms don't send anything.
  // "api":  pages call slicna-backend, and fall back to demo content if it's unreachable.
  // Switch to "api" once slicna-backend is running.
  DATA_SOURCE: "demo",

  USE_DEMO_FALLBACK: true
};
