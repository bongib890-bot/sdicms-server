/* ==========================================================================
   Domain constants
   Crime categories follow the SAPS crime-statistic groupings.
   ========================================================================== */

module.exports = {
  CASE_CATEGORIES: [
    'Contact crime', 'Property-related', 'Commercial crime',
    'Drug-related', 'Sexual offence', 'Other'
  ],
  CASE_PRIORITIES: ['Critical', 'High', 'Medium', 'Low'],
  CASE_STATUSES: [
    'Reported', 'Assigned', 'Under investigation',
    'Awaiting forensics', 'Pending approval', 'Closed', 'Referred to NPA'
  ],
  EVIDENCE_TYPES: ['Photograph', 'Video', 'Audio', 'Document', 'Physical', 'Digital'],
  EVIDENCE_STATUSES: ['Pending verification', 'Verified', 'Chain break', 'Released'],
  SUSPECT_STATUSES: ['Sought', 'Detained', 'Arrested', 'Charged', 'Released'],
  STATEMENT_TYPES: ['Complainant', 'Witness', 'Suspect', 'Officer'],
  DOCUMENT_TYPES: [
    'Docket cover', 'Charge sheet', 'Warrant', 'Forensic report',
    'Court document', 'Correspondence', 'Other'
  ],
  SLA_DAYS: 30
};
