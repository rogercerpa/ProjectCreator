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
    const history = Array.isArray(payload.history) ? payload.history : [];

    if (!message) {
      return { success: false, error: 'Message is required.' };
    }

    // Load a full data snapshot once so both the AI path and deterministic path share it.
    const snapshot = await this._loadUnifiedSnapshot();
    const signals = this._deriveUnifiedSignals(normalizedMessage, context, snapshot);

    // AI-first path: use the configured LLM (cloud or local) if available.
    const aiSections = await this._generateAIAnswer(
      message,
      context,
      snapshot,
      signals,
      history
    );

    if (aiSections) {
      const combinedAnswerText = aiSections
        .map((section) => [section.title, section.content].filter(Boolean).join(' '))
        .join('\n');
      const { referencedProjects, referencedAgencies } = this._extractReferences(combinedAnswerText, snapshot);

      return {
        success: true,
        status: 'ready',
        message: this._createResponse({
          idPrefix: 'ai',
          sections: aiSections,
          sources: signals.sources,
          referencedProjects,
          referencedAgencies,
          meta: {
            generationMode: 'grounded-ai-polished',
            runtimeMode: 'cloud-or-local',
            reason: 'ai-direct-answer',
            domain: signals.topDomain || 'general'
          }
        })
      };
    }

    // Deterministic fallback: keyword-routed handlers when AI is unavailable.
    if (this._shouldPreferUnifiedPlanner(normalizedMessage, context)) {
      const unifiedResult = await this._tryUnifiedAnswer(normalizedMessage, context);
      if (unifiedResult) {
        return { success: true, status: 'ready', message: unifiedResult };
      }
    }

    const handlers = this._buildHandlerList(normalizedMessage, context);
    for (const handler of handlers) {
      const result = await handler(normalizedMessage, context);
      if (result) {
        return {
          success: true,
          status: 'ready',
          message: this._attachResponseMeta(result, {
            generationMode: 'grounded-fallback',
            runtimeMode: 'deterministic',
            reason: 'grounded-deterministic-response',
            domain: result?.sources?.[0]?.type || 'general'
          })
        };
      }
    }

    const unifiedFallbackResult = await this._tryUnifiedAnswer(normalizedMessage, context);
    if (unifiedFallbackResult) {
      return { success: true, status: 'ready', message: unifiedFallbackResult };
    }

    return {
      success: true,
      status: 'ready',
      message: this._createResponse({
        idPrefix: 'fallback',
        sections: [
          {
            title: 'No answer found',
            content: 'I could not find enough data in the app to answer that. Make sure your AI provider is configured in Settings, or try asking about a specific project, agency, assignment, or spec review.'
          },
          {
            title: 'Try one of these',
            content: '"What is the status of RFA-1001?"\n"Which assignments are overdue?"\n"Summarize the BOM for Alpha Medical Tower."\n"What agencies are in the East region?"'
          }
        ],
        meta: {
          generationMode: 'fallback-no-grounded-match',
          runtimeMode: 'deterministic',
          reason: 'no-ai-and-no-deterministic-match',
          domain: 'general'
        }
      })
    };
  }

  _buildHandlerList(message, context) {
    const handlers = [];
    const contextPriorityMap = {
      project: this._tryProjectAnswer.bind(this),
      agency: this._tryAgencyAnswer.bind(this),
      workload: this._tryWorkloadAnswer.bind(this),
      'spec-review': this._trySpecReviewAnswer.bind(this)
    };
    const contextPriority = contextPriorityMap[context?.type];

    if (this._isBOMQuestion(message, context)) handlers.push(this._tryBOMAnswer.bind(this));
    if (this._isSpecReviewQuestion(message, context)) handlers.push(this._trySpecReviewAnswer.bind(this));
    if (this._isWorkloadQuestion(message, context)) handlers.push(this._tryWorkloadAnswer.bind(this));
    if (this._isKnowledgeBaseQuestion(message, context)) handlers.push(this._tryKnowledgeBaseAnswer.bind(this));
    if (contextPriority) handlers.push(contextPriority);

    handlers.push(
      this._tryProjectAnswer.bind(this),
      this._tryAgencyAnswer.bind(this),
      this._tryWorkloadAnswer.bind(this),
      this._tryBOMAnswer.bind(this),
      this._trySpecReviewAnswer.bind(this),
      this._tryKnowledgeBaseAnswer.bind(this)
    );

    return handlers.filter((handler, index, array) => array.findIndex((candidate) => candidate.name === handler.name) === index);
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
        this._createSource(
          'project',
          project.projectName || project.rfaNumber || 'Project record',
          `Matched saved project record${project.status ? ` with status ${project.status}` : ''}.`,
          { type: 'open-project', entityId: project.id, view: 'project-management' }
        )
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
      const bestAgencyMatch = agencies
        .map((entry) => ({
          entry,
          score: this._scoreHaystackMatch(message, this._agencyHaystack(entry))
        }))
        .sort((a, b) => b.score - a.score)[0];

      if (bestAgencyMatch?.score >= 1) {
        agency = bestAgencyMatch.entry;
      }
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
        this._createSource(
          'agency',
          agency.agencyName || agency.agencyNumber || 'Agency record',
          `Matched saved agency record${agency.region ? ` in region ${agency.region}` : ''}.`,
          { type: 'open-agency', entityId: agency.id, view: 'agency-dashboard' }
        ),
        ...(relatedProjects.length > 0
          ? [this._createSource(
              'project',
              `${relatedProjects.length} related project(s)`,
              'Matched project records by agency name or agent number.',
              { type: 'open-agency', entityId: agency.id, view: 'agency-dashboard' }
            )]
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
        this._createSource('workload', 'Assignment data', `${assignments.length} assignment record(s) were scanned.`, { type: 'open-view', view: 'workload' }),
        this._createSource('workload', 'Workload statistics', 'Summary counts came from local workload users and assignments.', { type: 'open-view', view: 'workload' })
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
            this._createSource(
              'bom',
              `${project.projectName || project.rfaNumber || 'Project'} BOM`,
              'Matched BOM data saved on the project record.',
              { type: 'open-project', entityId: project.id, view: 'project-management' }
            )
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
        this._createSource('bom', 'BOM catalog', 'Used aggregated BOM catalog and startup statistics stored locally.', { type: 'open-view', view: 'list' })
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
        this._createSource(
          'spec-review',
          review.projectSummary || review.sourceFile || review.reviewId,
          'Matched saved spec review metadata from the local review index.',
          { type: 'open-view', view: 'spec-review' }
        )
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
        this._createSource(
          'knowledge-base',
          matchingProduct?.catalogNumber || matchingRule?.requirementName || 'Knowledge base summary',
          'Matched the local product knowledge base or its summary metadata.',
          { type: 'open-view', view: 'spec-review' }
        )
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
    const rfaCandidates = this._extractRFACandidates(message);
    const exactRfa = projects.find((entry) =>
      entry.rfaNumber &&
      rfaCandidates.includes(this._normalizeText(String(entry.rfaNumber)))
    );
    if (exactRfa) return exactRfa;

    const bestProjectMatch = projects
      .map((entry) => ({
        entry,
        score: this._scoreHaystackMatch(message, this._projectHaystack(entry))
      }))
      .sort((a, b) => b.score - a.score)[0];

    return bestProjectMatch?.score >= 1 ? bestProjectMatch.entry : null;
  }

  _projectHaystack(project) {
    const productsText = Array.isArray(project.products)
      ? project.products.join(' ')
      : (project.products || '');

    return [
      project.projectName,
      project.rfaNumber,
      project.agencyName,
      project.projectContainer,
      project.rfaType,
      project.regionalTeam,
      project.nationalAccount,
      productsText
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

  /**
   * Detects list / filter / aggregate queries — questions that ask for multiple
   * records matching some criteria rather than looking up a single specific entity.
   * Examples: "list projects completed this year", "which agencies are in the east",
   * "how many projects have nLight", "show me all cancelled projects".
   */
  _isListQuery(message, context) {
    const listKeywords = [
      'list', 'all ', 'every', 'each ',
      'which project', 'which agencies', 'which agency', 'which rfa',
      'what projects', 'what agencies', 'what rfas',
      'show me', 'show all', 'give me a list',
      'how many', 'count of', 'number of',
      'projects that', 'projects with', 'projects completed', 'projects in', 'projects for',
      'agencies that', 'agencies with', 'agencies in',
      'completed this', 'completed last', 'this year', 'last year', 'this month', 'last month',
      'overdue', 'in progress', 'on hold', 'cancelled', 'canceled'
    ];
    if (this._containsKeyword(message, listKeywords)) return true;

    // Very short specific-entity questions ("status of RFA-1001", "contact at Smith Agency")
    // are not list queries. But generic questions about a domain (no entity match) tend to be.
    return false;
  }

  /**
   * Returns true if the user is clearly asking about a specific, identifiable entity
   * (RFA number explicitly mentioned, or a very strong haystack match).
   * Pure keyword overlap (e.g. "nlight" matching 2 projects with nlight in name) does
   * NOT count as a specific entity match — that's just coincidental partial matching.
   */
  _hasSpecificEntityMatch(message, matchedProjects) {
    if (this._extractRFACandidates(message).length > 0) return true;
    if (!Array.isArray(matchedProjects) || matchedProjects.length === 0) return false;
    // Require a strong match (score >= 3) to consider this a specific lookup.
    return matchedProjects.some((candidate) => (candidate?.score || 0) >= 3);
  }

  _projectForContext(p, mode = 'list') {
    const base = {
      projectName: p.projectName,
      rfaNumber: p.rfaNumber,
      status: p.status,
      rfaStatus: p.rfaStatus,
      agencyName: p.agencyName,
      agentNumber: p.agentNumber,
      regionalTeam: p.regionalTeam,
      rfaType: p.rfaType,
      products: p.products,
      ecd: p.ecd,
      dueDate: p.dueDate,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      completedAt: (String(p.status || '').toLowerCase() === 'completed' || String(p.rfaStatus || '').toLowerCase() === 'completed')
        ? (p.updatedAt || p.lastModified || null)
        : null
    };

    if (mode === 'full') {
      return {
        ...base,
        projectContainer: p.projectContainer,
        nationalAccount: p.nationalAccount,
        complexity: p.complexity,
        rfaValue: p.rfaValue,
        assignedTo: p.assignedTo,
        requestedDate: p.requestedDate,
        submittedDate: p.submittedDate,
        specReview: p.specReview
      };
    }

    return base;
  }

  _agencyForContext(a) {
    return {
      agencyName: a.agencyName,
      agencyNumber: a.agencyNumber,
      contactName: a.contactName,
      contactEmail: a.contactEmail,
      phoneNumber: a.phoneNumber,
      region: a.region,
      role: a.role
    };
  }

  _containsKeyword(message, keywords) {
    return keywords.some((keyword) => message.includes(keyword));
  }

  _shouldPreferUnifiedPlanner(message, context) {
    if (this._extractRFACandidates(message).length > 0) return false;

    const broadIntent = this._containsKeyword(message, [
      'overall', 'across', 'everything', 'portfolio', 'global view', 'big picture', 'system health'
    ]);
    const mentionedDomains = this._countMentionedDomains(message);
    const scopedContext = ['project', 'agency', 'workload', 'spec-review'].includes(context?.type);

    if (scopedContext && !broadIntent) return false;

    if (broadIntent && mentionedDomains >= 1) return true;
    if (mentionedDomains >= 2) return true;
    if (message.split(/\s+/).length >= 14 && mentionedDomains >= 2) return true;
    if (context?.type === 'default' && broadIntent) return true;
    return false;
  }

  async _tryUnifiedAnswer(message, context) {
    const snapshot = await this._loadUnifiedSnapshot();
    const signals = this._deriveUnifiedSignals(message, context, snapshot);

    if (!signals.hasAnyData) return null;
    if (!signals.hasAnyMatch && context?.type !== 'default') return null;

    const sections = this._buildUnifiedSections(signals, context);
    if (!sections.length) return null;

    return this._createResponse({
      idPrefix: 'unified',
      sections,
      sources: signals.sources,
      meta: {
        generationMode: 'grounded-fallback',
        runtimeMode: 'deterministic',
        reason: 'unified-query-planner',
        domain: signals.topDomain || 'general'
      }
    });
  }

  async _loadUnifiedSnapshot() {
    const safe = async (promiseFactory, fallbackValue) => {
      try {
        return await promiseFactory();
      } catch (error) {
        return fallbackValue;
      }
    };

    const [projects, agencies, usersResult, assignmentsResult, workloadStats, bomCatalogStats, startupStats, specReviewList, kbProducts, kbRules, kbSummary] = await Promise.all([
      safe(() => this.projectPersistenceService?.loadProjects?.(), []),
      safe(() => this.agencyService?.loadAgencies?.(), []),
      safe(() => this.workloadPersistenceService?.loadUsers?.(), { users: [] }),
      safe(() => this.workloadPersistenceService?.loadAssignments?.(), { assignments: [] }),
      safe(() => this.workloadPersistenceService?.getStats?.(), { stats: {} }),
      safe(() => this.bomPersistenceService?.getCatalogStats?.(), {}),
      safe(() => this.bomPersistenceService?.loadStartupStats?.(), {}),
      safe(() => this.specReviewPersistenceService?.listReviews?.(), { reviews: [] }),
      safe(() => this.productKBService?.getProducts?.(), { products: [] }),
      safe(() => this.productKBService?.getSpecRules?.(), { specRules: [] }),
      safe(() => this.productKBService?.getSummary?.(), { summary: null })
    ]);

    return {
      projects: Array.isArray(projects) ? projects : [],
      agencies: Array.isArray(agencies) ? agencies : [],
      workload: {
        users: usersResult?.users || [],
        assignments: assignmentsResult?.assignments || [],
        stats: workloadStats?.stats || {}
      },
      bom: {
        catalogStats: bomCatalogStats || {},
        startupStats: startupStats || {}
      },
      specReviews: specReviewList?.reviews || [],
      knowledgeBase: {
        products: kbProducts?.products || [],
        rules: kbRules?.specRules || [],
        summary: kbSummary?.summary || null
      }
    };
  }

  _deriveUnifiedSignals(message, context, snapshot) {
    const projects = snapshot.projects || [];
    const agencies = snapshot.agencies || [];
    const specReviews = snapshot.specReviews || [];
    const kbProducts = snapshot.knowledgeBase?.products || [];
    const kbRules = snapshot.knowledgeBase?.rules || [];

    const matchedProjects = projects
      .map((entry) => ({ entry, score: this._scoreHaystackMatch(message, this._projectHaystack(entry)) }))
      .filter((candidate) => candidate.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const matchedAgencies = agencies
      .map((entry) => ({ entry, score: this._scoreHaystackMatch(message, this._agencyHaystack(entry)) }))
      .filter((candidate) => candidate.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const matchedReviews = specReviews
      .map((entry) => ({ entry, score: this._scoreHaystackMatch(message, this._specReviewHaystack(entry)) }))
      .filter((candidate) => candidate.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const matchedProducts = kbProducts
      .map((entry) => ({ entry, score: this._scoreHaystackMatch(message, this._objectHaystack(entry)) }))
      .filter((candidate) => candidate.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const matchedRules = kbRules
      .map((entry) => ({ entry, score: this._scoreHaystackMatch(message, this._objectHaystack(entry)) }))
      .filter((candidate) => candidate.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const workloadAssignments = snapshot.workload?.assignments || [];
    const activeAssignments = workloadAssignments.filter((assignment) => String(assignment.status || '').toUpperCase() !== 'COMPLETE');
    const overdueAssignments = workloadAssignments.filter((assignment) =>
      typeof assignment.isOverdue === 'function'
        ? assignment.isOverdue()
        : (assignment.dueDate && new Date(assignment.dueDate) < new Date() && String(assignment.status || '').toUpperCase() !== 'COMPLETE')
    );

    const domainScores = {
      projects: matchedProjects.reduce((sum, candidate) => sum + candidate.score, 0) + (context?.type === 'project' ? 2 : 0),
      agencies: matchedAgencies.reduce((sum, candidate) => sum + candidate.score, 0) + (context?.type === 'agency' ? 2 : 0),
      workload: (this._isWorkloadQuestion(message, context) ? 2 : 0) + (activeAssignments.length ? 1 : 0),
      bom: (this._isBOMQuestion(message, context) ? 2 : 0) + ((snapshot.bom?.catalogStats?.projectsCovered || 0) > 0 ? 1 : 0),
      specReviews: (this._isSpecReviewQuestion(message, context) ? 2 : 0) + matchedReviews.reduce((sum, candidate) => sum + candidate.score, 0),
      knowledgeBase: (this._isKnowledgeBaseQuestion(message, context) ? 2 : 0) + matchedProducts.reduce((sum, candidate) => sum + candidate.score, 0) + matchedRules.reduce((sum, candidate) => sum + candidate.score, 0)
    };

    const topDomainEntry = Object.entries(domainScores).sort((a, b) => b[1] - a[1])[0];
    const topDomain = topDomainEntry && topDomainEntry[1] > 0 ? topDomainEntry[0] : 'general';

    // Sources represent what the AI actually used to answer. For list/filter queries,
    // the AI filters through the full project/agency set, so we cite the list view
    // instead of a few coincidentally keyword-matched records.
    const isListQuery = this._isListQuery(message, context);
    const hasSpecificEntity = this._hasSpecificEntityMatch(message, matchedProjects);
    const sources = [];

    if (isListQuery && !hasSpecificEntity) {
      sources.push(this._createSource(
        'project',
        `All projects (${projects.length})`,
        'Filtered the full project list from local app data to answer this question.',
        { type: 'open-view', view: 'list' }
      ));
      if (matchedAgencies.length === 0 && this._containsKeyword(message, ['agency', 'agencies', 'region'])) {
        sources.push(this._createSource(
          'agency',
          `All agencies (${agencies.length})`,
          'Filtered the full agency list from local app data.',
          { type: 'open-view', view: 'agency-dashboard' }
        ));
      }
    } else {
      matchedProjects.forEach(({ entry }) => {
        sources.push(this._createSource(
          'project',
          entry.projectName || entry.rfaNumber || 'Project record',
          'Matched project record from local app data.',
          { type: 'open-project', entityId: entry.id, view: 'project-management' }
        ));
      });
      matchedAgencies.forEach(({ entry }) => {
        sources.push(this._createSource(
          'agency',
          entry.agencyName || entry.agencyNumber || 'Agency record',
          'Matched agency record from local app data.',
          { type: 'open-agency', entityId: entry.id, view: 'agency-dashboard' }
        ));
      });
      matchedReviews.forEach(({ entry }) => {
        sources.push(this._createSource(
          'spec-review',
          entry.projectSummary || entry.reviewId || 'Spec review',
          'Matched spec review metadata from local index.',
          { type: 'open-view', view: 'spec-review' }
        ));
      });
    }

    if (sources.length === 0) {
      sources.push(this._createSource(
        'project',
        `Projects (${projects.length})`,
        'Used local project records as context.',
        { type: 'open-view', view: 'list' }
      ));
    }

    return {
      snapshot,
      matchedProjects,
      matchedAgencies,
      matchedReviews,
      matchedProducts,
      matchedRules,
      activeAssignments,
      overdueAssignments,
      domainScores,
      topDomain,
      sources: sources.slice(0, 6),
      hasAnyData: projects.length > 0 || agencies.length > 0 || workloadAssignments.length > 0 || specReviews.length > 0 || kbProducts.length > 0 || kbRules.length > 0,
      hasAnyMatch: matchedProjects.length > 0 || matchedAgencies.length > 0 || matchedReviews.length > 0 || matchedProducts.length > 0 || matchedRules.length > 0 || this._containsKeyword(message, ['workload', 'schedule', 'overdue', 'bom', 'spec', 'knowledge'])
    };
  }

  _buildUnifiedSections(signals, context) {
    const sections = [];
    const snapshot = signals.snapshot;
    const projectStatusCounts = (snapshot.projects || []).reduce((acc, project) => {
      const status = String(project.status || 'Unknown');
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const topProjectNames = signals.matchedProjects.map(({ entry }) => entry.projectName || entry.rfaNumber).filter(Boolean);
    const topAgencyNames = signals.matchedAgencies.map(({ entry }) => entry.agencyName || entry.agencyNumber).filter(Boolean);
    const topReviewNames = signals.matchedReviews.map(({ entry }) => entry.projectSummary || entry.reviewId).filter(Boolean);

    sections.push({
      title: 'Cross-domain overview',
      content: [
        topProjectNames.length > 0 ? `Matched projects: ${topProjectNames.join(', ')}` : `Projects tracked: ${snapshot.projects.length}`,
        topAgencyNames.length > 0 ? `Matched agencies: ${topAgencyNames.join(', ')}` : `Agencies tracked: ${snapshot.agencies.length}`,
        `Active assignments: ${snapshot.workload?.stats?.activeAssignments ?? signals.activeAssignments.length}`,
        `Overdue assignments: ${signals.overdueAssignments.length}`
      ].join('\n')
    });

    sections.push({
      title: 'Grounded findings',
      content: [
        Object.keys(projectStatusCounts).length > 0
          ? `Project statuses: ${Object.entries(projectStatusCounts).slice(0, 4).map(([status, count]) => `${status} (${count})`).join(', ')}`
          : 'No project status data was found in local app data.',
        snapshot.bom?.catalogStats?.projectsCovered
          ? `BOM coverage: ${snapshot.bom.catalogStats.projectsCovered} project(s), ${snapshot.bom.catalogStats.uniqueSKUs || 0} unique SKU(s), quantity ${snapshot.bom.catalogStats.totalQuantity || 0}.`
          : 'No BOM catalog statistics are currently available.',
        topReviewNames.length > 0
          ? `Spec reviews: ${topReviewNames.join(', ')}`
          : `Spec reviews indexed: ${(snapshot.specReviews || []).length}`,
        snapshot.knowledgeBase?.summary
          ? `Knowledge base: ${snapshot.knowledgeBase.summary.totalProducts} products, ${snapshot.knowledgeBase.summary.totalSpecRules} rules, ${snapshot.knowledgeBase.summary.totalAlternatives} alternatives.`
          : 'Knowledge base summary is not currently available.'
      ].join('\n')
    });

    sections.push({
      title: 'Recommended next step',
      content: context?.type === 'agency'
        ? 'Open the agency dashboard source action to review linked projects and recent activity in one place.'
        : context?.type === 'project'
          ? 'Open the project source action to inspect full project details, BOM data, and any linked spec reviews.'
          : 'Use the source action buttons to jump directly into projects, agencies, workload, or spec review screens for deeper follow-up.'
    });

    return sections;
  }

  _createResponse({ idPrefix, entityId, sections, sources = [], meta = {}, referencedProjects = [], referencedAgencies = [] }) {
    return {
      id: `${idPrefix}-${entityId || Date.now()}`,
      sections,
      sources,
      referencedProjects,
      referencedAgencies,
      meta
    };
  }

  _createSource(type, title, snippet, action = null) {
    return { type, title, snippet, action };
  }

  /**
   * Scans generated answer text and resolves any references back to real project
   * and agency records, so the UI can render them as clickable open-record buttons.
   * Match strategies:
   *   - RFA numbers (exact match on normalized rfaNumber, tolerant of "RFA-", "RFA ", raw digits with optional dash suffix)
   *   - Project names (case-insensitive substring containment, min length 6 to avoid false positives)
   *   - Agency names (case-insensitive substring containment, min length 5)
   */
  _extractReferences(answerText, snapshot) {
    const text = String(answerText || '');
    if (!text.trim()) return { referencedProjects: [], referencedAgencies: [] };

    const projects = Array.isArray(snapshot?.projects) ? snapshot.projects : [];
    const agencies = Array.isArray(snapshot?.agencies) ? snapshot.agencies : [];

    const normalizedText = this._normalizeText(text);
    const rfaMatches = text.match(/(?:RFA[\s-]*)?\d{4,}(?:-\d+)?/gi) || [];
    const normalizedRfaTokens = new Set(
      rfaMatches
        .map((token) => this._normalizeText(token.replace(/^rfa[\s-]*/i, '')))
        .filter((token) => token && /\d{4,}/.test(token))
    );

    const foundProjectIds = new Set();
    const referencedProjects = [];

    projects.forEach((project) => {
      if (!project || !project.id || foundProjectIds.has(project.id)) return;

      const projectRfa = this._normalizeText(String(project.rfaNumber || ''));
      const projectName = String(project.projectName || '').trim();

      const matchedByRfa = projectRfa && normalizedRfaTokens.has(projectRfa);
      const matchedByName = projectName.length >= 6 &&
        normalizedText.includes(this._normalizeText(projectName));

      if (matchedByRfa || matchedByName) {
        foundProjectIds.add(project.id);
        referencedProjects.push({
          id: project.id,
          projectName: project.projectName || project.rfaNumber || 'Project',
          rfaNumber: project.rfaNumber || null,
          status: project.status || null
        });
      }
    });

    const foundAgencyIds = new Set();
    const referencedAgencies = [];
    agencies.forEach((agency) => {
      if (!agency || !agency.id || foundAgencyIds.has(agency.id)) return;
      const agencyName = String(agency.agencyName || '').trim();
      if (agencyName.length >= 5 && normalizedText.includes(this._normalizeText(agencyName))) {
        foundAgencyIds.add(agency.id);
        referencedAgencies.push({
          id: agency.id,
          agencyName: agency.agencyName,
          agencyNumber: agency.agencyNumber || null
        });
      }
    });

    return { referencedProjects, referencedAgencies };
  }

  _buildSystemPrompt() {
    return [
      'You are Project Creator AI, an intelligent assistant embedded in a lighting controls project management desktop application used by Acuity Brands sales engineers.',
      '',
      'Your job is to answer the user\'s question directly and helpfully using ONLY the structured app data provided in the user message.',
      'You have deep knowledge of how lighting controls projects work, including RFA tracking, agency relationships, workload scheduling, bill of materials (BOM), and specification compliance.',
      'You are part of a multi-turn conversation — use prior messages for context when answering follow-up questions.',
      '',
      '== APP DATA SCHEMA ==',
      'Projects: { projectName, rfaNumber, status, rfaStatus, agencyName, agentNumber, regionalTeam, rfaType, products, ecd, dueDate, createdAt, updatedAt, completedAt }',
      '  - rfaNumber: unique project identifier (numeric, may include dash suffix e.g. "302802-1")',
      '  - status: "active", "Completed", "Cancelled"',
      '  - rfaStatus: "In Progress", "Completed", "On Hold", "Cancelled"',
      '  - products: array of product category strings (e.g. ["Controls - nLight", "SensorSwitch", "nLight Air", "nLight Wired"])',
      '  - ecd: estimated completion date (ISO date string)',
      '  - completedAt: when project was marked Completed (null if not completed)',
      '  - createdAt / updatedAt: ISO date timestamps for record creation and last update',
      '',
      'Agencies: { agencyName, agencyNumber, contactName, contactEmail, phoneNumber, region, role }',
      '',
      'Workload Assignments: { projectName, rfaNumber, status, priority, dueDate, assignedTo }',
      '  - status values: "IN PROGRESS", "COMPLETE", "NOT STARTED"',
      '  - isOverdue: dueDate is past and status is not COMPLETE',
      '',
      'BOM: { totalDevices, totalLineItems, devices: [{ catalogNumber, description, quantity }], startupCosts: { total } }',
      '',
      'Spec Reviews: { projectSummary, linkedProjectName, complianceScore (0-100), gapCount, requirementCount }',
      '',
      'Knowledge Base: products ({ catalogNumber, productName, productFamily }) and rules ({ requirementName, category, whenToUse })',
      '',
      '== ANSWERING RULES ==',
      '1. Answer directly and specifically — name actual project names, RFA numbers, people, dates from the data.',
      '2. If the data is present, give a real answer. Never say "I don\'t have enough information" when the data is right there.',
      '3. If data is genuinely absent, say so briefly and move on.',
      '4. Never invent names, numbers, or dates not in the provided data.',
      '5. Use plain, professional language. Be concise.',
      '6. For follow-up questions, refer to what was already discussed in the conversation history.',
      '7. When the user asks for a LIST or FILTER ("list all projects X", "which projects have Y", "how many projects are Z"):',
      '   - The data block will contain the FULL set of projects/agencies (not a sample). Filter through all of them.',
      '   - Apply the user\'s filter criteria (status, product, date, region, agency) against every record.',
      '   - To filter by year, check the completedAt, createdAt, or ecd date fields against the requested year.',
      '   - To filter by product, check if any entry in the products array contains the product name (case-insensitive substring match).',
      '   - Return EVERY matching project, not just a few. If there are many, group them or show the count.',
      '8. If a list labeled "ALL PROJECTS (N of M)" appears, that is the complete set available to you — filter through all N entries.',
      '',
      '== OUTPUT FORMAT ==',
      'Choose the format based on question complexity:',
      '',
      'SIMPLE questions (single fact, one project/agency lookup, yes/no, status check):',
      '{"answer":"Your direct one-to-three sentence answer here."}',
      '',
      'COMPLEX questions (summaries, multi-record analysis, comparisons, lists of items):',
      '{"sections":[{"title":"Short title","content":"Content here."},{"title":"...","content":"..."}]}',
      '',
      'Return ONLY valid JSON. No prose, no markdown, no explanation outside the JSON.'
    ].join('\n');
  }

  _buildDataContext(snapshot, signals, message, context) {
    const lines = [];
    const normalizedMessage = this._normalizeText(message || '');

    const { matchedProjects = [], matchedAgencies = [] } = signals || {};
    const hasSpecificEntityMatch = this._hasSpecificEntityMatch(normalizedMessage, matchedProjects);
    const isListQuery = this._isListQuery(normalizedMessage, context);
    const needsWorkload = this._isWorkloadQuestion(normalizedMessage, context) || context?.type === 'workload';
    const needsBOM = this._isBOMQuestion(normalizedMessage, context);
    const needsSpec = this._isSpecReviewQuestion(normalizedMessage, context) || context?.type === 'spec-review';
    const needsKB = this._isKnowledgeBaseQuestion(normalizedMessage, context);

    // === PROJECTS ===
    // Three paths:
    // 1. Specific entity lookup (RFA-xxxx, exact project name) -> send only matched (detailed)
    // 2. List/filter query ("list all X", "which projects have Y") -> send FULL project set
    // 3. Page context with single entity (context.type==='project' with id) -> send just that one
    const allProjects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
    const projectCtx = context?.type === 'project' && context?.entityId
      ? allProjects.find((p) => p.id === context.entityId)
      : null;

    if (projectCtx) {
      lines.push('== CURRENT PROJECT (from page context) ==');
      lines.push(JSON.stringify(this._projectForContext(projectCtx, 'full')));
    } else if (hasSpecificEntityMatch && !isListQuery) {
      lines.push('== MATCHED PROJECTS ==');
      matchedProjects.forEach(({ entry: p }) => {
        lines.push(JSON.stringify(this._projectForContext(p, 'full')));
      });
    } else if (isListQuery || allProjects.length > 0) {
      // For list/filter queries, or any general question, give the LLM the full project set
      // with the fields needed to filter by status, product, date, etc.
      const cap = 250;
      const projectsForList = allProjects.slice(0, cap);
      lines.push(`== ALL PROJECTS (${projectsForList.length} of ${allProjects.length}) ==`);
      projectsForList.forEach((p) => {
        lines.push(JSON.stringify(this._projectForContext(p, 'list')));
      });
      if (allProjects.length > cap) {
        lines.push(`(Note: ${allProjects.length - cap} additional projects exist but were truncated for context size.)`);
      }
    }

    // === AGENCIES ===
    const allAgencies = Array.isArray(snapshot.agencies) ? snapshot.agencies : [];
    const agencyCtx = context?.type === 'agency' && context?.entityId
      ? allAgencies.find((a) => a.id === context.entityId)
      : null;

    if (agencyCtx) {
      lines.push('\n== CURRENT AGENCY (from page context) ==');
      lines.push(JSON.stringify(this._agencyForContext(agencyCtx)));
    } else if (matchedAgencies.length > 0 && !isListQuery) {
      lines.push('\n== MATCHED AGENCIES ==');
      matchedAgencies.forEach(({ entry: a }) => {
        lines.push(JSON.stringify(this._agencyForContext(a)));
      });
    } else if (isListQuery || this._containsKeyword(normalizedMessage, ['agency', 'agencies', 'contact', 'rep', 'region'])) {
      const agencyCap = 200;
      const agenciesForList = allAgencies.slice(0, agencyCap);
      if (agenciesForList.length > 0) {
        lines.push(`\n== ALL AGENCIES (${agenciesForList.length} of ${allAgencies.length}) ==`);
        agenciesForList.forEach((a) => {
          lines.push(JSON.stringify(this._agencyForContext(a)));
        });
      }
    }

    // Workload — only when relevant
    if (needsWorkload) {
      const assignments = snapshot.workload?.assignments || [];
      if (assignments.length > 0) {
        const active = assignments.filter((a) => String(a.status || '').toUpperCase() !== 'COMPLETE');
        const overdue = active.filter((a) =>
          typeof a.isOverdue === 'function' ? a.isOverdue() : (a.dueDate && new Date(a.dueDate) < new Date())
        );
        lines.push('\n== WORKLOAD ==');
        lines.push(`Total: ${assignments.length} assignments | Active: ${active.length} | Overdue: ${overdue.length}`);
        if (overdue.length > 0) {
          lines.push('Overdue:');
          overdue.slice(0, 8).forEach((a) => {
            lines.push(`  - ${a.projectName || a.rfaNumber || 'Task'} | Due: ${a.dueDate} | Priority: ${a.priority || 'normal'} | Assigned: ${a.assignedTo || 'unassigned'}`);
          });
        }
        if (active.length > 0) {
          lines.push('Active (sample):');
          active.slice(0, 8).forEach((a) => {
            lines.push(`  - ${a.projectName || a.rfaNumber || 'Task'} | ${a.status} | Due: ${a.dueDate || 'none'} | Assigned: ${a.assignedTo || 'unassigned'}`);
          });
        }
      }
    }

    // BOM — only when relevant
    if (needsBOM) {
      const bomStats = snapshot.bom?.catalogStats;
      if (bomStats?.projectsCovered > 0) {
        lines.push('\n== BOM CATALOG ==');
        lines.push(`Projects with BOM: ${bomStats.projectsCovered} | Unique SKUs: ${bomStats.uniqueSKUs || 0} | Total devices: ${bomStats.totalQuantity || 0}`);
        const startupStats = snapshot.bom?.startupStats;
        if (startupStats?.totalProjectsWithStartupData) {
          lines.push(`Startup data: ${startupStats.totalProjectsWithStartupData} projects, avg cost: ${Math.round(startupStats.averageStartupCost || 0)}`);
        }
      }
    }

    // Spec reviews — only when relevant
    if (needsSpec) {
      const specReviews = snapshot.specReviews || [];
      if (specReviews.length > 0) {
        lines.push('\n== SPEC REVIEWS ==');
        specReviews.slice(0, 8).forEach((r) => {
          lines.push(`  - ${r.projectSummary || r.reviewId} | Compliance: ${r.complianceScore ?? 'N/A'}% | Gaps: ${r.gapCount ?? 'N/A'} | Project: ${r.linkedProjectName || 'unlinked'}`);
        });
      }
    }

    // Knowledge base — only when relevant
    if (needsKB) {
      const kb = snapshot.knowledgeBase;
      if (kb?.summary) {
        lines.push('\n== KNOWLEDGE BASE ==');
        lines.push(`${kb.summary.totalProducts} products | ${kb.summary.totalSpecRules} spec rules | ${kb.summary.totalAlternatives} alternatives`);
        if (signals?.matchedProducts?.length > 0) {
          lines.push('Matched products:');
          signals.matchedProducts.forEach(({ entry: p }) => {
            lines.push(`  - ${p.catalogNumber} | ${p.productName} | Family: ${p.productFamily} | ${p.description || ''}`);
          });
        }
        if (signals?.matchedRules?.length > 0) {
          lines.push('Matched rules:');
          signals.matchedRules.forEach(({ entry: r }) => {
            lines.push(`  - ${r.requirementName} | Category: ${r.category} | When to use: ${r.whenToUse || ''}`);
          });
        }
      }
    }

    return lines.join('\n');
  }

  async _generateAIAnswer(originalMessage, context, snapshot, signals, history = []) {
    if (!this.aiService) return null;

    try {
      const ready = await this.aiService.isAssistantReady();
      if (!ready) return null;

      const systemPrompt = this._buildSystemPrompt();
      const dataContext = this._buildDataContext(snapshot, signals, originalMessage, context);

      const userPrompt = [
        `QUESTION: ${originalMessage}`,
        '',
        `PAGE CONTEXT: ${context?.label || 'All App Data'}${context?.detail ? ` — ${context.detail}` : ''}`,
        '',
        'APP DATA:',
        dataContext || 'No app data is currently available.',
        '',
        'Answer using ONLY the app data above. Return valid JSON only.'
      ].join('\n');

      const aiResult = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
        jsonMode: true,
        timeout: 30000,
        maxTokens: 1600,
        history
      });

      // Simple answer shape: {"answer":"..."}
      if (typeof aiResult?.answer === 'string' && aiResult.answer.trim()) {
        return [{ title: null, content: aiResult.answer.trim() }];
      }

      // Sectioned answer shape: {"sections":[{"title":"...","content":"..."}]}
      if (Array.isArray(aiResult?.sections) && aiResult.sections.length > 0) {
        const validSections = aiResult.sections
          .filter((s) => s && typeof s.content === 'string' && s.content.trim())
          .map((s) => ({
            title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : null,
            content: s.content.trim()
          }));

        if (validSections.length > 0) {
          return validSections;
        }
      }

      return null;
    } catch (error) {
      console.warn('AppAssistantService AI answer failed:', error.message);
      return null;
    }
  }

  _attachResponseMeta(response, patch = {}) {
    return {
      ...response,
      meta: {
        ...(response?.meta || {}),
        ...patch
      }
    };
  }

  _containsMeaningfulMatch(message, haystack) {
    return this._scoreHaystackMatch(message, haystack) >= 1;
  }

  _scoreHaystackMatch(message, haystack) {
    const messageTerms = this._extractMeaningfulTerms(message);
    const normalizedHaystack = this._normalizeText(haystack);

    if (!messageTerms.length || !normalizedHaystack) return 0;

    return messageTerms.reduce((score, term) => {
      if (!term) return score;
      if (normalizedHaystack.includes(term)) {
        return score + (term.length >= 7 ? 1.5 : 1);
      }
      return score;
    }, 0);
  }

  _extractMeaningfulTerms(value) {
    const stopTerms = new Set([
      'what', 'when', 'where', 'which', 'with', 'about', 'from', 'this', 'that', 'have',
      'show', 'summarize', 'status', 'project', 'agency', 'review', 'details', 'please',
      'could', 'would', 'should', 'there', 'their', 'into', 'over', 'under', 'across'
    ]);

    return this._normalizeText(value)
      .split(' ')
      .map((term) => term.trim())
      .filter((term) => term.length >= 3 && !stopTerms.has(term));
  }

  _countMentionedDomains(message) {
    const domainKeywordSets = [
      ['project', 'projects', 'rfa'],
      ['agency', 'agencies', 'contact'],
      ['workload', 'assignment', 'capacity', 'overdue', 'schedule'],
      ['bom', 'bill of materials', 'catalog', 'device'],
      ['spec', 'spec review', 'compliance', 'requirement', 'gap'],
      ['knowledge base', 'product rule', 'spec rule', 'alternative', 'product family']
    ];

    return domainKeywordSets.reduce((count, keywords) => (
      this._containsKeyword(message, keywords) ? count + 1 : count
    ), 0);
  }

  _extractRFACandidates(message) {
    const normalizedMessage = this._normalizeText(message);
    const candidates = new Set();
    const rfaRegex = /rfa[\s-]*\d+/gi;
    const matches = normalizedMessage.match(rfaRegex) || [];

    matches.forEach((match) => {
      candidates.add(this._normalizeText(match));
      candidates.add(this._normalizeText(match.replace(/\s+/g, '')));
      candidates.add(this._normalizeText(match.replace(/\s*-\s*/g, '')));
    });

    return Array.from(candidates);
  }

  _normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = AppAssistantService;
