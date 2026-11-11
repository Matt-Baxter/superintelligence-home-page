# Appearance

Themes, feed layouts and design concepts (proposed REQ-053, `specs/005-appearance-and-publishing`). Extended profile only.

- **Concepts** (`catalog.json`) bundle a theme, a feed layout, a headline face and a text size: Reader (default), Briefing, Magazine, Night desk, Accessible. Any setting can then be changed on its own ("Custom").
- **Site default**: an admin picks it on `/m/appearance` (preview on the three newest stories) and chooses whether readers may switch. Stored in `appearance_settings` (one row, `site`); every change writes an `appearance.default` audit row.
- **Reader choice**: the Display menu in the top bar (`appearanceMenu` in `public/js/api.js`), kept in the reader's browser storage only. The look is set as `data-theme`, `data-layout`, `data-type` and `data-size` on `<html>`; `public/css/app.css` styles them.
- **Themes change neutral tokens only.** The accent stays ink: a colour accent is a decision for both partners. `scripts/unslop.js` holds every `:root[data-theme]` block to 4.5:1 text contrast.

Routes: `GET /api/appearance` (public), `PUT /api/admin/appearance` (admin). Points used: `db.schema`, `http.routes`, `ui.nav`. Checks: `test/publishing-unit.js`, the "Appearance and publishing" part of `test/e2e.js`.

To add an option: add it to `catalog.json` and its CSS block to `app.css`; the unit check fails until both exist.
