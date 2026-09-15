import { CareerService } from './career.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ProfileService } from './profile.service';
import { sourceIdFor } from './manual-prompt';
import {
  analysisFixture,
  profileFixture,
  resumeFixture,
  descriptionFixture,
} from '../../test/career.fixtures';

describe('Manual resume persistence', () => {
  const id = 'application-id';
  const db = {
    applicationAnalysis: { findFirst: jest.fn(), create: jest.fn() },
    resumeVersion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const applications = { get: jest.fn() };
  const profiles = { get: jest.fn() };
  const payload = () => ({
    sourceId: sourceIdFor(id, profileFixture, descriptionFixture),
    analysis: analysisFixture,
    resume: resumeFixture,
  });
  let service: CareerService;
  beforeEach(() => {
    jest.resetAllMocks();
    applications.get.mockResolvedValue({
      id,
      jobDescription: descriptionFixture,
    });
    profiles.get.mockResolvedValue({ content: profileFixture });
    db.applicationAnalysis.findFirst.mockResolvedValue({
      id: 'analysis-id',
      content: analysisFixture,
      profileSnapshot: profileFixture,
      jobDescription: descriptionFixture,
    });
    db.applicationAnalysis.create.mockResolvedValue({ id: 'analysis-id' });
    db.resumeVersion.findMany.mockResolvedValue([]);
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
    service = new CareerService(
      db as unknown as PrismaService,
      applications as unknown as ApplicationsService,
      profiles as unknown as ProfileService,
    );
  });
  it('requires profile and description before preparing a prompt', async () => {
    profiles.get.mockResolvedValueOnce(null);
    await expect(service.prompt(id)).rejects.toThrow('Save My Profile');
    applications.get.mockResolvedValueOnce({ id, jobDescription: null });
    await expect(service.prompt(id)).rejects.toThrow('job description');
  });
  it('prepares a prompt without writing data', async () => {
    expect((await service.prompt(id)).prompt).toContain(descriptionFixture);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('atomically saves analysis, source snapshots and a draft', async () => {
    await service.importResponse(id, JSON.stringify(payload()));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(
      (db.applicationAnalysis.create.mock.calls[0] as unknown[])[0],
    ).toMatchObject({
      data: {
        applicationId: id,
        content: analysisFixture,
        profileSnapshot: profileFixture,
        model: 'manual-chatgpt',
      },
    });
    expect(
      (db.resumeVersion.create.mock.calls[0] as unknown[])[0],
    ).toMatchObject({
      data: {
        applicationId: id,
        analysisId: 'analysis-id',
        profileSnapshot: profileFixture,
        content: resumeFixture,
      },
    });
  });
  it('rejects stale profile responses without writes', async () => {
    profiles.get.mockResolvedValue({
      content: { ...profileFixture, skills: 'Python' },
    });
    await expect(
      service.importResponse(id, JSON.stringify(payload())),
    ).rejects.toThrow('older profile or offer');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect((await service.workspace(id)).analysisCurrent).toBe(false);
  });
  it('rejects mismatched applications or offers', async () => {
    await expect(
      service.importResponse('other', JSON.stringify(payload())),
    ).rejects.toThrow('different application');
    applications.get.mockResolvedValue({ id, jobDescription: 'Changed' });
    await expect(
      service.importResponse(id, JSON.stringify(payload())),
    ).rejects.toThrow('older profile or offer');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects malformed responses', async () => {
    await expect(service.importResponse(id, 'not JSON')).rejects.toThrow(
      'complete JSON block',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects invented evidence in analysis and in the resume', async () => {
    const evidence = [{ section: 'skills', quote: 'AWS certification' }];
    await expect(
      service.importResponse(
        id,
        JSON.stringify({
          ...payload(),
          analysis: {
            ...analysisFixture,
            matchingSkills: [{ requirement: 'AWS', evidence }],
          },
        }),
      ),
    ).rejects.toThrow('source evidence');
    await expect(
      service.importResponse(
        id,
        JSON.stringify({
          ...payload(),
          resume: {
            ...resumeFixture,
            summary: { text: 'AWS certified', evidence },
          },
        }),
      ),
    ).rejects.toThrow('source evidence');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('scopes resumes by application and local user', async () => {
    db.resumeVersion.findFirst.mockResolvedValue(null);
    await expect(service.getResume(id, 'resume-id')).rejects.toThrow(
      'Resume not found',
    );
    expect(db.resumeVersion.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'resume-id',
        applicationId: id,
        application: { user: { email: 'demo@jobflow.local' } },
      },
    });
  });
  it('rejects stale edits', async () => {
    db.resumeVersion.findFirst.mockResolvedValue({ id: 'resume-id' });
    db.resumeVersion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.edit(
        id,
        'resume-id',
        resumeFixture,
        true,
        '2026-09-12T12:00:00.000Z',
      ),
    ).rejects.toThrow('another tab');
  });
  it('clears review when saving an unreviewed draft', async () => {
    db.resumeVersion.findFirst.mockResolvedValue({ id: 'resume-id' });
    db.resumeVersion.updateMany.mockResolvedValue({ count: 1 });
    await service.edit(
      id,
      'resume-id',
      resumeFixture,
      false,
      '2026-09-12T12:00:00.000Z',
    );
    expect(
      (db.resumeVersion.updateMany.mock.calls[0] as unknown[])[0],
    ).toMatchObject({ data: { reviewedAt: null } });
  });
});
