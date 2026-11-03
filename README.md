# SLICNA website (frontend)

Website for the Sri Lanka Intensive Care Nurses Association. It is a static site (plain HTML, CSS and JavaScript); the shared header and footer are injected at build time. Content comes from the `slicna-backend` API, and the admin panel at `/pages/admin.html` maintains it. There are no npm dependencies.

## Run it locally

Requires Node.js 18 or later, and `slicna-backend` running on port 3001 (see its README).

```bash
npm run dev
```

Then open http://localhost:5173. The dev server rebuilds `dist/` whenever a file changes, so refresh the browser to see edits. Staff log in at http://localhost:5173/pages/admin-login.html.

To build the deployable site only:

```bash
npm run build
```

## Layout

| Path | What it is |
|---|---|
| `index.html`, `pages/*.html` | Page sources. `<div id="site-header"></div>` and `<div id="site-footer"></div>` are replaced by `partials/` at build time. |
| `partials/` | Shared header (pill navigation, mobile menu) and footer. |
| `css/site.css` | Design system for the public site. |
| `css/admin.css`, `js/admin.js`, `pages/admin.html` | Admin panel: one reusable list/form engine used for every content type, with confirmation dialogs for saving, deleting and discarding changes. |
| `js/config.js` | API address (`localhost:3001` locally, `api.slicna.lk` otherwise). |
| `js/api.js` | All calls to `slicna-backend`, plus `mediaUrl()` for uploaded images. |
| `js/main.js` | Navigation, scroll reveal and shared render helpers. |
| `js/<page>.js` | Per-page rendering (home, about, leadership, cpd, events, community, gallery, ...). |
| `build-pages.js` / `dev-server.js` | Build script and local preview server. |

## What comes from the admin panel

| Page | Managed content |
|---|---|
| Home | Upcoming events, CPD summary (calculated), community tiles, latest news |
| About | Milestones timeline and its photo |
| Leadership | Committee term and members |
| CPD | Events that have CPD points; totals are calculated from them |
| Events | All events (CPD, international, community) |
| Community | Page sections (three layouts) with their photos and cards |
| News, Gallery | Articles; albums and photos |
| Membership | Fees and bank details (shown on the membership pages) |

Fixed text such as the hero, mission and vision, and partners stays in the HTML. The contact and event registration forms are not connected yet.

## Membership pages

| Page | What it does |
|---|---|
| `pages/membership.html` | The four categories with live fees, a "which membership is right for me?" helper, benefits, how to join, bank details |
| `pages/membership-apply.html` | Step-by-step application (`?category=GM` preselects). Fields adapt to the category; text answers are kept as a draft in the browser |
| `pages/membership-recommendation.html` | Printable recommendation page (GM/OM) or institution certification page (PM), prefilled with the applicant's name |
| `pages/membership-status.html` | Application status by reference + NIC (`?ref=` prefills) |
| `pages/membership-renew.html` | Renew or upgrade, from a personal renewal link (`?t=`) or membership number + NIC |

The admin panel's **Membership** group (`js/admin-membership.js`) covers application review, the member directory, renewal verification and membership settings.
