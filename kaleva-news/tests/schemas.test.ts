import test from 'node:test'
import assert from 'node:assert/strict'
import { contentVerificationSchema, humanDecisionSchema, verificationReportSchema } from '@/lib/ai/schemas'

test('source verification cannot silently omit evidence assessment', () => {
  assert.equal(verificationReportSchema.safeParse({ candidateId: '1' }).success, false)
})

test('content verification supports failed drafts with actionable issues', () => {
  const result = contentVerificationSchema.parse({ passed: false, issues: [{ claim: 'Claim', issueType: 'unsupported', severity: 'high', supportingEvidence: [], recommendedCorrection: 'Remove it' }] })
  assert.equal(result.passed, false)
})

test('human decisions reject unsupported actions', () => {
  assert.equal(humanDecisionSchema.safeParse({ action: 'publish_without_review' }).success, false)
  assert.equal(humanDecisionSchema.parse({ action: 'approve' }).action, 'approve')
})
