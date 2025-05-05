# Okta Delegated Permissions App

This App is delegates permission management for Okta and Fine Grained Authorization (FGA). 

The app utilizes a [proxy provider](https://www.javascripttutorial.net/es6/javascript-proxy/) for state management.

## Configuring the App

### env

Create a .env file in the root directory
```
OKTA_ORG_URL=https://aaa-bbb.oktapreview.com
OKTA_API_TOKEN=<SSWS token needs app read permission>
OPENFGA_API_URL=
OPENFGA_STORE_ID=
OPENFGA_MODEL_ID=
OPENFGA_CLIENT_ID=
OPENFGA_CLIENT_SECRET=
```
See https://docs.fga.dev/integration/setup-sdk-client to setup the FGA SDK. This uses FGA not OpenFGA, so don't get confused by the variables. 

Set up your config.js to point to a custom authorization server (examples shows default) on Okta and client ID for a single page app:

```javascript
/*
 * config.js
 */
const config = {
	auth: {
		...defaultAuthConfig,
		issuer: 'https://aaa-bbb.oktapreview.com/oauth2/default',
		clientId: 'RBz9va21UvCeuSTYT9nMoRTZah1iTnoH',

```

### start

Download packages and start your app:

```
npm install
npm start
```

Open up the browser to to port configured (5173).

### LICENSE

This project is licensed under the MIT license. See the [LICENSE](LICENSE.txt) file for more info.
<br/>
<br/>

---
