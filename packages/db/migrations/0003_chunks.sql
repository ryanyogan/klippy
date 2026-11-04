-- Each source cut into pieces small enough to search and to embed. position is the order within the source.
-- Deleting a source (or the note behind it) deletes its chunks.
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  owner TEXT NOT NULL, -- copied from the source, so a search can filter without a join
  position INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX chunks_source ON chunks (source_id, position);
