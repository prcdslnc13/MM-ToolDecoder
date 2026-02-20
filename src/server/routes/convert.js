const express = require('express');
const { convertToMillMage } = require('../converters/to-millmage');

const router = express.Router();

// POST /api/convert
// Body: { uploadId, defaults: { RampAngle, RampRate, Vendor, ToolSpecURL, TipLength } }
router.post('/', (req, res) => {
  const { uploadId, defaults } = req.body;

  if (!uploadId) {
    return res.status(400).json({ error: 'Missing uploadId' });
  }

  const uploads = req.app.locals.uploads || {};
  const upload = uploads[uploadId];
  if (!upload) {
    return res.status(404).json({ error: 'Upload not found. Please re-upload the file.' });
  }

  try {
    const { output, stats } = convertToMillMage(upload.tools, defaults || {});

    // Store converted output for download
    upload.converted = output;
    upload.convertStats = stats;

    res.json({ output, stats });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ error: `Conversion failed: ${err.message}` });
  }
});

// GET /api/download/:uploadId
router.get('/download/:uploadId', (req, res) => {
  const upload = (req.app.locals.uploads || {})[req.params.uploadId];
  if (!upload || !upload.converted) {
    return res.status(404).json({ error: 'No converted data found. Please convert first.' });
  }

  const json = JSON.stringify(upload.converted, null, 4);
  const filename = upload.originalName.replace(/\.[^.]+$/, '') + '.tools';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(json);
});

module.exports = router;
