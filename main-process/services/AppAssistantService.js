class AppAssistantService {
  constructor({
    projectPersistenceService,
    agencyService,
    workloadPersistenceService,
    bomPersistenceService,
    specReviewPersistenceService,
    productKBService,
    aiService
  }) {
    this.projectPersistenceService = projectPersistenceService;
    this.agencyService = agencyService;
    this.workloadPersistenceService = workloadPersistenceService;
    this.bomPersistenceService = bomPersistenceService;
    this.specReviewPersistenceService = specReviewPersistenceService;
    this.productKBService = productKBService;
    this.aiService = aiService || null;
  }

  getStatus() {
    return {
      success: true,
      status: 'ready',
      mode: 'local-app-data',
      supportedDomains: ['projects', 'agencies', 'workload', 'bom', 'spec-reviews', 'knowledge-base']
    };
  }

  resetSession() {
    return {
      success: true,
      message: 'Assistant session reset.'
    };
  }

  async sendMessage(payload = {}) {
    const message = String(payload.message || '').trim();
    const context = payload.context || {};
    const normalizedMessage = message.toLowerCase();

    if (!message) {
      return { success: false, error: 'Message is required.' };
    }

    const handlers = this._buildHandlerList(normalizedMessage, context);

    for (const handler of handlers) {
      const result = await handler(normalizedMessage, context);
      if (result) {
        const enhancedResult = await this._enhanceResponseIfAvailable(result, message, context);
        return {
          success: true,
          status: 'ready',
          message: enhancedResult
        };
      }
    }

    return {
      success: true,
      status: 'ready',
      message: this._createResponse({
        idPrefix: 'fallback',
        sections: [
          {
            title: 'No grounded answer yet',
            content: 'I could not find enough grounded app data to answer that confidently.'
          },
          {
            title: 'What is currently supported',
            content: 'Try asking about project status, agencies, workload and schedule, BOM summaries, spec reviews, or product knowledge.'
          },
          {
            title: 'Suggested next step',
            content: 'Examples: "What is the status of project RFA-12345?", "What assignments are overdue?", or "Summarize this project BOM."'
          }
        ]
      })
    };
  }

  _buildHandlerList(message, context) {
    const handlers = [];

    if (this._isBOMQuestion(message, context)) handlers.push(this._tryBOMAnswer.bind(this));
    if (this._isSpecReviewQuestion(message, context)) handlers.push(this._trySpecReviewAnswer.bind(this));
    if (this._isWorkloadQuestion(message, context)) handlers.push(this._tryWorkloadAnswer.bind(this));
    if (this._isKnowledgeBaseQuestion(message, context)) handlers.push(this._tryKnowledgeBaseAnswer.bind(this));

    handlers.push(
      this._tryProjectAnswer.bind(this),
      this._tryAgencyAnswer.bind(this),
      this._tryWorkloadAnswer.bind(this),
      this._tryBOMAnswer.bind(this),
      this._trySpecReviewAnswer.bind(this),
      this._tryKnowledgeBaseAnswer.bind(this)
    );

    return handlers;
  }

  async _tryProjectAnswer(message, context) {
    const projects = await this.projectPersistenceService.loadProjects();
    if (!Array.isArray(projects) || projects.length === 0) return null;

    const project = this._resolveProject(projects, message, context);
    if (!project) return null;

    const risks = [];
    if (project.ecd) risks.push(`ECD: ${project.ecd}`);
    if (project.dueDate) risks.push(`Due: ${project.dueDate}`);
    if (project.status) risks.push(`Status: ${project.status}`);
    if (project.rfaStatus) risks.push(`RFA status: ${project.rfaStatus}`);

    return this._createResponse({
      idPrefix: 'project',
      entityId: project.id,
      sections: [
        {
          title: 'Project summary',
          content: `${project.projectName || 'Project'} (${project.rfaNumber || 'No RFA'}) is currently ${project.status || 'missing a saved status'}.`
        },
        {
          title: 'Known details',
          content: [
            project.agencyName ? `Agency: ${project.agencyName}` : null,
            project.regionalTeam ? `Regional team: ${project.regionalTeam}` : null,
            project.rfaType ? `RFA type: ${project.rfaType}` : null,
            project.products ? `Products: ${Array.isArray(project.products) ? project.products.join(', ') : project.products}` : null,
            risks.length > 0 ? risks.join(' | ') : null
          ].filter(Boolean).join('\n')
        },
        {
          title: 'Suggested next step',
          content: 'Open the project details view if you need to review the full record, BOM data, linked spec reviews, or project scheduling details.'
        }
      ],
      sources: [
        this._createSource('project', project.projectName || project.rfaNumber || 'Project record', `Matched saved project record${project.status ? ` with status ${project.status}` : ''}.`)
      ]
    });
  }

  async _tryAgencyAnswer(message, context) {
    const agencies = await this.agencyService.loadAgencies();
    if (!Array.isArray(agencies) || agencies.length === 0) return null;

    let agency = null;
    if (context?.type === 'agency' && context?.entityId) {
      agency = agencies.find((entry) => entry.id === context.entityId) || null;
    }

    if (!agency) {
      agency = agencies.find((entry) => this._containsMeaningfulMatch(message, this._agencyHaystack(entry))) || null;
    }

    if (!agency) return null;

    const projects = await this.projectPersistenceService.loadProjects();
    const relatedProjects = Array.isArray(projects)
      ? projects.filter((entry) =>
          (entry.agencyName && agency.agencyName && entry.agencyName.toLowerCase() === agency.agencyName.toLowerCase()) ||
          (entry.agentNumber && agency.agencyNumber && String(entry.agentNumber).toLowerCase() === String(agency.agencyNumber).toLowerCase())
        )
      : [];

    const activeProjects = relatedProjects.filter((entry) => (entry.status || '').toLowerCase() !== 'completed');

    return this._createResponse({
      idPrefix: 'agency',
      entityId: agency.id,
      sections: [
        {
          title: 'Agency summary',
          content: `${agency.agencyName || 'Agency'} is the best local match for your question.`
        },
        {
          title: 'Known details',
          content: [
            agency.agencyNumber ? `Agency number: ${agency.agencyNumber}` : null,
            agency.contactName ? `Primary contact: ${agency.contactName}` : null,
            agency.contactEmail ? `Email: ${agency.contactEmail}` : null,
            agency.phoneNumber ? `Phone: ${agency.phoneNumber}` : null,
            agency.region ? `Region: ${agency.region}` : null,
            agency.role ? `Role: ${agency.role}` : null
          ].filter(Boolean).join('\n')
        },
        {
          title: 'Related activity',
          content: relatedProjects.length > 0
            ? `${relatedProjects.length} saved project(s) reference this agency, including ${activeProjects.slice(0, 3).map((entry) => entry.projectName || entry.rfaNumber).filter(Boolean).join(', ') || 'active work items'}.`
            : 'No saved projects are currently linked to this agency in local app data.'
        }
      ],
      sources: [
        this._createSource('agency', agency.agencyName || agency.agencyNumber || 'Agency record', `Matched saved agency record${agency.region ? ` in region ${agency.region}` : ''}.`),
        ...(relatedProjects.length > 0
          ? [this._createSource('project', `${relatedProjects.length} related project(s)`, 'Matched project records by agency name or agent number.')]
          : [])
      ]
    });
  }

  async _tryWorkloadAnswer(message, context) {
    if (!this.workloadPersistenceService) return null;

    const [usersResult, assignmentsResult, statsResult] = await Promise.all([
      this.workloadPersistenceService.loadUsers(),
      this.workloadPersistenceService.loadAssignments(),
      this.workloadPersistenceService.getStats()
    ]);

    const users = usersResult?.users || [];
    let assignments = assignmentsResult?.assignments || [];
    if (!users.length && !assignments.length) return null;

    if (context?.type === 'project' && context?.entityId) {
      assignments = assignments.filter((entry) => entry.projectId === context.entityId);
    }

    const overdueAssignments = assignments
      .filter((entry) => typeof entry.isOverdue === 'function' ? entry.isOverdue() : (entry.dueDate && new Date(entry.dueDate) < new Date() && entry.status !== 'COMPLETE'))
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

    const highPriority = assignments.filter((entry) => ['high', 'urgent'].includes(String(entry.priority || '').toLowerCase()));
    const activeAssignments = assignments.filter((entry) => entry.status !== 'COMPLETE');

    if (!this._isWorkloadQuestion(message, context) && !activeAssignments.length) return null;

    return this._createResponse({
      idPrefix: 'workload',
      sections: [
        {
          title: 'Workload summary',
          content: context?.type === 'project' && context?.entityId
            ? `${activeAssignments.length} active assignment(s) are linked to the current project.`
            : `${statsResult?.stats?.activeAssignments ?? activeAssignments.length} active assignment(s) are tracked across ${statsResult?.stats?.activeUsers ?? users.filter((user) => user.isActive).length} active user(s).`
        },
        {
          title: 'Schedule signals',
          content: [
            overdueAssignments.length > 0 ? `${overdueAssignments.length} assignment(s) are overdue.` : 'No overdue assignments were found in local workload data.',
            highPriority.length > 0 ? `${highPriority.length} assignment(s) are marked high or urgent priority.` : null,
            activeAssignments.length > 0
              ? `Top items: ${activeAssignments.slice(0, 3).map((entry) => `${entry.projectName || entry.rfaNumber || 'Assignment'} (${entry.status})`).join(', ')}`
              : null
          ].filter(Boolean).join('\n')
        },
        {
          title: 'Suggested next step',
          content: 'Open the workload dashboard to rebalance assignments, review due dates, and inspect team capacity in detail.'
        }
      ],
      sources: [
        this._createSource('workload', 'Assignment data', `${assignments.length} assignment record(s) were scanned.`),
        this._createSource('workload', 'Workload statistics', 'Summary counts came from local workload users and assignments.')
      ]
    });
  }

  async _tryBOMAnswer(message, context) {
    if (!this.bomPersistenceService) return null;

    const projects = await this.projectPersistenceService.loadProjects();
    const project = Array.isArray(projects) ? this._resolveProject(projects, message, context) : null;

    if (project?.id) {
      const bomData = await this.bomPersistenceService.getProjectBOMData(project.id);
      if (bomData) {
        const topDevices = Array.isArray(bomData.devices)
          ? bomData.devices
              .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
              .slice(0, 3)
              .map((device) => `${device.catalogNumber || device.description || 'Device'} x${device.quantity || 0}`)
          : [];

        return this._createResponse({
          idPrefix: 'bom-project',
          entityId: project.id,
          sections: [
            {
              title: 'Project BOM summary',
              content: `${project.projectName || 'This project'} has ${bomData.totalDevices || 0} total device(s) across ${bomData.totalLineItems || 0} line item(s).`
            },
            {
              title: 'Known BOM details',
              content: [
                topDevices.length > 0 ? `Top devices: ${topDevices.join(', ')}` : null,
                bomData.startupCosts?.total ? `Startup cost total: ${bomData.startupCosts.total}` : null,
                bomData.importedAt ? `Imported: ${bomData.importedAt}` : null
              ].filter(Boolean).join('\n')
            },
            {
              title: 'Suggested next step',
              content: 'Open the project BOM view or BOM QC tools if you need to validate requirements, startup costs, or device-level details.'
            }
          ],
          sources: [
            this._createSource('bom', `${project.projectName || project.rfaNumber || 'Project'} BOM`, 'Matched BOM data saved on the project record.')
          ]
        });
      }
    }

    if (!this._isBOMQuestion(message, context)) return null;

    const [catalogStats, startupStats] = await Promise.all([
      this.bomPersistenceService.getCatalogStats(),
      this.bomPersistenceService.loadStartupStats()
    ]);

    return this._createResponse({
      idPrefix: 'bom-catalog',
      sections: [
        {
          title: 'BOM catalog summary',
          content: `${catalogStats.uniqueSKUs || 0} unique SKU(s) are tracked across ${catalogStats.projectsCovered || 0} project(s), with ${catalogStats.totalQuantity || 0} total device quantity recorded.`
        },
        {
          title: 'Startup cost summary',
          content: startupStats.totalProjectsWithStartupData
            ? `${startupStats.totalProjectsWithStartupData} project(s) include startup data, with an average startup cost of ${Math.round(startupStats.averageStartupCost || 0)}.`
            : 'No startup cost statistics are currently saved in local BOM data.'
        }
      ],
      sources: [
        this._createSource('bom', 'BOM catalog', 'Used aggregated BOM catalog and startup statistics stored locally.')
      ]
    });
  }

  async _trySpecReviewAnswer(message, context) {
    if (!this.specReviewPersistenceService) return null;

    let review = null;

    if (context?.type === 'project' && context?.entityId) {
      const projectReviewsResult = await this.specReviewPersistenceService.getReviewsForProject(context.entityId);
      review = projectReviewsResult?.reviews?.[0] || null;
    }

    if (!review) {
      const listResult = await this.specReviewPersistenceService.listReviews();
      const reviews = listResult?.reviews || [];
      if (context?.type === 'spec-review') {
        review = reviews[0] || null;
      }
      if (!review) {
        review = reviews.find((entry) => this._containsMeaningfulMatch(message, this._specReviewHaystack(entry))) || null;
      }
    }

    if (!review) return null;

    const complianceBits = [];
    if (review.complianceScore != null) complianceBits.push(`Compliance score: ${review.complianceScore}`);
    if (review.gapCount != null) complianceBits.push(`Gaps: ${review.gapCount}`);
    if (review.alternativeCount != null) complianceBits.push(`Alternatives: ${review.alternativeCount}`);
    if (review.requirementCount != null) complianceBits.push(`Requirements: ${review.requirementCount}`);

    return this._createResponse({
      idPrefix: 'spec-review',
      entityId: review.reviewId,
      sections: [
        {
          title: 'Spec review summary',
          content: review.projectSummary || review.sourceFile || `Spec review ${review.reviewId}`
        },
        {
          title: 'Compliance details',
          content: complianceBits.length > 0
            ? complianceBits.join(' | ')
            : 'This saved spec review does not yet include detailed compliance counts in the local index.'
        },
        {
          title: 'Suggested next step',
          content: review.linkedProjectName
            ? `Review the linked project ${review.linkedProjectName} and open the saved spec review to inspect requirements and gaps in detail.`
            : 'Open the saved spec review to inspect requirements, compliance scoring, and linked project details.'
        }
      ],
      sources: [
        this._createSource('spec-review', review.projectSummary || review.sourceFile || review.reviewId, 'Matched saved spec review metadata from the local review index.')
      ]
    });
  }

  async _tryKnowledgeBaseAnswer(message, context) {
    if (!this.productKBService || !this._isKnowledgeBaseQuestion(message, context)) return null;

    const [productsResult, specRulesResult, summaryResult] = await Promise.all([
      this.productKBService.getProducts(),
      this.productKBService.getSpecRules(),
      this.productKBService.getSummary()
    ]);

    const products = productsResult?.products || [];
    const specRules = specRulesResult?.specRules || [];
    const matchingProduct = products.find((entry) => this._containsMeaningfulMatch(message, this._objectHaystack(entry))) || null;
    const matchingRule = specRules.find((entry) => this._containsMeaningfulMatch(message, this._objectHaystack(entry))) || null;

    if (!matchingProduct && !matchingRule && !summaryResult?.summary) return null;

    return this._createResponse({
      idPrefix: 'kb',
      sections: [
        {
          title: 'Knowledge base summary',
          content: summaryResult?.summary
            ? `${summaryResult.summary.totalProducts} product(s), ${summaryResult.summary.totalSpecRules} spec rule(s), and ${summaryResult.summary.totalAlternatives} alternative mapping(s) are available in the local knowledge base.`
            : 'The local product knowledge base is available.'
        },
        {
          title: 'Best local match',
          content: matchingProduct
            ? this._formatKnowledgeBaseProduct(matchingProduct)
            : matchingRule
              ? this._formatKnowledgeBaseRule(matchingRule)
              : 'No specific product or rule matched strongly, but the local knowledge base summary is available.'
        },
        {
          title: 'Suggested next step',
          content: 'Use the knowledge base and saved spec reviews together when comparing products, spec rules, and alternatives for a project.'
        }
      ],
      sources: [
        this._createSource('knowledge-base', matchingProduct?.catalogNumber || matchingRule?.requirementName || 'Knowledge base summary', 'Matched the local product knowledge base or its summary metadata.')
      ]
    });
  }

  _resolveProject(projects, message, context) {
    if (context?.type === 'project' && context?.entityId) {
      const contextProject = projects.find((entry) => entry.id === context.entityId);
      if (contextProject) return contextProject;
    }

    return this._matchProjectFromMessage(projects, message);
  }

  _matchProjectFromMessage(projects, message) {
    const exactRfa = projects.find((entry) => entry.rfaNumber && message.includes(String(entry.rfaNumber).toLowerCase()));
    if (exactRfa) return exactRfa;

    return projects.find((entry) => this._containsMeaningfulMatch(message, this._projectHaystack(entry))) || null;
  }

  _projectHaystack(project) {
    return [
      project.projectName,
      project.rfaNumber,
      project.agencyName,
      project.projectContainer
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  _agencyHaystack(agency) {
    return [
      agency.agencyName,
      agency.agencyNumber,
      agency.contactName,
      agency.contactEmail
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  _specReviewHaystack(review) {
    return [
      review.reviewId,
      review.sourceFile,
      review.projectSummary,
      review.linkedProjectName
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  _objectHaystack(value) {
    return Object.values(value || {})
      .filter((entry) => typeof entry === 'string' || typeof entry === 'number')
      .join(' ')
      .toLowerCase();
  }

  _formatKnowledgeBaseProduct(product) {
    return [
      product.catalogNumber ? `Catalog number: ${product.catalogNumber}` : null,
      product.productName ? `Product: ${product.productName}` : null,
      product.productFamily ? `Family: ${product.productFamily}` : null,
      product.description ? `Description: ${product.description}` : null,
      product.active ? `Active: ${product.active}` : null
    ].filter(Boolean).join('\n');
  }

  _formatKnowledgeBaseRule(rule) {
    return [
      rule.requirementName ? `Rule: ${rule.requirementName}` : null,
      rule.category ? `Category: ${rule.category}` : null,
      rule.keywords ? `Keywords: ${rule.keywords}` : null,
      rule.primaryDevices ? `Primary devices: ${rule.primaryDevices}` : null,
      rule.whenToUse ? `When to use: ${rule.whenToUse}` : null
    ].filter(Boolean).join('\n');
  }

  _isWorkloadQuestion(message, context) {
    return context?.type === 'workload' || this._containsKeyword(message, ['workload', 'assignment', 'assignments', 'capacity', 'schedule', 'overdue', 'due date']);
  }

  _isBOMQuestion(message, context) {
    return this._containsKeyword(message, ['bom', 'bill of materials', 'catalog', 'device', 'devices', 'startup cost']) ||
      (context?.type === 'project' && this._containsKeyword(message, ['this project', 'project bom']));
  }

  _isSpecReviewQuestion(message, context) {
    return context?.type === 'spec-review' || this._containsKeyword(message, ['spec', 'spec review', 'requirements', 'compliance', 'gap']);
  }

  _isKnowledgeBaseQuestion(message, context) {
    return this._containsKeyword(message, ['knowledge base', 'product rule', 'spec rule', 'alternative', 'catalog number', 'product family']);
  }

  _containsKeyword(message, keywords) {
    return keywords.some((keyword) => message.includes(keyword));
  }

  _createResponse({ idPrefix, entityId, sections, sources = [] }) {
    return {
      id: `${idPrefix}-${entityId || Date.now()}`,
      sections,
      sources
    };
  }

  _createSource(type, title, snippet) {
    return { type, title, snippet };
  }

  async _enhanceResponseIfAvailable(response, originalMessage, context) {
    if (!this.aiService) return response;

    try {
      const runtimeStatus = await this.aiService.getRuntimeStatus();
      if (!runtimeStatus?.ready) {
        return response;
      }

      const systemPrompt = [
        'You are Project Creator AI.',
        'Rewrite grounded assistant answers using only the provided facts and sources.',
        'Do not invent any details that are not present in the provided grounded data.',
        'Preserve the meaning of each section and keep the tone concise and professional.',
        'Return valid JSON with this shape only: {"sections":[{"title":"...","content":"..."}]}.'
      ].join(' ');

      const userPrompt = JSON.stringify({
        userQuestion: originalMessage,
        context,
        groundedSections: response.sections,
        sources: response.sources
      }, null, 2);

      const aiResult = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
        jsonMode: true,
        timeout: 20000,
        maxTokens: 1200
      });

      if (Array.isArray(aiResult?.sections) && aiResult.sections.length > 0) {
        return {
          ...response,
          sections: aiResult.sections
            .filter((section) => section && typeof section.title === 'string' && typeof section.content === 'string')
            .map((section) => ({
              title: section.title,
              content: section.content
            }))
        };
      }
    } catch (error) {
      console.warn('Assistant AI enhancement skipped:', error.message);
    }

    return response;
  }

  _containsMeaningfulMatch(message, haystack) {
    const terms = message
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4);

    return terms.some((term) => haystack.includes(term));
  }
}

module.exports = AppAssistantService;
