const SLICNA_IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const SLICNA_CONFIG = {
  // slicna-backend. Locally it runs on port 3001 (SLNA's backend uses 3000).
  API_BASE_URL: SLICNA_IS_LOCAL
    ? "http://localhost:3001/api"
    : "https://api.slicna.lk/api"
};
