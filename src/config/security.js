/**
 * Security configuration for the application
 */

export const SECURITY_CONFIG = {
  // Content Security Policy
  CSP: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", "data:", "https:"],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"]
  },

  // File upload restrictions
  FILE_UPLOAD: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['.docx', '.doc', '.pdf', '.xlsx', '.xls', '.txt', '.csv'],
    blockedExtensions: ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar'],
    maxFiles: 10
  },

  // Input validation limits
  INPUT_LIMITS: {
    projectName: { min: 1, max: 255 },
    rfaNumber: { min: 1, max: 100 },
    description: { min: 0, max: 1000 },
    email: { min: 5, max: 254 },
    username: { min: 3, max: 50 }
  },

  // Rate limiting
  RATE_LIMITING: {
    maxRequests: 100,
    timeWindow: 60000, // 1 minute
    maxLoginAttempts: 5,
    lockoutDuration: 300000 // 5 minutes
  },

  // Session security
  SESSION: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    httpOnly: true,
    sameSite: 'strict'
  },

  // Network security
  NETWORK: {
    allowedOrigins: ['https://acuitybrands.com', 'https://*.acuitybrands.com'],
    blockPrivateIPs: true,
    requireHTTPS: true
  },

  // Logging and monitoring
  LOGGING: {
    logSecurityEvents: true,
    logFailedLogins: true,
    logFileAccess: true,
    logAdminActions: true
  }
};

// Security headers
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Allowed file types for different operations
export const ALLOWED_FILE_TYPES = {
  documents: ['.docx', '.doc', '.pdf'],
  spreadsheets: ['.xlsx', '.xls', '.csv'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.svg'],
  templates: ['.docx', '.xlsx', '.json']
};

// Blocked file patterns
export const BLOCKED_PATTERNS = [
  /\.exe$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.com$/i,
  /\.pif$/i,
  /\.scr$/i,
  /\.vbs$/i,
  /\.js$/i,
  /\.jar$/i,
  /\.msi$/i,
  /\.dll$/i,
  /\.sys$/i
];

// Security event types
export const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  FILE_ACCESS: 'FILE_ACCESS',
  ADMIN_ACTION: 'ADMIN_ACTION',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  PATH_TRAVERSAL_ATTEMPT: 'PATH_TRAVERSAL_ATTEMPT',
  INVALID_INPUT: 'INVALID_INPUT'
};

export default SECURITY_CONFIG;
