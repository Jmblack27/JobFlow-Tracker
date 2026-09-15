import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Profile, ResumeContent } from './contracts';

@Injectable()
export class ResumePdfService {
  render(profile: Profile, content: ResumeContent): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: { Title: profile.fullName + ' - Resume' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      // PDFKit wraps text and adds pages automatically; no model HTML is rendered.
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#192b36')
        .text(profile.fullName);
      if (profile.headline)
        doc.font('Helvetica').fontSize(12).text(profile.headline);
      doc
        .moveDown(0.5)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text(
          [profile.email, profile.phone, profile.location, profile.links]
            .filter(Boolean)
            .join(' | '),
        );
      doc.moveDown().fontSize(11).text(content.summary.text, { lineGap: 3 });
      for (const section of content.sections) {
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc
          .moveDown()
          .font('Helvetica-Bold')
          .fontSize(13)
          .fillColor('#225d50')
          .text(section.title);
        doc.font('Helvetica').fontSize(11).fillColor('#222222');
        for (const item of section.items)
          doc.moveDown(0.5).text(item.text, { lineGap: 3 });
      }
      doc.end();
    });
  }
}
