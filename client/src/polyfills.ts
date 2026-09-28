import { Buffer } from 'buffer';

// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
globalThis.Buffer = Buffer;
// @ts-ignore
if (typeof window.global === 'undefined') window.global = window;
