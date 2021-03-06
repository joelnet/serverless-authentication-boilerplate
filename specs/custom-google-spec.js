'use strict';

const lib = require('../authentication/lib');
const slsAuth = require('serverless-authentication');
const utils = slsAuth.utils;
const config = slsAuth.config;
const nock = require('nock');
const expect = require('chai').expect;
const url = require('url');

describe('Authentication Provider', () => {
  describe('Custom Google', () => {
    before(() => {
      const googleConfig = config({ provider: 'custom-google' });
      nock('https://www.googleapis.com')
        .post('/oauth2/v4/token')
        .query({
          client_id: googleConfig.id,
          redirect_uri: googleConfig.redirect_uri,
          client_secret: googleConfig.secret,
          code: 'code'
        })
        .reply(200, {
          access_token: 'access-token-123'
        });

      nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .query({ access_token: 'access-token-123' })
        .reply(200, {
          id: 'user-id-1',
          displayName: 'Eetu Tuomala',
          emails: [
            {
              value: 'email@test.com'
            }
          ],
          image: {
            url: 'https://avatars3.githubusercontent.com/u/4726921?v=3&s=460'
          }
        });
    });

    it('should return oauth signin url', () => {
      const event = {
        provider: 'custom-google'
      };

      lib.signinHandler(event, (error, data) => {
        expect(error).to.be.null();
        expect(data.url).to.equal('https://accounts.google.com/o/oauth2/v2/auth?client_id=cg-mock-id&redirect_uri=https://api-id.execute-api.eu-west-1.amazonaws.com/dev/callback/custom-google&response_type=code&scope=profile email&state=state-custom-google');
      });
    });

    it('should return local client url', (done) => {
      const event = {
        provider: 'custom-google',
        code: 'code',
        state: 'state-custom-google'
      };

      const providerConfig = config(event);
      lib.callbackHandler(event, (error, data) => {
        const query = url.parse(data.url, true).query;
        expect(query.authorization_token).to.match(/[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?/);
        expect(query.refresh_token).to.match(/[A-Fa-f0-9]{64}/);
        const tokenData = utils.readToken(query.authorization_token, providerConfig.token_secret);
        expect(tokenData.id).to.equal(`${event.provider}-user-id-1`);
        expect(tokenData.id).to.equal(query.id);
        done(error);
      });
    });
  });
});
