import test from 'node:test'
import assert from 'node:assert/strict'
import { hasExactVersionApproval, nextAfterAutomatedVerification, nextAfterFinalDecision } from '@/lib/agents/policy'

test('publication requires an authorized approval for the exact draft version', () => {
  assert.equal(hasExactVersionApproval({ currentVersionId: 'v2', approvedVersionId: 'v2', decision: 'APPROVE', moderatorRole: 'MODERATOR' }), true)
  assert.equal(hasExactVersionApproval({ currentVersionId: 'v2', approvedVersionId: 'v1', decision: 'APPROVE', moderatorRole: 'MODERATOR' }), false)
  assert.equal(hasExactVersionApproval({ currentVersionId: 'v2', approvedVersionId: 'v2', decision: 'REJECT', moderatorRole: 'ADMIN' }), false)
  assert.equal(hasExactVersionApproval({ currentVersionId: 'v2', approvedVersionId: 'v2', decision: 'APPROVE', moderatorRole: 'READER' }), false)
})

test('failed verification has bounded revision cycles', () => {
  assert.equal(nextAfterAutomatedVerification(false, 1, 2), 'news_generation')
  assert.equal(nextAfterAutomatedVerification(false, 2, 2), 'final_review')
  assert.equal(nextAfterAutomatedVerification(true, 0, 2), 'final_review')
})

test('human approval, revision, and rejection have explicit routes', () => {
  assert.equal(nextAfterFinalDecision('approve', 0, 2), 'translation_localization')
  assert.equal(nextAfterFinalDecision('request_changes', 1, 2), 'news_generation')
  assert.equal(nextAfterFinalDecision('request_changes', 2, 2), 'end')
  assert.equal(nextAfterFinalDecision('reject', 0, 2), 'end')
})
