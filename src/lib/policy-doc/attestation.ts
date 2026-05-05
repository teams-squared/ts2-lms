/**
 * Single source of truth for the ISO policy-doc attestation statement.
 *
 * Used by both PolicyDocViewer (display, client) and the lesson-complete
 * route (audit snapshot, server) so the string we store in the audit
 * record is exactly the one we showed the learner. If this template ever
 * changes, both call sites change together — but historical
 * `LessonProgress.acknowledgedAttestationText` rows remain frozen with
 * the wording the original ack'er actually saw.
 */
export function formatPolicyAttestation(
  documentTitle: string,
  sourceVersion: string,
): string {
  return `I have read and understood ${documentTitle} v${sourceVersion}.`;
}
