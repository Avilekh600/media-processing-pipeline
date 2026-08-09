process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db/database'); // ensures the DB + table are initialized on startup
const uploadRoutes = require('./routes/upload');
const statusRoutes = require('./routes/status');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// serve uploaded images so you can view them in browser if needed
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', uploadRoutes);
app.use('/api', statusRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});