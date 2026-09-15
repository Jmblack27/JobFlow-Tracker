import {
  parseInput,
  profileSchema,
  descriptionSchema,
  editResumeSchema,
} from './contracts';
import { profileFixture, resumeFixture } from '../../test/career.fixtures';

describe('Career input validation', () => {
  it('accepts a complete factual profile', () =>
    expect(parseInput(profileSchema, profileFixture)).toEqual(profileFixture));
  it.each([
    { ...profileFixture, fullName: ' ' },
    { ...profileFixture, skills: '' },
    { ...profileFixture, email: 'not-an-email' },
    { ...profileFixture, experience: 'x'.repeat(8001) },
    { ...profileFixture, userId: 'another-user' },
  ])('rejects invalid profile input', (body) =>
    expect(() => parseInput(profileSchema, body)).toThrow(),
  );
  it.each(['short', 'x'.repeat(20001)])(
    'rejects invalid descriptions',
    (jobDescription) => {
      expect(() => parseInput(descriptionSchema, { jobDescription })).toThrow();
    },
  );
  it('requires a concurrency timestamp and explicit review state when editing', () => {
    expect(() =>
      parseInput(editResumeSchema, { content: resumeFixture }),
    ).toThrow();
  });
});
