module.exports = require('./src/payload.config.ts').default
export default buildConfig({
    serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
  });