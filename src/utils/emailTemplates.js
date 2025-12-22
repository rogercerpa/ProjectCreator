const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const STORAGE_KEY_TEMPLATE = 'das-paid-services-email-template';
const STORAGE_KEY_SIGNATURE = 'das-paid-services-email-signature';

const DEFAULT_TEMPLATE = `Hello {{repName}},

Thank you for submittal this request to the Design Solutions team. This request falls under the Paid services package, please proceed on submitting your order and once received we will proceed with your project.

Lighting Pages: {{lightingPages}}
Charge per page: {{costPerPage}}
Total cost for the service: {{totalFee}}

Thank you`;

const formatUSD = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
};

// Get saved template from localStorage
const getSavedTemplate = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_TEMPLATE;
  }
  return DEFAULT_TEMPLATE;
};

// Get saved signature from localStorage
const getSavedSignature = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY_SIGNATURE) || '';
  }
  return '';
};

const sanitizeSubjectPart = (value) => {
  if (!value) return null;
  return String(value).trim();
};

export const extractEmailFromRepContacts = (repContacts, fallbackEmail) => {
  if (repContacts) {
    const match = repContacts.match(EMAIL_REGEX);
    if (match) {
      return match[0];
    }
  }
  if (fallbackEmail && EMAIL_REGEX.test(fallbackEmail)) {
    return fallbackEmail;
  }
  return null;
};

export const extractRepName = (repContacts) => {
  if (!repContacts) {
    return 'there';
  }

  let cleaned = repContacts;
  const emailMatch = repContacts.match(EMAIL_REGEX);
  if (emailMatch) {
    cleaned = cleaned.replace(emailMatch[0], '');
  }

  cleaned = cleaned.replace(/[\(\)<>\[\]]/g, '').trim();
  if (!cleaned) return 'there';

  // Handle "Last, First" format
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts[1]) {
      cleaned = parts[1].trim();
    }
  }

  // Take first word for greeting
  const firstName = cleaned.split(/\s+/)[0];
  return firstName || 'there';
};

const normalizeRecipients = (project) => {
  const explicitList = Array.isArray(project?.dasRepEmailList)
    ? project.dasRepEmailList
        .map((entry) => entry?.email)
        .filter(Boolean)
    : [];

  if (explicitList.length > 0) {
    return explicitList;
  }

  if (typeof project?.dasRepEmail === 'string') {
    return project.dasRepEmail
      .split(/[;,]+/)
      .map((email) => email.trim())
      .filter(Boolean);
  }

  return [];
};

export const buildPaidServicesEmail = (project = {}, options = {}) => {
  const missingFields = [];
  const lightingPages = Number(project.dasLightingPages || 0);
  const costPerPage = Number(project.dasCostPerPage || 0);
  const totalFee = Number(project.dasFee || 0);

  if (!lightingPages) missingFields.push('lighting pages');
  if (!costPerPage) missingFields.push('cost per page');
  if (!totalFee) missingFields.push('fee');

  const recipients = normalizeRecipients(project);
  let toEmail = recipients.join('; ');

  if (!toEmail) {
    toEmail = project.dasRepEmail || extractEmailFromRepContacts(project.repContacts, options.fallbackEmail);
  }

  if (!toEmail) missingFields.push('rep email');

  const subjectParts = [
    sanitizeSubjectPart(project.rfaNumber) ? `RFA# ${project.rfaNumber}` : null,
    sanitizeSubjectPart(project.projectName),
    sanitizeSubjectPart(project.projectContainer)
  ].filter(Boolean);

  if (subjectParts.length === 0) {
    missingFields.push('project identifiers');
  }

  if (missingFields.length > 0) {
    return { missingFields };
  }

  const subject = subjectParts.join(' - ');
  const repName = extractRepName(project.repContacts);
  
  // Get saved template and signature
  const savedTemplate = getSavedTemplate();
  const savedSignature = getSavedSignature();
  const signature = options.signature || savedSignature;

  // Replace placeholders in template
  let body = savedTemplate
    .replace(/\{\{repName\}\}/g, repName)
    .replace(/\{\{lightingPages\}\}/g, lightingPages.toString())
    .replace(/\{\{costPerPage\}\}/g, formatUSD(costPerPage))
    .replace(/\{\{totalFee\}\}/g, formatUSD(totalFee));

  // Append signature if available
  if (signature && signature.trim()) {
    body += `\n\n${signature.trim()}`;
  }
  const mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    to: toEmail,
    subject,
    body,
    mailto,
    missingFields: []
  };
};

export const openPaidServicesEmail = (project, options = {}) => {
  const result = buildPaidServicesEmail(project, options);
  if (result.missingFields && result.missingFields.length > 0) {
    return { success: false, ...result };
  }

  if (typeof window !== 'undefined' && result.mailto) {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(result.mailto);
    } else {
      window.location.href = result.mailto;
    }
  }

  return { success: true, ...result };
};

