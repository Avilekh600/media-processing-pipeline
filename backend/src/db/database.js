const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '../../pipeline.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS media_uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    failure_reason TEXT,
    uploaded_at TEXT NOT NULL,
    completed_at TEXT
  )
`);

module.exports = db;