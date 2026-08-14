/* ==========================================================================
   Hash chaining
   Used by the audit log and the chain of custody. Each entry binds to the
   digest of the entry before it, so a row cannot be altered or removed
   without breaking every entry that follows.
   ========================================================================== */

const crypto = require('crypto');

const GENESIS = '0'.repeat(64);

/** SHA-256 of the previous digest plus this entry's canonical payload. */
function chain(prevHash, payload) {
  const canonical = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update((prevHash || GENESIS) + canonical).digest('hex');
}

/** SHA-256 of a file on disk, streamed so large video does not exhaust memory. */
function fileDigest(readStream) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    readStream.on('data', (chunk) => hash.update(chunk));
    readStream.on('end', () => resolve(hash.digest('hex')));
    readStream.on('error', reject);
  });
}

/**
 * Walk a chain and report the first entry whose stored digest does not match
 * a recomputation. Returns { intact, brokenAt }.
 */
function verifyChain(entries, payloadOf) {
  let prev = GENESIS;
  for (const entry of entries) {
    const expected = chain(prev, payloadOf(entry));
    if (expected !== entry.entry_hash) {
      return { intact: false, brokenAt: entry.id, seq: entry.seq };
    }
    prev = entry.entry_hash;
  }
  return { intact: true, brokenAt: null };
}

module.exports = { GENESIS, chain, fileDigest, verifyChain };
