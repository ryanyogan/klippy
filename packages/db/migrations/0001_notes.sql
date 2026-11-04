-- Klippy's notes. Applied by `wrangler d1 migrations apply`, never edited after it has run:
-- a change to the schema is a new file (0002_...).
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL -- milliseconds since 1970, from Date.now()
);
