export function hasExactVersionApproval(input: {
  currentVersionId: string
  approvedVersionId?: string | null
  decision?: string | null
  moderatorRole?: string | null
}) {
  return input.decision === 'APPROVE'
    && input.approvedVersionId === input.currentVersionId
    && (input.moderatorRole === 'MODERATOR' || input.moderatorRole === 'ADMIN')
}

export function nextAfterAutomatedVerification(passed: boolean, revisionCount: number, maxRevisionCycles: number) {
  if (passed || revisionCount >= maxRevisionCycles) return 'final_review' as const
  return 'news_generation' as const
}

export function nextAfterFinalDecision(action: string | undefined, revisionCount: number, maxRevisionCycles: number) {
  if (action === 'approve') return 'translation_localization' as const
  if (action === 'request_changes' && revisionCount < maxRevisionCycles) return 'news_generation' as const
  return 'end' as const
}
