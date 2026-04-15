const AppAssistantService = require('../main-process/services/AppAssistantService');

describe('AppAssistantService', () => {
  const createService = (overrides = {}) => new AppAssistantService({
    projectPersistenceService: {
      loadProjects: jest.fn().mockResolvedValue([
        {
          id: 'project-1',
          projectName: 'Alpha Medical Tower',
          rfaNumber: 'RFA-1001',
          status: 'In Progress',
          agencyName: 'Smith Agency',
          regionalTeam: 'East',
          rfaType: 'Design Build',
          bomData: {
            totalDevices: 12,
            totalLineItems: 4,
            devices: [{ catalogNumber: 'nLight-1', quantity: 6 }],
            startupCosts: { total: 1200 }
          }
        }
      ]),
      loadProjectById: jest.fn().mockResolvedValue({
        success: true,
        project: {
          id: 'project-1',
          projectName: 'Alpha Medical Tower',
          rfaNumber: 'RFA-1001',
          bomData: {
            totalDevices: 12,
            totalLineItems: 4,
            devices: [{ catalogNumber: 'nLight-1', quantity: 6 }],
            startupCosts: { total: 1200 }
          }
        }
      })
    },
    agencyService: {
      loadAgencies: jest.fn().mockResolvedValue([
        {
          id: 'agency-1',
          agencyName: 'Smith Agency',
          agencyNumber: 'A-22',
          contactName: 'Jamie Smith',
          contactEmail: 'jamie@smith.example',
          region: 'East',
          role: 'Primary'
        }
      ])
    },
    workloadPersistenceService: {
      loadUsers: jest.fn().mockResolvedValue({
        success: true,
        users: [{ id: 'user-1', name: 'Alex', isActive: true }]
      }),
      loadAssignments: jest.fn().mockResolvedValue({
        success: true,
        assignments: [
          {
            id: 'assignment-1',
            projectId: 'project-1',
            projectName: 'Alpha Medical Tower',
            status: 'IN PROGRESS',
            priority: 'high',
            dueDate: '2000-01-01',
            isOverdue: () => true
          }
        ]
      }),
      getStats: jest.fn().mockResolvedValue({
        success: true,
        stats: { activeAssignments: 1, activeUsers: 1 }
      })
    },
    bomPersistenceService: {
      getProjectBOMData: jest.fn().mockResolvedValue({
        totalDevices: 12,
        totalLineItems: 4,
        devices: [{ catalogNumber: 'nLight-1', quantity: 6 }],
        startupCosts: { total: 1200 },
        importedAt: '2026-04-15T00:00:00.000Z'
      }),
      getCatalogStats: jest.fn().mockResolvedValue({
        uniqueSKUs: 4,
        projectsCovered: 2,
        totalQuantity: 25
      }),
      loadStartupStats: jest.fn().mockResolvedValue({
        totalProjectsWithStartupData: 2,
        averageStartupCost: 900
      })
    },
    specReviewPersistenceService: {
      getReviewsForProject: jest.fn().mockResolvedValue({
        success: true,
        reviews: [{
          reviewId: 'review-1',
          projectSummary: 'Alpha spec review',
          complianceScore: 88,
          gapCount: 2,
          alternativeCount: 1,
          requirementCount: 10,
          linkedProjectName: 'Alpha Medical Tower'
        }]
      }),
      listReviews: jest.fn().mockResolvedValue({
        success: true,
        reviews: [{
          reviewId: 'review-1',
          projectSummary: 'Alpha spec review',
          complianceScore: 88,
          gapCount: 2,
          alternativeCount: 1,
          requirementCount: 10,
          linkedProjectName: 'Alpha Medical Tower'
        }]
      })
    },
    productKBService: {
      getProducts: jest.fn().mockResolvedValue({
        success: true,
        products: [{
          catalogNumber: 'nLight-1',
          productName: 'nLight Controller',
          productFamily: 'Controls',
          description: 'Room controller'
        }]
      }),
      getSpecRules: jest.fn().mockResolvedValue({
        success: true,
        specRules: [{
          requirementName: 'Occupancy sensing',
          category: 'Controls',
          keywords: 'occupancy,sensor',
          primaryDevices: 'nLight-1'
        }]
      }),
      getSummary: jest.fn().mockResolvedValue({
        success: true,
        summary: {
          totalProducts: 1,
          totalSpecRules: 1,
          totalAlternatives: 0
        }
      })
    },
    aiService: {
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: false }),
      chatCompletion: jest.fn()
    },
    ...overrides
  });

  test('returns project summary for project question', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'What is the status of RFA-1001?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Project summary');
    expect(result.message.sources[0].type).toBe('project');
  });

  test('returns workload summary for workload question', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'What assignments are overdue this week?',
      context: { type: 'workload' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Workload summary');
    expect(result.message.sources[0].type).toBe('workload');
  });

  test('returns BOM summary for project BOM question', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'Summarize this project BOM',
      context: { type: 'project', entityId: 'project-1' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Project BOM summary');
    expect(result.message.sources[0].type).toBe('bom');
  });

  test('returns spec review summary when asked about spec review', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'What did the spec review find?',
      context: { type: 'spec-review' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Spec review summary');
    expect(result.message.sources[0].type).toBe('spec-review');
  });

  test('returns knowledge base answer for product rule question', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'What does the knowledge base say about occupancy sensor product rules?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Knowledge base summary');
    expect(result.message.sources[0].type).toBe('knowledge-base');
  });

  test('uses AI service to polish grounded sections when local runtime is ready', async () => {
    const aiService = {
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        sections: [
          {
            title: 'Project summary',
            content: 'Alpha Medical Tower is in progress with grounded project data available.'
          }
        ]
      })
    };

    const service = createService({ aiService });

    const result = await service.sendMessage({
      message: 'What is the status of RFA-1001?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    expect(aiService.chatCompletion).toHaveBeenCalled();
    expect(result.message.sections[0].content).toContain('grounded project data');
    expect(result.message.sources[0].type).toBe('project');
  });
});
