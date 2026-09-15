import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient, ApplicationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  profileFixture,
  analysisFixture,
  resumeFixture,
  descriptionFixture,
} from './career.fixtures';

describe('Manual ChatGPT workflow with real PostgreSQL', () => {
  const schema = 'jobflow_test_' + randomUUID().replaceAll('-', '');
  let admin: Pool;
  let prisma: PrismaClient;
  let app: NestExpressApplication;
  let created = false;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error('DATABASE_URL is required for integration tests');
    admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('CREATE SCHEMA "' + schema + '"');
    created = true;
    const connection = await admin.connect();
    try {
      await connection.query('SET search_path TO "' + schema + '"');
      for (const migration of [
        '20260813005030_init',
        '20260912163000_add_career_workspace',
      ]) {
        await connection.query(
          await readFile(
            join(__dirname, '../prisma/migrations', migration, 'migration.sql'),
            'utf8',
          ),
        );
      }
    } finally {
      connection.release();
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: process.env.DATABASE_URL },
        { schema },
      ),
    });
    await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.useBodyParser('json', { limit: '256kb' });
    await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (created && /^jobflow_test_[a-f0-9]{32}$/.test(schema))
      await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
    if (admin) await admin.end();
  });

  it('imports, reviews and downloads PDF without an AI provider', async () => {
    const http = app.getHttpServer() as App;
    await request(http).get('/profile').expect(200).expect({ content: null });
    const application = await request(http)
      .post('/applications')
      .send({ companyName: 'Acme', position: 'Engineer' })
      .expect(201);
    const { id } = application.body as { id: string };
    const base = '/applications/' + id;
    await request(http)
      .get(base + '/resume-prompt')
      .expect(400);
    await request(http)
      .put('/profile')
      .send({ ...profileFixture, userId: 'other' })
      .expect(400);
    await request(http).put('/profile').send(profileFixture).expect(200);
    await request(http)
      .put(base + '/description')
      .send({ jobDescription: 'short' })
      .expect(400);
    await request(http)
      .put(base + '/description')
      .send({ jobDescription: descriptionFixture })
      .expect(200);
    // The paid-provider endpoints have been removed.
    await request(http)
      .post(base + '/analyze')
      .expect(404);
    await request(http)
      .post(base + '/resumes')
      .expect(404);
    const prepared = await request(http)
      .get(base + '/resume-prompt')
      .expect(200);
    const prompt = prepared.body as { sourceId: string; prompt: string };
    expect(prompt.prompt).not.toContain(profileFixture.email);
    const response = JSON.stringify({
      sourceId: prompt.sourceId,
      analysis: analysisFixture,
      resume: resumeFixture,
    });
    await request(http)
      .post(base + '/resumes/import')
      .send({ response: 'not JSON' })
      .expect(400);
    await request(http)
      .post(base + '/resumes/import')
      .send({ response: 'x'.repeat(80001) })
      .expect(400);
    expect(await prisma.applicationAnalysis.count()).toBe(0);
    const imported = await request(http)
      .post(base + '/resumes/import')
      .send({ response })
      .expect(201);
    const resume = imported.body as { id: string; updatedAt: string };
    const resumeBase = base + '/resumes/' + resume.id;
    await request(http)
      .get(resumeBase + '/pdf')
      .expect(409);
    const edited = {
      ...resumeFixture,
      summary: { ...resumeFixture.summary, text: 'My reviewed summary.' },
    };
    await request(http)
      .patch(resumeBase)
      .send({ content: edited, reviewed: true, updatedAt: resume.updatedAt })
      .expect(200);
    await request(http)
      .patch(resumeBase)
      .send({ content: edited, reviewed: true, updatedAt: resume.updatedAt })
      .expect(409);
    const pdf = await request(http)
      .get(resumeBase + '/pdf')
      .expect(200)
      .expect('Content-Type', 'application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const fence = String.fromCharCode(96).repeat(3);
    await request(http)
      .post(base + '/resumes/import')
      .send({ response: fence + 'json\n' + response + '\n' + fence })
      .expect(201);
    expect(await prisma.resumeVersion.count()).toBe(2);
    const original = await prisma.resumeVersion.findUniqueOrThrow({
      where: { id: resume.id },
    });
    expect(original.content).toEqual(edited);
    expect(original.profileSnapshot).toEqual(profileFixture);
    await request(http)
      .put('/profile')
      .send({ ...profileFixture, skills: 'Python' })
      .expect(200);
    await request(http)
      .post(base + '/resumes/import')
      .send({ response })
      .expect(409);
    expect(await prisma.resumeVersion.count()).toBe(2);
    const stale = await request(http)
      .get(base + '/resume-workspace')
      .expect(200);
    expect(stale.body).toMatchObject({ analysisCurrent: false });
    await request(http)
      .get(resumeBase + '/pdf')
      .expect(200);
    for (const status of Object.values(ApplicationStatus)) {
      await request(http).patch(base).send({ status }).expect(200);
      expect(
        (await prisma.jobApplication.findUniqueOrThrow({ where: { id } }))
          .status,
      ).toBe(status);
    }
    await request(http)
      .get('/applications/' + randomUUID() + '/resumes/' + resume.id + '/pdf')
      .expect(404);
    await request(http).delete(base).expect(204);
    expect(await prisma.resumeVersion.count()).toBe(0);
    expect(await prisma.applicationAnalysis.count()).toBe(0);
    expect(await prisma.professionalProfile.count()).toBe(1);
  });
});
