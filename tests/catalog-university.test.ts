import { describe, it, expect } from 'vitest';
import { PROJECTS, getProject } from '@/game/catalog/definitions';
describe('catalog', () => {
  it('resolves community_university', () => {
    expect(Object.keys(PROJECTS)).toContain('community_university');
    expect(getProject('community_university').landmarkBlueprint).toBe('landmark_university');
  });
});
