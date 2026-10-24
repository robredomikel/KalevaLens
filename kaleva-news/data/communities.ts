import { mockSectionsData } from '@/data/mockNews'

export interface CommunityOption {
  id: string
  name: string
  description: string
  icon: string
  memberCount: number | null
}

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function getAvailableCommunities(): CommunityOption[] {
  return Object.keys(mockSectionsData.communities).map((name) => ({
    id: slugify(name),
    name,
    description: `Local updates and conversations from ${name}.`,
    icon: '👥',
    memberCount: null,
  }))
}

export function isValidCommunityId(id: string | null): boolean {
  return id === null || getAvailableCommunities().some((community) => community.id === id)
}
