import {
  parseManualResponse,
  preparePrompt,
  sourceIdFor,
} from './manual-prompt';
import {
  analysisFixture,
  profileFixture,
  resumeFixture,
  descriptionFixture,
} from '../../test/career.fixtures';

describe('Manual prompt and response format', () => {
  const result = {
    sourceId: sourceIdFor('application', profileFixture, descriptionFixture),
    analysis: analysisFixture,
    resume: resumeFixture,
  };
  it('prepares an English, source-bound prompt without contacts', () => {
    const prepared = preparePrompt(
      'application',
      profileFixture,
      descriptionFixture,
    );
    expect(prepared.sourceId).toBe(result.sourceId);
    expect(prepared.prompt).toContain(descriptionFixture);
    expect(prepared.prompt).toContain(profileFixture.skills);
    expect(prepared.prompt).toContain('Never invent skills');
    expect(prepared.prompt).not.toContain(profileFixture.email);
    expect(prepared.prompt).not.toContain(profileFixture.fullName);
  });
  it('binds responses to the application, profile and offer', () => {
    expect(sourceIdFor('other', profileFixture, descriptionFixture)).not.toBe(
      result.sourceId,
    );
    expect(
      sourceIdFor(
        'application',
        { ...profileFixture, skills: 'Python' },
        descriptionFixture,
      ),
    ).not.toBe(result.sourceId);
    expect(sourceIdFor('application', profileFixture, 'Other offer')).not.toBe(
      result.sourceId,
    );
  });
  it('accepts plain JSON', () =>
    expect(parseManualResponse(JSON.stringify(result))).toEqual(result));
  it.each(['json', 'JSON', ''])(
    'accepts a single %s code block',
    (language) => {
      const fence = String.fromCharCode(96).repeat(3);
      expect(
        parseManualResponse(
          fence + language + '\n' + JSON.stringify(result) + '\n' + fence,
        ),
      ).toEqual(result);
    },
  );
  it.each(['Here is your resume', '{"sourceId":', 'Here is the result: {}'])(
    'rejects prose and incomplete JSON',
    (text) => {
      expect(() => parseManualResponse(text)).toThrow('complete JSON block');
    },
  );
  it('rejects unknown fields and invalid shapes', () => {
    expect(() =>
      parseManualResponse(JSON.stringify({ ...result, userId: 'other' })),
    ).toThrow();
    expect(() =>
      parseManualResponse(JSON.stringify({ ...result, resume: {} })),
    ).toThrow();
  });
});
