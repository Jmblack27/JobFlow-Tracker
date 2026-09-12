import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Applications HTTP API', () => {
  let app: INestApplication<App>;
  const id = 'ed9053e4-e8d0-4fe7-bf10-cb8db149443b';
  const application = {
    id,
    position: 'Engineer',
    status: 'WISHLIST',
    company: { name: 'Acme' },
  };
  const db = {
    user: { upsert: jest.fn().mockResolvedValue({ id: 'demo-user' }) },
    jobApplication: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
    db.jobApplication.findMany.mockResolvedValue([application]);
    db.jobApplication.findFirst.mockResolvedValue(application);
    db.jobApplication.create.mockResolvedValue(application);
    db.jobApplication.update.mockResolvedValue(application);
    db.jobApplication.delete.mockResolvedValue(application);
  });
  afterAll(async () => {
    await app.close();
  });

  it('keeps the health endpoint', () =>
    request(app.getHttpServer()).get('/').expect(200).expect('Hello World!'));
  it('lists applications scoped to the local user', async () => {
    await request(app.getHttpServer())
      .get('/applications')
      .expect(200)
      .expect([application]);
    expect(db.jobApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { email: 'demo@jobflow.local' } },
      }),
    );
  });
  it('creates a trimmed application and its required relations in a transaction', async () => {
    await request(app.getHttpServer())
      .post('/applications')
      .send({ companyName: ' Acme ', position: ' Engineer ' })
      .expect(201);
    expect(db.jobApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          position: 'Engineer',
          company: { create: { name: 'Acme' } },
          user: { connect: { id: 'demo-user' } },
        }),
      }),
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('gets one application', () =>
    request(app.getHttpServer())
      .get('/applications/' + id)
      .expect(200)
      .expect(application));
  it.each(Object.values(ApplicationStatus))('moves to %s', async (status) => {
    await request(app.getHttpServer())
      .patch('/applications/' + id)
      .send({ status })
      .expect(200);
    expect(db.jobApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id, user: { email: 'demo@jobflow.local' } },
        data: { status },
      }),
    );
  });
  it('edits details and clears optional fields', async () => {
    await request(app.getHttpServer())
      .patch('/applications/' + id)
      .send({ position: 'Senior engineer', location: null, jobUrl: null })
      .expect(200);
    expect(db.jobApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { position: 'Senior engineer', location: null, jobUrl: null },
      }),
    );
  });
  it('deletes an application', () =>
    request(app.getHttpServer())
      .delete('/applications/' + id)
      .expect(204));
  it.each([
    {},
    { companyName: 'Acme' },
    { companyName: ' ', position: 'Engineer' },
    { companyName: 'Acme', position: 'Engineer', status: 'UNKNOWN' },
    {
      companyName: 'Acme',
      position: 'Engineer',
      jobUrl: 'javascript:alert(1)',
    },
    { companyName: 'Acme', position: 'Engineer', userId: 'other' },
    { companyName: 'Acme', position: 'Engineer', location: 42 },
  ])('rejects invalid create input %j', async (body) => {
    await request(app.getHttpServer())
      .post('/applications')
      .send(body)
      .expect(400);
    expect(db.jobApplication.create).not.toHaveBeenCalled();
  });
  it.each([{}, { status: null }, { position: '' }, { userId: 'other' }])(
    'rejects invalid patches %j',
    async (body) => {
      await request(app.getHttpServer())
        .patch('/applications/' + id)
        .send(body)
        .expect(400);
      expect(db.jobApplication.update).not.toHaveBeenCalled();
    },
  );
  it('rejects malformed ids', () =>
    request(app.getHttpServer()).get('/applications/not-a-uuid').expect(400));
  it('returns 404 for a missing application', async () => {
    db.jobApplication.findFirst.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get('/applications/' + id)
      .expect(404);
  });
  it.each(['patch', 'delete'] as const)(
    'returns 404 on missing %s',
    async (method) => {
      const error = new Prisma.PrismaClientKnownRequestError('Missing', {
        code: 'P2025',
        clientVersion: '7.9.1',
      });
      db.jobApplication[
        method === 'patch' ? 'update' : 'delete'
      ].mockRejectedValueOnce(error);
      await request(app.getHttpServer())
        [method]('/applications/' + id)
        .send({ status: 'APPLIED' })
        .expect(404);
    },
  );
});
