const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { enqueue } = require('../services/queue');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.post('/upload', upload.single('image'), (req, res) => {
  console.log('>>> UPLOAD ROUTE HIT');

  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const id = uuidv4();
  const uploadedAt = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO media_uploads (id, filename, filepath, status, uploaded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.file.originalname, req.file.filename, 'pending', uploadedAt);

    enqueue(id);

    res.status(201).json({
      id,
      status: 'pending',
      message: 'Image uploaded successfully, processing will begin shortly'
    });
  } catch (err) {
    console.error('DB insert failed:', err);
    res.status(500).json({ error: 'Failed to save upload record' });
  }
});

module.exports = router;