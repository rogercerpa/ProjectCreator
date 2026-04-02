export const PROJECT_FILE_TYPE_OTHER = 'Other';

export const PROJECT_FILE_TYPE_OPTIONS = [
  'Electrical Plans',
  'Mechanical Plans',
  'Power Plans',
  'Lighting Plans',
  'Specifications',
  PROJECT_FILE_TYPE_OTHER
];

export const sanitizeProjectFileTypes = (value) => {
  if (!Array.isArray(value)) return [];

  const unique = new Set();
  value.forEach((entry) => {
    const normalized = typeof entry === 'string' ? entry.trim() : '';
    if (normalized) unique.add(normalized);
  });

  return Array.from(unique);
};
