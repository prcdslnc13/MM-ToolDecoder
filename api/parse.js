const express = require('express');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { getParser, getSupportedExtensions } = require('../src/server/parsers');

const app = express();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, getSupportedExtensions().includes(ext));
  },
});

app.post('/api/parse', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or unsupported file type' });
  }

  // Rename temp file to include original extension (parsers use it for detection)
  const ext = path.extname(req.file.originalname).toLowerCase();
  const renamedPath = req.file.path + ext;

  try {
    fs.renameSync(req.file.path, renamedPath);

    const parser = getParser(renamedPath);
    if (!parser) {
      fs.unlinkSync(renamedPath);
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    const tools = parser.parse(renamedPath);

    // Clean up temp file
    fs.unlinkSync(renamedPath);

    res.json({
      format: parser.name,
      originalName: req.file.originalname,
      tools,
      stats: {
        total: tools.length,
        compatible: tools.filter(t => t.compatible).length,
        incompatible: tools.filter(t => !t.compatible).length,
      },
    });
  } catch (err) {
    // Clean up temp files on error
    try { fs.unlinkSync(renamedPath); } catch (_) { /* ignore */ }
    try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    console.error('Parse error:', err);
    res.status(500).json({ error: `Failed to parse file: ${err.message}` });
  }
});

module.exports = app;
