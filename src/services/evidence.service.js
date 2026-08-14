/* ==========================================================================
   Evidence service
   Exhibit registration, custody transfer, verification and file retrieval.

   The integrity rule that matters: an exhibit whose custody chain fails
   recomputation is marked as broken and cannot be verified or sealed. The
   system will not let an officer certify a chain it cannot itself confirm.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ApiError = require('../utils/ApiError');
const present = require('../utils/present');
const { fileDigest } = require('../utils/hashChain');
const evidenceRepo = require('../repositories/evidence.repository');
const caseRepo = require('../repositories/case.repository');
const env = require('../config/env');

async function list(filters) {
  const rows = await evidenceRepo.list(filters);

  return Promise.all(rows.map(async (row) => {
    const chainRows = await evidenceRepo.custodyFor(row.id);
    const integrity = await evidenceRepo.verifyCustody(row.id);
    return present.evidence(row, chainRows, integrity);
  }));
}

async function detail(exhibitNumber) {
  const row = await evidenceRepo.findByNumber(exhibitNumber);
  if (!row) throw ApiError.notFound('That exhibit is not on the register.');

  const chainRows = await evidenceRepo.custodyFor(row.id);
  const integrity = await evidenceRepo.verifyCustody(row.id);

  if (!integrity.intact && row.status !== 'Chain break') {
    await evidenceRepo.markChainBreak(row.id);
    row.status = 'Chain break';
  }

  return present.evidence(row, chainRows, integrity);
}

async function create(data, file, user, scope) {
  const docket = await caseRepo.findByNumber(data.caseNumber, scope);
  if (!docket) throw ApiError.notFound('That docket is not within your scope.');

  let sha256 = null;
  if (file) {
    // Hash before anything else touches the file, so the digest describes
    // exactly what was received.
    sha256 = await fileDigest(fs.createReadStream(file.path));
  }

  const id = await evidenceRepo.create({
    caseId: docket.id,
    label: data.label,
    evidenceType: data.evidenceType,
    description: data.description,
    storageLocation: data.storageLocation,
    collectedBy: user.id,
    collectorName: `${user.rank_title} ${user.full_name}`,
    collectedFrom: data.collectedFrom,
    originalFilename: file ? file.originalname : null,
    filePath: file ? file.path : null,
    fileSize: file ? file.size : null,
    mimeType: file ? file.mimetype : null,
    sha256
  });

  const row = await evidenceRepo.findById(id);
  const chainRows = await evidenceRepo.custodyFor(id);
  return present.evidence(row, chainRows, { intact: true, brokenAt: null });
}

async function transferCustody(exhibitNumber, { toParty, action }, user) {
  const row = await evidenceRepo.findByNumber(exhibitNumber);
  if (!row) throw ApiError.notFound('That exhibit is not on the register.');

  const integrity = await evidenceRepo.verifyCustody(row.id);
  if (!integrity.intact) {
    throw ApiError.conflict(
      'This exhibit has a broken custody chain and is locked. A supervisor must review it before it moves again.'
    );
  }

  await evidenceRepo.addCustody(row.id, {
    toParty,
    action,
    actorId: user.id,
    actorName: `${user.rank_title} ${user.full_name}`
  });

  return detail(exhibitNumber);
}

async function verifyExhibit(exhibitNumber, user) {
  const row = await evidenceRepo.findByNumber(exhibitNumber);
  if (!row) throw ApiError.notFound('That exhibit is not on the register.');

  const integrity = await evidenceRepo.verifyCustody(row.id);
  if (!integrity.intact) {
    await evidenceRepo.markChainBreak(row.id);
    throw ApiError.conflict(
      'This exhibit cannot be sealed: its custody chain does not verify. Entry ' +
      integrity.seq + ' does not hash to the entry before it.'
    );
  }

  if (row.status === 'Verified') {
    throw ApiError.conflict('That exhibit is already verified and sealed.');
  }

  await evidenceRepo.verify(row.id, user.id);
  return detail(exhibitNumber);
}

/**
 * Stream an exhibit file. The digest is recomputed first: if the bytes on
 * disk no longer match what was recorded, the download is refused rather
 * than handing over evidence that cannot be vouched for.
 */
async function fileStream(exhibitNumber) {
  const row = await evidenceRepo.findByNumber(exhibitNumber);
  if (!row) throw ApiError.notFound('That exhibit is not on the register.');
  if (!row.file_path) throw ApiError.notFound('That exhibit has no attached file.');

  const resolved = path.resolve(row.file_path);
  if (!resolved.startsWith(env.storagePath)) {
    throw ApiError.forbidden('That file path is outside the evidence vault.');
  }
  if (!fs.existsSync(resolved)) {
    throw ApiError.notFound('The stored file is missing from the vault.');
  }

  const current = await fileDigest(fs.createReadStream(resolved));
  if (row.sha256 && current !== row.sha256) {
    await evidenceRepo.markChainBreak(row.id);
    throw ApiError.conflict(
      'The stored file no longer matches the digest recorded at upload. The exhibit has been flagged and the download refused.'
    );
  }

  return {
    path: resolved,
    filename: row.original_filename,
    mimeType: row.mime_type || 'application/octet-stream'
  };
}

module.exports = { list, detail, create, transferCustody, verifyExhibit, fileStream };
