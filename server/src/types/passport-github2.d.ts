declare module 'passport-github2' {
  import { Strategy as OAuth2Strategy, VerifyCallback } from 'passport-oauth2';

  export interface GithubProfile {
    id: string;
    username?: string;
    displayName?: string;
    emails?: Array<{ value: string; type?: string }>;
    photos?: Array<{ value: string }>;
    provider?: string;
    _json?: any;
  }

  export type GithubVerify = (
    accessToken: string,
    refreshToken: string,
    profile: GithubProfile,
    done: VerifyCallback
  ) => void;

  export interface GithubStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    authorizationURL?: string;
    tokenURL?: string;
    passReqToCallback?: boolean;
  }

  export class Strategy extends OAuth2Strategy {
    constructor(options: GithubStrategyOptions, verify: GithubVerify);
  }
  export default { Strategy };
}
