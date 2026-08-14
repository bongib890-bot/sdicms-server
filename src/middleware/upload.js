/* ==========================================================================
   File uploads
   Files are written outside the web root and served only through an
   authenticated controller, so a leaked path cannot expose evidence.
   Filenames are generated, never taken from the client.
   ========================================================================== */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic',
  'video/mp4': '.mp4', 'video/quicktime': '.mov',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/mp4': '.m4a',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt'
};

function makeStorage(subdir) {
  return multer.diskStorage({
    destination(req, file, cb) {
      // Partition by year/month so a single directory never holds millions
      // of files, which cripples most filesystems.
      const now = new Date();
      const dir = path.join(
        env.storagePath, subdir,
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, '0')
      );
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = ALLOWED[file.mimetype] || path.extname(file.originalname) || '';
      cb(null, crypto.randomUUID() + ext);
    }
  });
}

function fileFilter(req, file, cb) {
  if (!ALLOWED[file.mimetype]) {
    return cb(ApiError.badRequest(
      `Files of type ${file.mimetype} are not accepted. Allowed: images, video, audio, PDF and Word documents.`
    ));
  }
  cb(null, true);
}

const limits = { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 };

module.exports = {
  evidenceUpload: multer({ storage: makeStorage('evidence'), fileFilter, limits }).single('file'),
  documentUpload: multer({ storage: makeStorage('documents'), fileFilter, limits }).single('file'),
  ALLOWED
};
