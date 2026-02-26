/**
 * README Auto-Update Script
 *
 * Reads package.json and readme-config.json to regenerate marked sections
 * of README.md with current version numbers, production features, and metadata.
 *
 * Runs automatically via Husky pre-commit hook or manually via:
 *   npm run readme:update
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const README_PATH = path.join(ROOT, 'README.md');
const PKG_PATH = path.join(ROOT, 'package.json');
const CONFIG_PATH = path.join(ROOT, 'readme-config.json');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function countFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath, extensions);
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      count++;
    }
  }
  return count;
}

function resolveVersion(rawVersion) {
  return rawVersion.replace(/[\^~>=<]/g, '');
}

function generateBadges(pkg) {
  const v = pkg.version;
  const electron = resolveVersion(pkg.devDependencies['electron'] || '0.0.0');
  const react = resolveVersion(pkg.dependencies['react'] || '0.0.0');
  const vite = resolveVersion(pkg.devDependencies['vite'] || '0.0.0');
  const tailwind = resolveVersion(pkg.devDependencies['tailwindcss'] || '0.0.0');

  return [
    `[![Version](https://img.shields.io/badge/version-${v}-blue.svg)](package.json)`,
    `[![License](https://img.shields.io/badge/license-${pkg.license || 'ISC'}-green.svg)](LICENSE)`,
    `[![Electron](https://img.shields.io/badge/Electron-${electron}-47848F.svg)](https://www.electronjs.org/)`,
    `[![React](https://img.shields.io/badge/React-${react}-61DAFB.svg)](https://reactjs.org/)`,
    `[![Vite](https://img.shields.io/badge/Vite-${vite}-646CFF.svg)](https://vitejs.dev/)`,
    `[![Tailwind](https://img.shields.io/badge/Tailwind-${tailwind}-38B2AC.svg)](https://tailwindcss.com/)`,
  ].join('\n');
}

function generateFeatures(config) {
  const lines = ['## Features', ''];

  for (const [, section] of Object.entries(config.features)) {
    const productionItems = section.items.filter(i => i.status === 'production');
    if (productionItems.length === 0) continue;

    lines.push(`### ${section.title}`);
    for (const item of productionItems) {
      lines.push(`- **${item.name}**: ${item.description}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function generateVersionScripts(pkg) {
  const v = pkg.version;
  const parts = v.split('.');
  const patch = `${parts[0]}.${parts[1]}.${parseInt(parts[2], 10) + 1}`;
  const minor = `${parts[0]}.${parseInt(parts[1], 10) + 1}.0`;
  const major = `${parseInt(parts[0], 10) + 1}.0.0`;

  return [
    `- \`npm run version:patch\` - Increment patch version (${v} → ${patch})`,
    `- \`npm run version:minor\` - Increment minor version (${v} → ${minor})`,
    `- \`npm run version:major\` - Increment major version (${v} → ${major})`,
    `- \`npm run version:show\` - Display current version`,
  ].join('\n');
}

function generateVersionHistory(config) {
  const lines = ['## Version History', ''];

  for (const entry of config.versionHistory) {
    const label = entry.label ? ` (${entry.label})` : '';
    lines.push(`- **v${entry.version}**${label} - ${entry.description}`);
    for (const change of entry.changes) {
      lines.push(`  - ${change}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function generateFooter(pkg) {
  const now = new Date();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  const author = pkg.author || 'Roger Cerpa';

  return [
    `**Last Updated**: ${dateStr}  `,
    `**Current Version**: ${pkg.version}  `,
    `**Maintained by**: ${author}`,
  ].join('\n');
}

function replaceSection(readme, tag, content) {
  const startMarker = `<!-- AUTO:${tag}:START -->`;
  const endMarker = `<!-- AUTO:${tag}:END -->`;
  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.warn(`Warning: markers for ${tag} not found in README.md — skipping`);
    return readme;
  }

  const before = readme.substring(0, startIdx + startMarker.length);
  const after = readme.substring(endIdx);

  return `${before}\n${content}\n${after}`;
}

function main() {
  const pkg = readJSON(PKG_PATH);
  const config = readJSON(CONFIG_PATH);
  let readme = fs.readFileSync(README_PATH, 'utf-8');

  const componentCount = countFiles(path.join(ROOT, 'src', 'components'), ['.jsx', '.tsx']);
  const serviceCount = countFiles(path.join(ROOT, 'main-process', 'services'), ['.js', '.ts']);

  console.log(`[readme-update] Version: ${pkg.version}`);
  console.log(`[readme-update] Components: ${componentCount}, Services: ${serviceCount}`);

  readme = replaceSection(readme, 'BADGES', generateBadges(pkg));
  readme = replaceSection(readme, 'FEATURES', generateFeatures(config));
  readme = replaceSection(readme, 'VERSION_SCRIPTS', generateVersionScripts(pkg));
  readme = replaceSection(readme, 'VERSION_HISTORY', generateVersionHistory(config));
  readme = replaceSection(readme, 'FOOTER', generateFooter(pkg));

  fs.writeFileSync(README_PATH, readme, 'utf-8');
  console.log('[readme-update] README.md updated successfully');
}

main();
