import { OktaAuth } from "@okta/okta-auth-js";
import { appStateProvider, appState, authStateProvider, authState } from ".";
import { assert, getConfig, showContentFromUrl } from "../utils";

export class AuthClient {
  forceAuth = false;
  enableSilentAuth = false;
  newConfig = undefined;
  oktaAuth = null;

  constructor(config) {
    const { hasChanged, config: _config, previousConfig } = getConfig();

    const {
      audience: _previousAudience,
      authorizationParams: _previousAuthParams,
      ..._prevAuthConfig
    } = previousConfig?.auth || {};
    const {
      audience = _previousAudience,
      authorizationParams,
      ...authConfig
    } = _config?.auth || {};

    config = {
      ..._prevAuthConfig,
      ...authConfig,
      authorizationParams: {
        ..._previousAuthParams,
        ...authorizationParams,
        audience,
      },
    };

    try {
      assert(
        config?.issuer && config.issuer !== "_ISSUER_",
        "A valid issuer must be provided in the `config.js` file!"
      );
      assert(
        config?.clientId && config.clientId !== "_CLIENTID_",
        "A valid clientId must be provided in the `config.js` file!"
      );

      appStateProvider["isConfigured"] = true;
    } catch (error) {
      console.log(error);
      appStateProvider["isConfigured"] = false;
    }

    this.config = config;
    this.newConfig = { ...authConfig, ...config };

    this.enableSilentAuth =
      config?.app?.enableSilentAuth || this.enableSilentAuth;

    console.info("silentAuth Enabled:", this.enableSilentAuth);
    if (hasChanged) {
      console.log("config has changed! You may need to refresh your tokens.");
    }

    this.oktaAuth = new OktaAuth({
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUri: window.location.origin,
      scopes: config.authorizationParams.scope.split(" "),
    });
  }

  async login(targetUrl) {
    try {
      console.log("Logging in", targetUrl);

      const options = {
        scopes: this.config.authorizationParams.scope.split(" "),
      };

      if (targetUrl) {
        options.state = { targetUrl };
      }

      await this.oktaAuth.signInWithRedirect(options);
    } catch (err) {
      console.log("Log in failed", err);
      alert(`Something went wrong with login.\n\n${err}`);
    }
  }

  async signout() {
    try {
      console.log("Logging out");
      await this.oktaAuth.revokeAccessToken();
      await this.oktaAuth.signOut();
    } catch (error) {
      console.log("Log out failed", error);
    }
  }

  async refreshTokens(silent = false) {
    if (!appState.isLoading && !silent) {
      appStateProvider.isLoading = true;
    }

    console.info("refreshing tokens...");
    const { accessToken } = await this.handleAuth(true, silent);

    if (appState.isLoading && !silent) {
      appStateProvider.isLoading = false;
    }

    return accessToken;
  }

  async getAccessToken(options = {}, force = false) {
    console.info("getting accessToken...");

    if (!force && this.oktaAuth.getAccessToken()) {
      return this.oktaAuth.getAccessToken();
    }

    const { tokens } = await this.oktaAuth.token.getWithoutPrompt(options);
    return tokens.accessToken;
  }

  async getProfile() {
    const user = await this.oktaAuth.getUser();
    authStateProvider.user = user;
    return user;
  }

  async doAuth(options, force = false) {
    try {
      console.log("doing authentication...");

      if (await this.oktaAuth.isAuthenticated()) {
        const accessToken = await this.getAccessToken(options, force);

        if (!accessToken) {
          console.log("Unable to obtain access token. Something went wrong.");
          return alert(
            "Something went wrong attempting to fetch an access token. Please try again."
          );
        }

        authStateProvider.accessToken = accessToken;

        const user = await this.getProfile();

        return { accessToken, user };
      }
    } catch (error) {
      console.log(JSON.stringify(error, null, 2));
      if (force) {
        try {
          await this.oktaAuth.token.getWithPopup(options);
          return {
            accessToken: this.oktaAuth.getAccessToken(),
            user: await this.getProfile(),
          };
        } catch (error) {
          if (error.name !== "OAuthError") {
            throw new Error(error);
          } else {
            console.info("User cancelled login.");
          }
        }
      }
    }
  }

  async handleAuth(force = this.forceAuth, silent = false) {
    console.log("force:", force);
    appStateProvider.loadingTitle =
      this.enableSilentAuth && force && !silent
        ? "Refreshing tokens."
        : "Hang tight!";
    appStateProvider.loadingMsg = "Work faster monkeys!";

    if (!appState.isLoading && !silent) {
      appStateProvider.isLoading = true;
    }

    console.log(JSON.stringify(this.newConfig, null, 2));
    const authOptions = {
      scopes: this.config.authorizationParams.scope.split(" "),
    };

    // 1) check if URL contains redirect params & handle if it does
    await this.handleLoginRedirect();

    // 2) Check if user is authenticated
    console.log("checking if authenticated...");
    authStateProvider.isAuthenticated = await this.oktaAuth.isAuthenticated();
    let result = {};

    if (force) {
      result = await this.doAuth(authOptions, force);

      const title = document.querySelector("#content-title");

      if (title) {
        title.innerHTML = "Tokens refreshed!";
      }

      if (!silent) {
        window.location.hash = "#content-lead";
        return result;
      }
    }

    if (!authState.isAuthenticated) {
      console.log("> User not authenticated");

      if (this.enableSilentAuth) {
        result = await this.doAuth(authOptions);
      }
    }

    console.log("auth result:", result);
    if (result?.accessToken) {
      authStateProvider.accessToken = result.accessToken;
    }

    if (result?.user) {
      authStateProvider.user = result.user;
    }

    if (authState.isAuthenticated && !force) {
      if (!authState?.accessToken && !result?.accessToken) {
        console.log("> Setting accessToken...");
        authState.accessToken = await this.getAccessToken();
      }

      if (!authState?.user && !result?.user) {
        console.log("> Setting profile data...");
        authState.user = await this.getProfile();
      }

      console.log("> User is authenticated");
    }
    return result;
  }

  async handleLoginRedirect() {
    if (this.oktaAuth.isLoginRedirect()) {
      console.log("> Parsing redirect");
      try {
        const { tokens } = await this.oktaAuth.token.parseFromUrl();
        this.oktaAuth.tokenManager.setTokens(tokens);

        authStateProvider.isAuthenticated = true;

        console.log("Logged in!");
      } catch (error) {
        console.log("Error parsing redirect:", error);
        alert("Unable to login. Check console for details.");
      }

      window.history.replaceState({}, document.title, "/");
    }
  }

  async requireAuth(fn, targetUrl) {
    const isAuthenticated = await this.oktaAuth.isAuthenticated();

    if (isAuthenticated) {
      return fn();
    }

    return this.login(targetUrl);
  }

  async allowRole(fn, role, targetUrl) {
    const isAuthenticated = await this.oktaAuth?.isAuthenticated();

    if (!isAuthenticated) {
      return this.login(targetUrl);
    }

    const user = await this.oktaAuth?.getUser();

    if (user?.approles?.includes(role)) {
      return fn();
    }

    return this.login(targetUrl);
  }
}
