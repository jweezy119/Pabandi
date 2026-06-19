declare module 'passport-tiktok-auth' {
  import { Strategy as PassportStrategy } from 'passport-strategy';
  import express from 'express';

  export interface StrategyOption {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    passReqToCallback?: boolean;
  }

  export interface StrategyOptionWithRequest extends StrategyOption {
    passReqToCallback: true;
  }

  export interface Profile {
    id: string;
    username?: string;
    displayName?: string;
    profileUrl?: string;
    avatar_url?: string;
    emails?: Array<{ value: string }>;
    _raw: string;
    _json: any;
  }

  export type VerifyCallback = (err?: Error | null, user?: any, info?: any) => void;

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ) => void;

  export type VerifyFunctionWithRequest = (
    req: express.Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptionWithRequest, verify: VerifyFunctionWithRequest);
    constructor(options: StrategyOption, verify: VerifyFunction);
  }
}
