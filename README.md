# SLICNA website (frontend)

Website for the Sri Lanka Intensive Care Nurses Association. It is a static site: plain HTML, CSS and JavaScript, with the shared header and footer injected at build time. There are no npm dependencies.

## Run it locally

Requires Node.js 18 or later.

```bash
npm run dev
```

Then open http://localhost:5173. The dev server rebuilds `dist/` whenever a file changes, so refresh the browser to see edits.

To build the deployable site only:

```bash
npm run build
```

## Layout

| Path | What it is |
|---|---|
| `index.html`, `pages/*.html` | Page sources. `<div id="site-header"></div>` and `<div id="site-footer"></div>` are replaced by `partials/` at build time. |
| `partials/` | Shared header (pill navigation, mobile menu) and footer. |
| `css/site.css` | The whole design system (colours, type, components). |
| `js/config.js` | API address and `DATA_SOURCE` (`"demo"` or `"api"`). |
| `js/api.js` | All calls to `slicna-backend`. |
| `js/demo-data.js` | Sample content shown while `DATA_SOURCE` is `"demo"`. |
| `js/main.js` | Navigation, scroll reveal and shared render helpers. |
| `build-pages.js` / `dev-server.js` | Build script and local preview server. |

## Backend contract (to build in `slicna-backend`)

The frontend expects these endpoints under `API_BASE_URL`. They mirror the SLNA backend:

- `GET /news`, `GET /news/:id`: `{ id, title, summary, body, photo_url, published_at }`
- `GET /events`, `GET /events/:id`: `{ id, title, summary, body, category: cpd|international|community, event_date, end_date, time, location, cpd_points, photo_url, registration_open }`
- `GET /executive-committee`: `{ members: [{ slot_key, role_title, name, designation, photo_url }] }`
- `GET /albums`: `[{ id, title, cover_photo, photos: [{ url, caption }] }]`
- `GET /membership-fees`: `[{ key: ordinary|life|associate, label, amount, period }]`
- `POST /membership/apply` (multipart, with photo, registration document and receipt files)
- `POST /contact-queries`, `POST /event-registrations`

When the backend is running, set `DATA_SOURCE: "api"` in `js/config.js`.
