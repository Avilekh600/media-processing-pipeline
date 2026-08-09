const db = require('../db/database');

// simple in-memory queue: just an array of upload IDs waiting to be processed
const queue = [];
let isProcessing = false;

function enqueue(uploadId) {
  queue.push(uploadId);
  console.log(`[queue] enqueued ${uploadId}, queue length: ${queue.length}`);
  processNext();
}

async function processNext() {
  if (isProcessing) return; // already working on something
  if (queue.length === 0) return; // nothing to do

  isProcessing = true;
  const uploadId = queue.shift();

  try {
    await processUpload(uploadId);
  } catch (err) {
    console.error(`[queue] unexpected error processing ${uploadId}:`, err);
    markFailed(uploadId, 'Unexpected processing error');
  }

  isProcessing = false;
  processNext(); // pick up the next item, if any
}

async function processUpload(uploadId) {
  console.log(`[queue] processing ${uploadId}`);
  updateStatus(uploadId, 'processing');

  // placeholder for now — Step 5 will replace this with real image analysis checks
  await new Promise((resolve) => setTimeout(resolve, 1000)); // simulate work

  const dummyResult = { message: 'analysis checks will go here in Step 5' };

  const row = db.prepare('SELECT * FROM media_uploads WHERE id = ?').get(uploadId);
  db.prepare(`
    UPDATE media_uploads
    SET status = 'completed', result = ?, completed_at = ?
    WHERE id = ?
  `).run(JSON.stringify(dummyResult), new Date().toISOString(), uploadId);

  console.log(`[queue] completed ${uploadId}`);
}

function updateStatus(uploadId, status) {
  db.prepare('UPDATE media_uploads SET status = ? WHERE id = ?').run(status, uploadId);
}

function markFailed(uploadId, reason) {
  db.prepare(`
    UPDATE media_uploads
    SET status = 'failed', failure_reason = ?, completed_at = ?
    WHERE id = ?
  `).run(reason, new Date().toISOString(), uploadId);
}

module.exports = { enqueue };