import express from 'express';
import { jwt } from 'express-jwt';
import { jwksRsa } from 'jwks-rsa';
import { jwtDecode } from 'jsonwebtoken';
// const jwtDecode = require('jsonwebtoken').decode;

const app = express();

// Middleware to validate JWT
const jwtCheck = jwt({
  // Dynamically provide a signing key based on the kid in the header and the signing keys provided by Okta
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    // jwksUri: 'https://{yourOktaDomain}/oauth2/default/v1/keys', // Replace with your Okta JWKS URI
    jwksUri: 'https://demo-silver-cattle-71709.okta.com/oauth2/default/v1/keys',
  }),

  // Validate the audience and the issuer
  // audience: '{yourAudience}', // Replace with your Okta Audience
  audience: 'api://default',
  // issuer: 'https://{yourOktaDomain}/oauth2/default', // Replace with your Okta Issuer URI
  issuer: 'https://demo-silver-cattle-71709.okta.com/oauth2/default',
  algorithms: ['RS256'],
});

// Middleware to validate the claim
function validateAuthRocksClaim(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).send('Access token missing');
  }

  // Decode token to access claims
  const decodedToken = jwtDecode(token);

  if (decodedToken && decodedToken.yourClaimName === 'AuthRocks') {
    // Replace `yourClaimName` with the name of the claim to check
    next();
  } else {
    res.status(403).send('Claim validation failed');
  }
}
