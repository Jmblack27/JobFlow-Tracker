import { ResumePdfService } from './resume-pdf.service';
import { profileFixture, resumeFixture } from '../../test/career.fixtures';

describe('Resume PDF', () => {
  it('keeps a concise resume on one page with traditional typography', async () => {
    const buffer = await new ResumePdfService().render(
      profileFixture,
      resumeFixture,
    );
    const pdf = buffer.toString('latin1');
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(pdf).toContain('/BaseFont /Times-Roman');
    expect(pdf).toContain('/BaseFont /Times-Bold');
  });
  it('produces a PDF with real text and automatic multi-page overflow', async () => {
    const content = {
      ...resumeFixture,
      sections: [
        {
          title: 'Experience' as const,
          items: Array.from({ length: 20 }, () => ({
            ...resumeFixture.summary,
            text: 'Long experience description. '.repeat(60),
          })),
        },
      ],
    };
    const buffer = await new ResumePdfService().render(profileFixture, content);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(
      buffer.toString('latin1').match(/\/Type \/Page\b/g)!.length,
    ).toBeGreaterThan(1);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
