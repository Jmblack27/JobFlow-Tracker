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
        '20260915190000_add_job_category',
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
  it('previews without writes and saves a description-first application with its resume', async () => {
    const http = app.getHttpServer() as App;
    await request(http).put('/profile').send(profileFixture).expect(200);
    const before = await prisma.jobApplication.count();
    const prepared = await request(http)
      .post('/application-drafts/prompt')
      .send({ jobDescription: descriptionFixture })
      .expect(201);
    const prompt = prepared.body as { sourceId: string; prompt: string };
    expect(prompt.prompt).toContain('companyName');
    expect(prompt.prompt).not.toContain(profileFixture.email);
    const result = {
      sourceId: prompt.sourceId,
      application: {
        companyName: '',
        position: 'Engineer',
        location: '',
        jobUrl: '',
      },
      analysis: analysisFixture,
      resume: resumeFixture,
    };
    const input = {
      jobDescription: descriptionFixture,
      response: JSON.stringify(result),
    };
    await request(http)
      .post('/application-drafts/preview')
      .send(input)
      .expect(201);
    expect(await prisma.jobApplication.count()).toBe(before);
    const application = {
      ...result.application,
      companyName: 'Reviewed company',
      category: 'NON_IT',
      status: 'WISHLIST',
    };
    await request(http)
      .post('/application-drafts')
      .send({ ...input, application: { ...application, companyName: '' } })
      .expect(400);
    await request(http)
      .post('/application-drafts')
      .send({
        ...input,
        application: { ...application, jobUrl: 'javascript:alert(1)' },
      })
      .expect(400);
    await request(http)
      .post('/application-drafts/preview')
      .send({ ...input, response: 'incomplete JSON' })
      .expect(400);
    await request(http)
      .post('/application-drafts/preview')
      .send({
        ...input,
        jobDescription: descriptionFixture + ' Changed offer.',
      })
      .expect(409);
    await request(http)
      .post('/application-drafts/preview')
      .send({
        ...input,
        response: JSON.stringify({
          ...result,
          resume: {
            ...resumeFixture,
            summary: {
              text: 'Invented claim',
              evidence: [
                { section: 'skills', quote: 'unrelated fabricated evidence' },
              ],
            },
          },
        }),
      })
      .expect(400);
    await request(http)
      .put('/profile')
      .send({ ...profileFixture, skills: 'Changed skills' })
      .expect(200);
    await request(http)
      .post('/application-drafts')
      .send({ ...input, application })
      .expect(409);
    expect(await prisma.jobApplication.count()).toBe(before);
    await request(http).put('/profile').send(profileFixture).expect(200);
    const saved = await request(http)
      .post('/application-drafts')
      .send({ ...input, application })
      .expect(201);
    const body = saved.body as {
      id: string;
      resumes: { id: string; reviewedAt: string | null }[];
    };
    expect(saved.body).toMatchObject({
      position: 'Engineer',
      company: { name: 'Reviewed company' },
      jobDescription: descriptionFixture,
    });
    expect(saved.body).toMatchObject({ category: 'NON_IT' });
    await request(http)
      .patch('/applications/' + body.id)
      .send({ category: 'IT' })
      .expect(200);
    await request(http)
      .patch('/applications/' + body.id)
      .send({ category: 'INVALID' })
      .expect(400);
    const categorized = await request(http)
      .get('/applications/' + body.id)
      .expect(200);
    expect(categorized.body).toMatchObject({
      category: 'IT',
      status: 'WISHLIST',
    });
    expect(body.resumes).toHaveLength(1);
    expect(body.resumes[0].reviewedAt).toBeNull();
    const workspace = await request(http)
      .get('/applications/' + body.id + '/resume-workspace')
      .expect(200);
    expect(workspace.body).toMatchObject({
      analysisCurrent: true,
      analysis: { content: analysisFixture },
      resumes: [{ content: resumeFixture }],
    });
    await request(http)
      .get(
        '/applications/' + body.id + '/resumes/' + body.resumes[0].id + '/pdf',
      )
      .expect(409);
    await request(http)
      .delete('/applications/' + body.id)
      .expect(204);
    const manual = await request(http)
      .post('/applications')
      .send({
        companyName: 'Manual',
        position: 'Support',
        jobDescription: descriptionFixture,
      })
      .expect(201);
    expect(manual.body).toMatchObject({
      jobDescription: descriptionFixture,
      resumes: [],
      category: 'UNCATEGORIZED',
    });
    await request(http)
      .delete('/applications/' + (manual.body as { id: string }).id)
      .expect(204);
  });
});
