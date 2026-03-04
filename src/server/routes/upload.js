const express = require('express');
const multer = require('multer');
const path = require('path');
const { getParser, getSupportedExtensions } = require('../parsers');

// path.extname() only captures the last segment (e.g. ".db" for "file.tool_db").
// This helper returns the full extension from the first dot in the basename.
function getFullExtname(filename) {
  const base = path.basename(filename);
  const dotIndex = base.indexOf('.');
  return dotIndex === -1 ? '' : base.slice(dotIndex).toLowerCase();
}

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = getFullExtname(file.originalname);
    const supported = getSupportedExtensions();
    if (supported.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported: ${supported.join(', ')}`));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /api/upload
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const parser = getParser(req.file.path);
    if (!parser) {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    const tools = parser.parse(req.file.path);

    // Store parsed data in memory for this session (keyed by upload filename)
    req.app.locals.uploads = req.app.locals.uploads || {};
    const uploadId = path.basename(req.file.filename, getFullExtname(req.file.filename));
    req.app.locals.uploads[uploadId] = {
      tools,
      format: parser.name,
      originalName: req.file.originalname,
      filePath: req.file.path,
    };

    res.json({
      uploadId,
      format: parser.name,
      originalName: req.file.originalname,
      tools: tools.map(t => ({
        name: t.name,
        sourceType: t.sourceType,
        type: t.type,
        compatible: t.compatible,
        diameter: t.diameter,
        category: t.category,
        metricTool: t.metricTool,
        fluteCount: t.fluteCount,
        feedRate: t.feedRate,
        spindleSpeed: t.spindleSpeed,
      })),
      stats: {
        total: tools.length,
        compatible: tools.filter(t => t.compatible).length,
        incompatible: tools.filter(t => !t.compatible).length,
      },
    });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: `Failed to parse file: ${err.message}` });
  }
});

module.exports = router;
