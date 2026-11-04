-- What Klippy can answer from: your notes, the links you save and the files you send.
-- Each source belongs to one Klippy (owner = its name, gh-<id>), so one person's search never sees another's.
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('note', 'link', 'file')),
  title TEXT NOT NULL,
  url TEXT, -- links only
  note_id INTEGER REFERENCES notes (id) ON DELETE CASCADE, -- notes only: deleting the note deletes its source
  body TEXT, -- the text as Markdown, once ingested
  status TEXT NOT NULL CHECK (status IN ('queued', 'ready', 'failed')),
  created_at INTEGER NOT NULL -- milliseconds since 1970
);
CREATE INDEX sources_owner ON sources (owner, created_at);
