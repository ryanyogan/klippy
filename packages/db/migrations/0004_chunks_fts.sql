-- Keyword search over chunks with SQLite's FTS5 (D1 supports it). The index points at chunks (content='chunks'), so
-- the text isn't stored twice, and three triggers keep it in step with every insert, delete and update.
CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content = 'chunks', content_rowid = 'id', tokenize = 'porter unicode61');
CREATE TRIGGER chunks_fts_insert AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER chunks_fts_delete AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;
CREATE TRIGGER chunks_fts_update AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
  INSERT INTO chunks_fts (rowid, text) VALUES (new.id, new.text);
END;
-- Index the chunks saved before this migration.
INSERT INTO chunks_fts (chunks_fts) VALUES ('rebuild');
