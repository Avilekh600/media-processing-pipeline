const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/status/:id', (req, res) => {
  const row = db.prepare('SELECT id, status FROM media_uploads WHERE id = ?').get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  res.json({ id: row.id, status: row.status });
});

router.get('/result/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM media_uploads WHERE id = ?').get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  if (row.status === 'failed') {
    return res.json({
      id: row.id,
      status: row.status,
      failure_reason: row.failure_reason
    });
  }

  if (row.status !== 'completed') {
    return res.json({
      id: row.id,
      status: row.status,
      message: 'Processing not yet complete'
    });
  }

  res.json({
    id: row.id,
    status: row.status,
    result: JSON.parse(row.result)
  });
});

module.exports = router;