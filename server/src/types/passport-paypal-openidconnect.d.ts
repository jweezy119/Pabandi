declare module 'passport-paypal-openidconnect' {
  import { Strategy as OAuth2Strategy, VerifyCallback } from 'passport-oauth2';

  export interface PayPalProfile {
    id: string;
    displayName?: string;
    name?: { givenName?: string; familyName?: string };
    emails?: Array<{ value: string }>;
    _json?: any;
  }

  export type PayPalVerify = (
    accessToken: string,
    refreshToken: string,
    profile: PayPalProfile,
    done: VerifyCallback
  ) => void;

  export interface PayPalStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string | string[];
    state?: boolean;
  }

  export class Strategy extends OAuth2Strategy {
    constructor(options: PayPalStrategyOptions, verify: PayPalVerify);
  }
  export default { Strategy };
}
