const defaultAuthConfig = {
  authorizationParams: {
    scope: 'openid profile email',
  },
};

const config = {
  auth: {
    ...defaultAuthConfig,
    issuer: 'https://usps-spa.oktapreview.com/oauth2/default',
    clientId: '0oajg68zd39t61PoW1d7',
    // audience: ['api://default'],
  },
  app: {
    enableSilentAuth: true,
    port: 3000,
  },
  server: {
    permissions: ['AuthRocks'],
  },
};

export default config;
