// Jest runs code as CommonJS, where `import.meta` is a syntax error. babel-plugin-transform-import-meta
// only rewrites `import.meta.url`, so replace whatever is left (mainly `import.meta.env`) with Node equivalents.
const importMetaForJest = ({ template }) => ({
  name: 'import-meta-for-jest',
  visitor: {
    MetaProperty(path) {
      if (path.node.meta.name !== 'import' || path.node.property.name !== 'meta') return;
      path.replaceWith(template.expression.ast`({
        url: require('url').pathToFileURL(__filename).href,
        env: {
          MODE: process.env.NODE_ENV || 'test',
          DEV: process.env.NODE_ENV === 'development',
          PROD: process.env.NODE_ENV === 'production'
        }
      })`);
    }
  }
});

module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }],
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
  plugins: [
    'babel-plugin-transform-import-meta'
  ],
  env: {
    test: {
      plugins: [importMetaForJest]
    }
  }
};
