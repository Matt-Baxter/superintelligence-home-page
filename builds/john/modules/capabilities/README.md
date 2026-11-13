# capabilities

The capability tracker: activity per capability area this window vs the last, benchmark mentions with the highest reported score, watched people and organizations, and the strongest signals.

- **Routes**: `GET /api/capabilities?days=7|30|90`. **Page**: `/m/capabilities` (old `/capabilities` redirects). **Nav**: Capabilities.
- **View**: `capability-snapshot`, a json-render view built from the same data (`view.js`).
- Reads core tables only (`stories`, `story_topics`, `story_entities`); owns no tables.
