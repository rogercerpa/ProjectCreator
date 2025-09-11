import {
  validatePath,
  validateProjectName,
  validateRFANumber,
  validateEmail,
  validateNumber,
  validateFileExtension,
  sanitizeSearchQuery,
  sanitizeHTML,
  RateLimiter
} from './security';

describe('Security Utilities', () => {
  describe('validatePath', () => {
    test('should validate correct paths', () => {
      expect(validatePath('/valid/path')).toBe('/valid/path');
      expect(validatePath('C:\\valid\\path')).toBe('C:\\valid\\path');
      expect(validatePath('./relative/path')).toBe('./relative/path');
    });

    test('should reject path traversal attempts', () => {
      expect(() => validatePath('../malicious/path')).toThrow('Invalid path detected');
      expect(() => validatePath('..\\malicious\\path')).toThrow('Invalid path detected');
      expect(() => validatePath('/path//with//double//slashes')).toThrow('Invalid path detected');
    });

    test('should sanitize dangerous characters', () => {
      expect(validatePath('/path/with<>:"|?*chars')).toBe('/path/with chars');
      expect(validatePath('/path/with\0null\0bytes')).toBe('/path/withnullbytes');
    });

    test('should throw error for non-string input', () => {
      expect(() => validatePath(null)).toThrow('Path must be a string');
      expect(() => validatePath(123)).toThrow('Path must be a string');
      expect(() => validatePath({})).toThrow('Path must be a string');
    });
  });

  describe('validateProjectName', () => {
    test('should validate correct project names', () => {
      expect(validateProjectName('Valid Project Name')).toBe('Valid Project Name');
      expect(validateProjectName('Project-123')).toBe('Project-123');
      expect(validateProjectName('Project_123')).toBe('Project_123');
    });

    test('should reject empty project names', () => {
      expect(() => validateProjectName('')).toThrow('Project name cannot be empty');
      expect(() => validateProjectName('   ')).toThrow('Project name cannot be empty');
    });

    test('should reject project names that are too long', () => {
      const longName = 'a'.repeat(256);
      expect(() => validateProjectName(longName)).toThrow('Project name too long');
    });

    test('should sanitize dangerous characters', () => {
      expect(validateProjectName('Project<>:"|?*\\/Name')).toBe('Project Name');
      expect(validateProjectName('Project   with   spaces')).toBe('Project with spaces');
    });

    test('should throw error for non-string input', () => {
      expect(() => validateProjectName(null)).toThrow('Project name must be a string');
      expect(() => validateProjectName(123)).toThrow('Project name must be a string');
    });
  });

  describe('validateRFANumber', () => {
    test('should validate correct RFA numbers', () => {
      expect(validateRFANumber('RFA-123')).toBe('RFA-123');
      expect(validateRFANumber('RFA_123')).toBe('RFA_123');
      expect(validateRFANumber('RFA.123')).toBe('RFA.123');
      expect(validateRFANumber('RFA 123')).toBe('RFA 123');
    });

    test('should reject empty RFA numbers', () => {
      expect(() => validateRFANumber('')).toThrow('RFA number cannot be empty');
      expect(() => validateRFANumber('   ')).toThrow('RFA number cannot be empty');
    });

    test('should reject RFA numbers with invalid characters', () => {
      expect(() => validateRFANumber('RFA@123')).toThrow('RFA number contains invalid characters');
      expect(() => validateRFANumber('RFA#123')).toThrow('RFA number contains invalid characters');
      expect(() => validateRFANumber('RFA$123')).toThrow('RFA number contains invalid characters');
    });

    test('should throw error for non-string input', () => {
      expect(() => validateRFANumber(null)).toThrow('RFA number must be a string');
      expect(() => validateRFANumber(123)).toThrow('RFA number must be a string');
    });
  });

  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe('test@example.com');
      expect(validateEmail('user.name@domain.co.uk')).toBe('user.name@domain.co.uk');
      expect(validateEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    test('should reject invalid email addresses', () => {
      expect(() => validateEmail('invalid-email')).toThrow('Invalid email format');
      expect(() => validateEmail('@example.com')).toThrow('Invalid email format');
      expect(() => validateEmail('test@')).toThrow('Invalid email format');
      expect(() => validateEmail('test.example.com')).toThrow('Invalid email format');
    });

    test('should throw error for non-string input', () => {
      expect(() => validateEmail(null)).toThrow('Email must be a string');
      expect(() => validateEmail(123)).toThrow('Email must be a string');
    });
  });

  describe('validateNumber', () => {
    test('should validate numbers within range', () => {
      expect(validateNumber(5, 0, 10)).toBe(5);
      expect(validateNumber(0, 0, 10)).toBe(0);
      expect(validateNumber(10, 0, 10)).toBe(10);
    });

    test('should reject numbers outside range', () => {
      expect(() => validateNumber(-1, 0, 10)).toThrow('Value must be between 0 and 10');
      expect(() => validateNumber(11, 0, 10)).toThrow('Value must be between 0 and 10');
    });

    test('should reject non-numeric input', () => {
      expect(() => validateNumber('not a number')).toThrow('Value must be a number');
      expect(() => validateNumber(NaN)).toThrow('Value must be a number');
    });
  });

  describe('validateFileExtension', () => {
    test('should validate allowed file extensions', () => {
      expect(validateFileExtension('document.docx', ['.docx', '.doc'])).toBe(true);
      expect(validateFileExtension('image.png', ['.png', '.jpg'])).toBe(true);
    });

    test('should reject disallowed file extensions', () => {
      expect(() => validateFileExtension('script.js', ['.docx', '.doc']))
        .toThrow('File type .js not allowed');
    });

    test('should throw error for non-string input', () => {
      expect(() => validateFileExtension(null, ['.docx'])).toThrow('Filename must be a string');
      expect(() => validateFileExtension(123, ['.docx'])).toThrow('Filename must be a string');
    });
  });

  describe('sanitizeSearchQuery', () => {
    test('should sanitize SQL injection attempts', () => {
      expect(sanitizeSearchQuery("'; DROP TABLE users; --")).toBe('');
      expect(sanitizeSearchQuery("1' OR '1'='1")).toBe('');
      expect(sanitizeSearchQuery("admin'--")).toBe('');
    });

    test('should preserve valid search queries', () => {
      expect(sanitizeSearchQuery('valid search term')).toBe('valid search term');
      expect(sanitizeSearchQuery('project name')).toBe('project name');
    });

    test('should handle non-string input', () => {
      expect(sanitizeSearchQuery(null)).toBe('');
      expect(sanitizeSearchQuery(123)).toBe('');
    });
  });

  describe('sanitizeHTML', () => {
    test('should remove script tags', () => {
      const html = '<div>Content</div><script>alert("xss")</script>';
      expect(sanitizeHTML(html)).toBe('<div>Content</div>');
    });

    test('should remove iframe tags', () => {
      const html = '<div>Content</div><iframe src="malicious.com"></iframe>';
      expect(sanitizeHTML(html)).toBe('<div>Content</div>');
    });

    test('should remove event handlers', () => {
      const html = '<div onclick="alert(\'xss\')">Content</div>';
      expect(sanitizeHTML(html)).toBe('<div>Content</div>');
    });

    test('should remove javascript: protocols', () => {
      const html = '<a href="javascript:alert(\'xss\')">Link</a>';
      expect(sanitizeHTML(html)).toBe('<a href="">Link</a>');
    });

    test('should handle non-string input', () => {
      expect(sanitizeHTML(null)).toBe('');
      expect(sanitizeHTML(123)).toBe('');
    });
  });

  describe('RateLimiter', () => {
    test('should allow requests within limit', () => {
      const limiter = new RateLimiter(5, 60000); // 5 requests per minute
      
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
    });

    test('should block requests over limit', () => {
      const limiter = new RateLimiter(3, 60000); // 3 requests per minute
      
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(false);
    });

    test('should reset user limits', () => {
      const limiter = new RateLimiter(2, 60000);
      
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(false);
      
      limiter.reset('user1');
      
      expect(limiter.isAllowed('user1')).toBe(true);
    });

    test('should handle different users independently', () => {
      const limiter = new RateLimiter(2, 60000);
      
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user2')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user2')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(false);
      expect(limiter.isAllowed('user2')).toBe(false);
    });
  });
});


