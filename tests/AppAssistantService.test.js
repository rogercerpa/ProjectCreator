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
      isAssistantReady: jest.fn().mockResolvedValue(false),
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
    expect(result.message.sources[0].action?.type).toBe('open-project');
    expect(result.message.meta.generationMode).toBe('grounded-fallback');
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

  test('matches projects using flexible RFA formatting', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'Can you summarize rfa 1001 for me?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Project summary');
    expect(result.message.sources[0].type).toBe('project');
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

  test('matches agency by contact details from question terms', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'What projects are tied to contact Jamie Smith?',
      context: { type: 'agency' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Agency summary');
    expect(result.message.sources[0].type).toBe('agency');
    expect(result.message.sources[0].action?.type).toBe('open-agency');
  });

  test('uses unified planner for broad cross-domain prompts', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'Give me an overall summary across projects, workload, BOM, and spec data',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Cross-domain overview');
    expect(result.message.sections[1].title).toBe('Grounded findings');
    expect(result.message.meta.reason).toBe('unified-query-planner');
    expect((result.message.sources || []).length).toBeGreaterThan(0);
  });

  test('uses AI direct answer when isAssistantReady returns true', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        sections: [
          {
            title: 'Project status',
            content: 'Alpha Medical Tower (RFA-1001) is currently In Progress. Agency: Smith Agency, Regional team: East.'
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
    expect(aiService.isAssistantReady).toHaveBeenCalled();
    expect(aiService.chatCompletion).toHaveBeenCalled();
    expect(result.message.sections[0].content).toContain('Alpha Medical Tower');
    expect(result.message.meta.generationMode).toBe('grounded-ai-polished');
  });

  test('falls back to deterministic handler when AI is unavailable', async () => {
    const service = createService();

    const result = await service.sendMessage({
      message: 'What is the status of RFA-1001?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections[0].title).toBe('Project summary');
    expect(result.message.meta.generationMode).toBe('grounded-fallback');
  });

  test('AI chatCompletion receives system prompt with domain schema', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        sections: [{ title: 'Answer', content: 'Test answer.' }]
      })
    };

    const service = createService({ aiService });
    await service.sendMessage({
      message: 'Which projects are overdue?',
      context: { type: 'workload' }
    });

    const [systemPrompt, userPrompt] = aiService.chatCompletion.mock.calls[0];
    expect(systemPrompt).toContain('Project Creator AI');
    expect(systemPrompt).toContain('rfaNumber');
    expect(systemPrompt).toContain('ANSWERING RULES');
    expect(userPrompt).toContain('QUESTION:');
    expect(userPrompt).toContain('APP DATA:');
  });

  test('threads conversation history into chatCompletion options', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'It is In Progress.'
      })
    };

    const service = createService({ aiService });

    const priorHistory = [
      { role: 'user', content: 'Tell me about RFA-1001.' },
      { role: 'assistant', content: 'Alpha Medical Tower is In Progress.' }
    ];

    await service.sendMessage({
      message: 'What is the regional team for that project?',
      context: { type: 'default' },
      history: priorHistory
    });

    expect(aiService.chatCompletion).toHaveBeenCalled();
    const [, , options] = aiService.chatCompletion.mock.calls[0];
    expect(Array.isArray(options.history)).toBe(true);
    expect(options.history.length).toBe(2);
    expect(options.history[0].role).toBe('user');
    expect(options.history[1].role).toBe('assistant');
  });

  test('AI returns simple answer shape and it is rendered as single titleless section', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'Alpha Medical Tower (RFA-1001) is currently In Progress.'
      })
    };

    const service = createService({ aiService });

    const result = await service.sendMessage({
      message: 'What is the status of RFA-1001?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    expect(result.message.sections.length).toBe(1);
    expect(result.message.sections[0].title).toBeNull();
    expect(result.message.sections[0].content).toContain('Alpha Medical Tower');
    expect(result.message.meta.generationMode).toBe('grounded-ai-polished');
  });

  test('targeted data context excludes workload section for non-workload questions', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'Smith Agency is in the East region.'
      })
    };

    const service = createService({ aiService });

    await service.sendMessage({
      message: 'Who is the contact at Smith Agency?',
      context: { type: 'agency', entityId: 'agency-1', label: 'Agency' }
    });

    expect(aiService.chatCompletion).toHaveBeenCalled();
    const [, userPrompt] = aiService.chatCompletion.mock.calls[0];
    expect(userPrompt).not.toContain('== WORKLOAD ==');
    expect(userPrompt).not.toContain('== BOM CATALOG ==');
  });

  test('targeted data context includes workload section for workload questions', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'There is 1 overdue assignment.'
      })
    };

    const service = createService({ aiService });

    await service.sendMessage({
      message: 'Which assignments are overdue?',
      context: { type: 'workload' }
    });

    expect(aiService.chatCompletion).toHaveBeenCalled();
    const [, userPrompt] = aiService.chatCompletion.mock.calls[0];
    expect(userPrompt).toContain('== WORKLOAD ==');
  });

  test('targeted data context includes knowledge base section only for KB questions', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'nLight-1 is a room controller in the Controls family.'
      })
    };

    const service = createService({ aiService });

    await service.sendMessage({
      message: 'What product families are available in the knowledge base?',
      context: { type: 'default' }
    });

    expect(aiService.chatCompletion).toHaveBeenCalled();
    const [, userPrompt] = aiService.chatCompletion.mock.calls[0];
    expect(userPrompt).toContain('== KNOWLEDGE BASE ==');
  });

  test('list/filter query sends full project set to the LLM, not just keyword matches', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'Two completed projects include nLight products.'
      })
    };

    // Create a broader project set — only 1 of 5 has "nlight" in name, but 3 should match by products field
    const projectPersistenceService = {
      loadProjects: jest.fn().mockResolvedValue([
        { id: 'p1', projectName: 'Alpha Medical Tower', rfaNumber: 'RFA-1001', status: 'Completed', rfaStatus: 'Completed', products: ['Controls - nLight'], updatedAt: '2026-03-01T00:00:00.000Z' },
        { id: 'p2', projectName: 'Beta Hospital', rfaNumber: 'RFA-1002', status: 'active', rfaStatus: 'In Progress', products: ['SensorSwitch'], updatedAt: '2026-02-01T00:00:00.000Z' },
        { id: 'p3', projectName: 'Gamma Stadium', rfaNumber: 'RFA-1003', status: 'Completed', rfaStatus: 'Completed', products: ['nLight Air', 'Pathway'], updatedAt: '2026-04-01T00:00:00.000Z' },
        { id: 'p4', projectName: 'Delta Office', rfaNumber: 'RFA-1004', status: 'Completed', rfaStatus: 'Completed', products: ['Daylighting'], updatedAt: '2025-09-01T00:00:00.000Z' },
        { id: 'p5', projectName: 'Epsilon Library', rfaNumber: 'RFA-1005', status: 'Cancelled', rfaStatus: 'Cancelled', products: ['nLight Wired'] }
      ])
    };

    const service = createService({ aiService, projectPersistenceService });

    await service.sendMessage({
      message: 'list projects completed this year that have nlight air product',
      context: { type: 'default', label: 'All App Data' }
    });

    expect(aiService.chatCompletion).toHaveBeenCalled();
    const [, userPrompt] = aiService.chatCompletion.mock.calls[0];

    // All 5 projects should appear in the context (list query -> full set)
    expect(userPrompt).toContain('ALL PROJECTS (5 of 5)');
    expect(userPrompt).toContain('Alpha Medical Tower');
    expect(userPrompt).toContain('Beta Hospital');
    expect(userPrompt).toContain('Gamma Stadium');
    expect(userPrompt).toContain('Delta Office');
    expect(userPrompt).toContain('Epsilon Library');
  });

  test('list query sources cite the full project list, not random matches', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'There are 0 completed projects with nLight Air.'
      })
    };

    const service = createService({ aiService });

    const result = await service.sendMessage({
      message: 'which projects are completed with nlight products?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    const sources = result.message.sources || [];
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].type).toBe('project');
    expect(sources[0].title).toMatch(/All projects/);
    expect(sources[0].action?.type).toBe('open-view');
  });

  test('specific-entity question (explicit RFA number) still routes to matched records only', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'Alpha Medical Tower is In Progress.'
      })
    };

    const service = createService({ aiService });

    await service.sendMessage({
      message: 'what is the status of RFA-1001?',
      context: { type: 'default' }
    });

    const [, userPrompt] = aiService.chatCompletion.mock.calls[0];
    expect(userPrompt).toContain('== MATCHED PROJECTS ==');
    expect(userPrompt).not.toContain('== ALL PROJECTS');
  });

  test('project haystack matches on products field for product-related lookups', async () => {
    const service = createService();

    const haystack = service._projectHaystack({
      projectName: 'Some Project',
      rfaNumber: 'RFA-9999',
      agencyName: 'Some Agency',
      products: ['Controls - nLight', 'nLight Air']
    });

    expect(haystack).toContain('nlight');
    expect(haystack).toContain('nlight air');
  });

  test('completedAt field is derived from updatedAt when project is Completed', async () => {
    const service = createService();

    const completedProject = service._projectForContext({
      projectName: 'X',
      status: 'Completed',
      rfaStatus: 'Completed',
      updatedAt: '2026-03-15T00:00:00.000Z'
    }, 'list');

    const activeProject = service._projectForContext({
      projectName: 'Y',
      status: 'active',
      rfaStatus: 'In Progress',
      updatedAt: '2026-03-15T00:00:00.000Z'
    }, 'list');

    expect(completedProject.completedAt).toBe('2026-03-15T00:00:00.000Z');
    expect(activeProject.completedAt).toBeNull();
  });

  test('extracts referenced projects from AI answer text by RFA number', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'Two projects match: Alpha Medical Tower (RFA-1001) and Gamma Stadium with RFA 1003.'
      })
    };

    const projectPersistenceService = {
      loadProjects: jest.fn().mockResolvedValue([
        { id: 'p1', projectName: 'Alpha Medical Tower', rfaNumber: 'RFA-1001', status: 'Completed' },
        { id: 'p2', projectName: 'Beta Hospital', rfaNumber: 'RFA-1002', status: 'active' },
        { id: 'p3', projectName: 'Gamma Stadium', rfaNumber: '1003', status: 'Completed' }
      ])
    };

    const service = createService({ aiService, projectPersistenceService });

    const result = await service.sendMessage({
      message: 'which completed projects are there?',
      context: { type: 'default' }
    });

    expect(result.success).toBe(true);
    const refs = result.message.referencedProjects || [];
    const refIds = refs.map((r) => r.id);
    expect(refIds).toContain('p1');
    expect(refIds).toContain('p3');
    expect(refIds).not.toContain('p2');
  });

  test('extracts referenced projects by exact project name match', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        sections: [
          {
            title: 'Completed with Pathway',
            content: 'Projects: NYU Bobst Library, EMORY PERFORMING ARTS CENTER, Town Creek Indian Mound.'
          }
        ]
      })
    };

    const projectPersistenceService = {
      loadProjects: jest.fn().mockResolvedValue([
        { id: 'nyu', projectName: 'NYU Bobst Library', rfaNumber: '306687-0', status: 'Completed' },
        { id: 'emory', projectName: 'EMORY PERFORMING ARTS CENTER', rfaNumber: '301944-3', status: 'Completed' },
        { id: 'town', projectName: 'Town Creek Indian Mound', rfaNumber: '316793-0', status: 'Completed' },
        { id: 'unrelated', projectName: 'Delta Office Park', rfaNumber: '999000-1', status: 'active' }
      ])
    };

    const service = createService({ aiService, projectPersistenceService });

    const result = await service.sendMessage({
      message: 'list projects completed this year with pathway',
      context: { type: 'default' }
    });

    const refIds = (result.message.referencedProjects || []).map((r) => r.id);
    expect(refIds).toEqual(expect.arrayContaining(['nyu', 'emory', 'town']));
    expect(refIds).not.toContain('unrelated');
  });

  test('does not duplicate a project referenced by both RFA number and name', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'Alpha Medical Tower (RFA-1001) is In Progress.'
      })
    };

    const service = createService({ aiService });

    const result = await service.sendMessage({
      message: 'status of RFA-1001?',
      context: { type: 'default' }
    });

    const refs = result.message.referencedProjects || [];
    const matching = refs.filter((r) => r.id === 'project-1');
    expect(matching.length).toBe(1);
  });

  test('extracts referenced agencies from AI answer text', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'Smith Agency is the rep for this project.'
      })
    };

    const service = createService({ aiService });

    const result = await service.sendMessage({
      message: 'who is the rep for this project?',
      context: { type: 'default' }
    });

    const agencyRefs = result.message.referencedAgencies || [];
    expect(agencyRefs.some((a) => a.id === 'agency-1')).toBe(true);
  });

  test('returns empty reference arrays when no matching entities appear in the answer', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        answer: 'No projects matched your criteria.'
      })
    };

    const service = createService({ aiService });

    const result = await service.sendMessage({
      message: 'which projects have some obscure product?',
      context: { type: 'default' }
    });

    expect(result.message.referencedProjects).toEqual([]);
    expect(result.message.referencedAgencies).toEqual([]);
  });

  test('empty history is handled gracefully and does not throw', async () => {
    const aiService = {
      isAssistantReady: jest.fn().mockResolvedValue(true),
      getRuntimeStatus: jest.fn().mockResolvedValue({ ready: true }),
      chatCompletion: jest.fn().mockResolvedValue({
        sections: [{ title: 'Answer', content: 'No issues found.' }]
      })
    };

    const service = createService({ aiService });

    const result = await service.sendMessage({
      message: 'Summarize all projects.',
      context: { type: 'default' }
      // no history key at all
    });

    expect(result.success).toBe(true);
    const [, , options] = aiService.chatCompletion.mock.calls[0];
    expect(Array.isArray(options.history)).toBe(true);
    expect(options.history.length).toBe(0);
  });
});
