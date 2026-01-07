import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Export agency playbook data to a Word document
 * @param {Object} agency - The agency data
 * @param {Object} playbookData - The playbook sections data
 */
export async function exportAgencyPlaybook(agency, playbookData) {
  const {
    notes,
    communicationHistory,
    designRequirements,
    productFocus,
    trainingNeeds,
    trainingHistory,
    upcomingSessions,
    marketStrategy
  } = playbookData;

  const doc = new Document({
    creator: 'Project Creator',
    title: `${agency?.agencyName || 'Agency'} - Playbook`,
    description: 'Agency Playbook Export',
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          children: [
            new TextRun({
              text: agency?.agencyName || 'Agency',
              bold: true,
              size: 48,
              color: '2563EB'
            })
          ],
          heading: HeadingLevel.TITLE,
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Agency Playbook',
              bold: true,
              size: 36
            })
          ],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
              italics: true,
              size: 20,
              color: '6B7280'
            })
          ],
          spacing: { after: 400 }
        }),

        // Agency Info
        ...createAgencyInfoSection(agency),

        // Section 1: Notes & Communication
        ...createNotesSection(notes, communicationHistory),

        // Section 2: Design Requirements
        ...createDesignRequirementsSection(designRequirements),

        // Section 3: Product Focus
        ...createProductFocusSection(productFocus),

        // Section 4: Training
        ...createTrainingSection(trainingNeeds, trainingHistory, upcomingSessions),

        // Section 5: Market Strategy
        ...createMarketStrategySection(marketStrategy)
      ]
    }]
  });

  // Generate and save the document
  const blob = await Packer.toBlob(doc);
  const fileName = `${(agency?.agencyName || 'Agency').replace(/[^a-zA-Z0-9]/g, '_')}_Playbook_${new Date().toISOString().split('T')[0]}.docx`;
  saveAs(blob, fileName);
}

function createSectionHeading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: level === HeadingLevel.HEADING_1 ? 32 : 26,
        color: level === HeadingLevel.HEADING_1 ? '1F2937' : '374151'
      })
    ],
    heading: level,
    spacing: { before: 400, after: 200 },
    border: level === HeadingLevel.HEADING_1 ? {
      bottom: { color: 'E5E7EB', size: 1, style: BorderStyle.SINGLE }
    } : undefined
  });
}

function createSubHeading(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: '4B5563'
      })
    ],
    spacing: { before: 200, after: 100 }
  });
}

function createTextParagraph(text, options = {}) {
  if (!text) return null;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22,
        ...options
      })
    ],
    spacing: { after: 100 }
  });
}

function createAgencyInfoSection(agency) {
  const paragraphs = [];
  
  if (agency) {
    const infoItems = [
      { label: 'Agency Name', value: agency.agencyName },
      { label: 'Location', value: [agency.city, agency.state].filter(Boolean).join(', ') },
      { label: 'Contact', value: agency.contactName },
      { label: 'Email', value: agency.contactEmail },
      { label: 'Phone', value: agency.phone }
    ].filter(item => item.value);

    if (infoItems.length > 0) {
      paragraphs.push(createSectionHeading('Agency Information'));
      
      infoItems.forEach(item => {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: `${item.label}: `, bold: true, size: 22 }),
            new TextRun({ text: item.value, size: 22 })
          ],
          spacing: { after: 50 }
        }));
      });
    }
  }
  
  return paragraphs;
}

function createNotesSection(notes, communicationHistory) {
  const paragraphs = [];
  
  paragraphs.push(createSectionHeading('1. Notes & Communication'));
  
  // Internal Notes
  paragraphs.push(createSubHeading('1.1 Internal Notes'));
  
  if (notes && notes.length > 0) {
    notes.forEach((note, index) => {
      const date = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'N/A';
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `[${date}]`, italics: true, size: 20, color: '6B7280' }),
          note.createdBy ? new TextRun({ text: ` by ${note.createdBy}`, italics: true, size: 20, color: '6B7280' }) : null
        ].filter(Boolean),
        spacing: { before: 100 }
      }));
      paragraphs.push(createTextParagraph(note.content));
    });
  } else {
    paragraphs.push(createTextParagraph('No internal notes recorded.', { italics: true, color: '9CA3AF' }));
  }
  
  // Communication History
  paragraphs.push(createSubHeading('1.2 Communication History'));
  
  if (communicationHistory && communicationHistory.length > 0) {
    communicationHistory.forEach((comm, index) => {
      const date = comm.date || comm.createdAt ? new Date(comm.date || comm.createdAt).toLocaleDateString() : 'N/A';
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `${comm.type?.toUpperCase() || 'COMMUNICATION'}`, bold: true, size: 22 }),
          new TextRun({ text: ` - ${date}`, size: 22 })
        ],
        spacing: { before: 150 }
      }));
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: 'Summary: ', bold: true, size: 22 }),
          new TextRun({ text: comm.summary || 'N/A', size: 22 })
        ],
        spacing: { after: 50 }
      }));
      if (comm.notes) {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: 'Notes: ', bold: true, size: 22 }),
            new TextRun({ text: comm.notes, size: 22 })
          ],
          spacing: { after: 100 }
        }));
      }
    });
  } else {
    paragraphs.push(createTextParagraph('No communication history recorded.', { italics: true, color: '9CA3AF' }));
  }
  
  return paragraphs;
}

