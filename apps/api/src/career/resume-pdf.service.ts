import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Profile, ResumeContent } from './contracts';

@Injectable()
export class ResumePdfService {
  render(profile: Profile, content: ResumeContent): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 48, bottom: 48, left: 54, right: 54 },
        info: {
          Title: profile.fullName + ' - Resume',
          Author: profile.fullName,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      const left = doc.page.margins.left;
      const width = doc.page.width - left - doc.page.margins.right;
      const bottom = () => doc.page.height - doc.page.margins.bottom;
      const clean = (text: string) =>
        text.replace(/[\u2010-\u2015\u2212]/g, '-');
      const body = () =>
        doc.font('Times-Roman').fontSize(11).fillColor('#111111');
      const ensureSpace = (height: number) => {
        if (doc.y + height > bottom()) doc.addPage();
      };
      const options = { width, lineGap: 2 };
      // One column of selectable text, without tables or decorative graphics.
      doc
        .font('Times-Bold')
        .fontSize(22)
        .fillColor('#111111')
        .text(clean(profile.fullName), left, doc.y, { width, align: 'center' });
      if (profile.headline) {
        doc
          .moveDown(0.2)
          .font('Times-Roman')
          .fontSize(11)
          .text(clean(profile.headline), left, doc.y, {
            width,
            align: 'center',
          });
      }
      const contact = [
        profile.location,
        profile.email,
        profile.phone,
        profile.links,
      ]
        .filter(Boolean)
        .map(clean)
        .join(' | ');
      if (contact) {
        doc
          .moveDown(0.35)
          .font('Times-Roman')
          .fontSize(10)
          .text(contact, left, doc.y, { width, align: 'center', lineGap: 2 });
      }
      doc.y += 14;
      body();
      doc.text(clean(content.summary.text), left, doc.y, options);
      // Keep the author's section order and wording; never infer dates or employers.
      for (const section of content.sections) {
        if (!section.items.length) continue;
        body();
        const firstHeight = doc.heightOfString(clean(section.items[0].text), {
          width: width - 13,
          lineGap: 2,
        });
        ensureSpace(
          40 + Math.min(firstHeight, bottom() - doc.page.margins.top - 40),
        );
        doc.y += 12;
        doc
          .font('Times-Bold')
          .fontSize(11)
          .text(section.title.toUpperCase(), left, doc.y, { width });
        const ruleY = doc.y + 3;
        doc
          .save()
          .lineWidth(0.6)
          .strokeColor('#111111')
          .moveTo(left, ruleY)
          .lineTo(left + width, ruleY)
          .stroke()
          .restore();
        doc.y = ruleY + 9;
        for (const item of section.items) {
          body();
          const text = clean(item.text);
          const itemOptions = { width: width - 13, lineGap: 2 };
          const height = doc.heightOfString(text, itemOptions);
          // Keep normal bullets together, but let oversized paragraphs flow naturally.
          const pageCapacity = bottom() - doc.page.margins.top;
          if (height <= pageCapacity) ensureSpace(height);
          const y = doc.y;
          doc.text('•', left + 1, y, { width: 10, lineBreak: false });
          doc.text(text, left + 13, y, itemOptions);
          doc.y += 5;
        }
      }
      doc.end();
    });
  }
}
