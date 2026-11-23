# admin

Admin layer: sources and harvesting (test a feed, find feed, catalog, OPML, harvest log), users, moderation, ontology and re-tagging, the audit log, and free-tier usage.

- **Routes**: `/api/admin/*` (`routes.js`), admins only. **Page**: `/m/admin` (old `/admin` redirects). **Nav**: Admin (admins).
- Uses core tables (`sources`, `fetch_runs`, `admin_audit`, …) through the `db` the kernel passes in.
