// Build configuration
module.exports = {
  electron: {
    version: '28.0.0',
    builder: {
      appId: 'com.acuitybrands.projectcreator',
      productName: 'Project Creator',
      directories: {
        output: 'dist'
      }
    }
  },
  webpack: {
    devtool: 'eval-source-map',
    optimization: {
      minimize: false,
      splitChunks: false
    }
  }
};
