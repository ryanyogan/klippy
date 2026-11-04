-- Contextual retrieval: one sentence per chunk that says where it sits in its document. Keyword search reads it too,
-- so the FTS index is rebuilt with two columns (a migration never edits an old one: it replaces what it must).
ALTER TABLE chunks ADD COLUMN context TEXT NOT NULL DEFAULT '';
DROP TRIGGER chunks_fts_insert;
DROP TRIGGER chunks_fts_delete;
DROP TRIGGER chunks_fts_update;
DROP TABLE chunks_fts;
CREATE VIRTUAL TABLE chunks_fts USING fts5(context, text, content = 'chunks', content_rowid = 'id', tokenize = 'porter unicode61');
CREATE TRIGGER chunks_fts_insert AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (rowid, context, text) VALUES (new.id, new.context, new.text);
END;
CREATE TRIGGER chunks_fts_delete AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, context, text) VALUES ('delete', old.id, old.context, old.text);
END;
CREATE TRIGGER chunks_fts_update AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, context, text) VALUES ('delete', old.id, old.context, old.text);
  INSERT INTO chunks_fts (rowid, context, text) VALUES (new.id, new.context, new.text);
END;
INSERT INTO chunks_fts (chunks_fts) VALUES ('rebuild');