function createDesignRequirementsSection(designRequirements) {
  const paragraphs = [];
  
  paragraphs.push(createSectionHeading('2. Design Requirements'));
  
  const fields = [
    { label: '2.1 Design Specifications', key: 'specifications' },
    { label: '2.2 Preferred Design Standards', key: 'preferredStandards' },
    { label: '2.3 Templates & Guidelines', key: 'templates' },
    { label: '2.4 Custom Design Preferences', key: 'customPreferences' },
    { label: '2.5 Best Practices & Guidelines', key: 'bestPractices' }
  ];
  
  fields.forEach(field => {
    paragraphs.push(createSubHeading(field.label));
    const value = designRequirements?.[field.key];
    if (value && value.trim()) {
      paragraphs.push(createTextParagraph(value));
    } else {
      paragraphs.push(createTextParagraph('Not specified.', { italics: true, color: '9CA3AF' }));
    }
  });
  
  return paragraphs;
}

function createProductFocusSection(productFocus) {
  const paragraphs = [];
  
  paragraphs.push(createSectionHeading('3. Product Focus'));
  
  // Products
  paragraphs.push(createSubHeading('3.1 Products'));
  
  if (productFocus && productFocus.length > 0) {
    productFocus.forEach((product, index) => {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `• ${product.name}`, bold: true, size: 22 }),
          product.category ? new TextRun({ text: ` (${product.category})`, size: 22, color: '6B7280' }) : null
        ].filter(Boolean),
        spacing: { before: 50 }
      }));
      if (product.notes) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `  ${product.notes}`, size: 20, color: '4B5563' })],
          indent: { left: 360 },
          spacing: { after: 50 }
        }));
      }
    });
  } else {
    paragraphs.push(createTextParagraph('No products tracked.', { italics: true, color: '9CA3AF' }));
  }
  
  return paragraphs;
}

function createTrainingSection(trainingNeeds, trainingHistory, upcomingSessions) {
  const paragraphs = [];
  
  paragraphs.push(createSectionHeading('4. Training'));
  
  // Training Needs
  paragraphs.push(createSubHeading('4.1 Training Needs'));
  
  if (trainingNeeds && trainingNeeds.length > 0) {
    trainingNeeds.forEach((need, index) => {
      const priority = need.priority ? ` [${need.priority.toUpperCase()}]` : '';
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `• ${need.topic}`, bold: true, size: 22 }),
          new TextRun({ text: priority, size: 20, color: need.priority === 'high' ? 'DC2626' : need.priority === 'medium' ? 'D97706' : '059669' })
        ],
        spacing: { before: 50 }
      }));
      if (need.notes) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `  ${need.notes}`, size: 20, color: '4B5563' })],
          indent: { left: 360 },
          spacing: { after: 50 }
        }));
      }
      if (need.requestedDate) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `  Requested: ${new Date(need.requestedDate).toLocaleDateString()}`, size: 18, italics: true, color: '6B7280' })],
          indent: { left: 360 },
          spacing: { after: 50 }
        }));
      }
    });
  } else {
    paragraphs.push(createTextParagraph('No training needs identified.', { italics: true, color: '9CA3AF' }));
  }
  
  // Upcoming Sessions
  paragraphs.push(createSubHeading('4.2 Upcoming Training Sessions'));
  
  if (upcomingSessions && upcomingSessions.length > 0) {
    upcomingSessions.forEach((session, index) => {
      const date = session.date ? new Date(session.date).toLocaleDateString() : 'TBD';
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `• ${session.topic}`, bold: true, size: 22 }),
          new TextRun({ text: ` - ${date}`, size: 22 })
        ],
        spacing: { before: 50 }
      }));
      const details = [session.time, session.duration, session.location].filter(Boolean).join(' | ');
      if (details) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `  ${details}`, size: 20, color: '4B5563' })],
          indent: { left: 360 },
          spacing: { after: 50 }
        }));
      }
    });
  } else {
    paragraphs.push(createTextParagraph('No upcoming sessions scheduled.', { italics: true, color: '9CA3AF' }));
  }
  
  // Training History
  paragraphs.push(createSubHeading('4.3 Training History'));
  
  if (trainingHistory && trainingHistory.length > 0) {
    trainingHistory.forEach((training, index) => {
      const date = training.completedDate ? new Date(training.completedDate).toLocaleDateString() : 'N/A';
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `• ${training.topic}`, size: 22 }),
          new TextRun({ text: ` - Completed: ${date}`, size: 20, color: '059669' })
        ],
        spacing: { before: 50, after: 50 }
      }));
    });
  } else {
    paragraphs.push(createTextParagraph('No training history recorded.', { italics: true, color: '9CA3AF' }));
  }
  
  return paragraphs;
}

function createMarketStrategySection(marketStrategy) {
  const paragraphs = [];
  
  paragraphs.push(createSectionHeading('5. Market Strategy'));
  
  const fields = [
    { label: '5.1 Regional Market Strategies', key: 'regionalStrategies' },
    { label: '5.2 Competitive Positioning', key: 'competitivePositioning' },
    { label: '5.3 Growth Opportunities', key: 'growthOpportunities' },
    { label: '5.4 Targets & Goals', key: 'targets' },
    { label: '5.5 Market Analysis', key: 'marketAnalysis' },
    { label: '5.6 Key Insights', key: 'insights' }
  ];
  
  fields.forEach(field => {
    paragraphs.push(createSubHeading(field.label));
    const value = marketStrategy?.[field.key];
    if (value && value.trim()) {
      paragraphs.push(createTextParagraph(value));
    } else {
      paragraphs.push(createTextParagraph('Not specified.', { italics: true, color: '9CA3AF' }));
    }
  });
  
  return paragraphs;
}

export default exportAgencyPlaybook;
