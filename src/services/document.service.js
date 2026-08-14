/* ==========================================================================
   Document service
   Charge sheets, warrants, forensic reports and correspondence filed against
   a docket. Hashed on upload and re-verified on download, the same way
   exhibits are.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ApiError = require('../utils/ApiError');
const present = require('../utils/present');
const { fileDigest } = require('../utils/hashChain');
const documentRepo = require('../repositories/document.repository');
const caseRepo = require('../repositories/case.repository');
const env = require('../config/env');
const { DOCUMENT_TYPES } = require('../config/constants');

async function list(filters) {
  const rows = await documentRepo.list(filters);
  return rows.map(present.documentRow);
}

async function create(data, file, user, scope) {
  if (!file) throw ApiError.badRequest('Attach a file to upload a document.');

  const docket = await caseRepo.findByNumber(data.caseNumber, scope);
  if (!docket) {
    fs.unlink(file.path, () => {});   // do not keep an orphaned upload
    throw ApiError.notFound('That docket is not within your scope.');
  }

  const docType = DOCUMENT_TYPES.includes(data.docType) ? data.docType : 'Other';
  const sha256 = await fileDigest(fs.createReadStream(file.path));

  const row = await documentRepo.create({
    caseId: docket.id,
    title: data.title || file.originalname,
    docType,
    originalFilename: file.originalname,
    filePath: file.path,
    fileSize: file.size,
    mimeType: file.mimetype,
    sha256,
    uploadedBy: user.id
  });

  return present.documentRow(row);
}

async function fileStream(id) {
  const row = await documentRepo.findById(id);
  if (!row) throw ApiError.notFound('That document does not exist.');

  const resolved = path.resolve(row.file_path);
  if (!resolved.startsWith(env.storagePath)) {
    throw ApiError.forbidden('That file path is outside the document store.');
  }
  if (!fs.existsSync(resolved)) throw ApiError.notFound('The stored file is missing.');

  const current = await fileDigest(fs.createReadStream(resolved));
  if (current !== row.sha256) {
    throw ApiError.conflict('This document no longer matches the digest recorded at upload.');
  }

  return { path: resolved, filename: row.original_filename, mimeType: row.mime_type };
}

module.exports = { list, create, fileStream };
