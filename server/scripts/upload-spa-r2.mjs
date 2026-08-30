// Uploads the built SPA (server/src/public/app) to a Cloudflare R2 bucket.
// Runs in Render's network (which has clean egress to R2), NOT the local sandbox.
// Gated: only runs if R2_BUCKET + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY are set.
// No external deps — uses global fetch + manual AWS SigV4 signing.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, createHash } from 'node:crypto';

const BUCKET = process.env.R2_BUCKET;
const KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const ACCT = process.env.R2_ACCOUNT_ID;
const SRC = join(process.cwd(), 'src', 'public', 'app');

if (!BUCKET || !KEY || !SECRET || !ACCT) {
  console.log('[r2-upload] R2 env vars not set — skipping SPA upload to R2.');
  process.exit(0);
}

const EP = `https://${ACCT}.r2.cloudflarestorage.com`;
const REGION = 'auto';

function hmac( key, str, enc = 'utf8' ) { return createHmac( 'sha256', key ).update( str, enc ).digest(); }
function sha256( buf ) { return createHash( 'sha256' ).update( buf ).digest( 'hex' ); }

function signRequest( method, path, bodyBuf, contentType ) {
  const t = new Date();
  const amzDate = t.toISOString().replace( /[:-]|\.\d{3}/g, '' ).replace( 'T', 'T' ).slice( 0, 17 );
  const dateStamp = amzDate.slice( 0, 8 );
  const payloadHash = sha256( bodyBuf );
  const canonicalHeaders = `host:${new URL( EP ).host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `${method}\n/${BUCKET}${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256( canonicalRequest )}`;
  const kDate = hmac( `AWS4${SECRET}`, dateStamp );
  const kRegion = hmac( kDate, REGION );
  const kService = hmac( kRegion, 's3' );
  const kSigning = hmac( kService, 'aws4_request' );
  const sig = createHmac( 'sha256', kSigning ).update( stringToSign ).digest( 'hex' );
  return `AWS4-HMAC-SHA256 Credential=${KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

function* walk( dir ) {
  for ( const e of readdirSync( dir ) ) {
    const p = join( dir, e );
    if ( statSync( p ).isDirectory() ) yield* walk( p );
    else yield p;
  }
}

async function putObject( rel, buf ) {
  const ext = rel.slice( rel.lastIndexOf( '.' ) );
  const contentType = MIME[ ext ] || 'application/octet-stream';
  const method = 'PUT';
  const path = `/${rel}`;
  const bodyBuf = buf;
  const auth = signRequest( method, path, bodyBuf, contentType );
  const amzDate = new Date().toISOString().replace( /[:-]|\.\d{3}/g, '' ).slice( 0, 17 );
  const res = await fetch( `${EP}/${BUCKET}${path}`, {
    method,
    headers: {
      'Authorization': auth,
      'X-Amz-Date': amzDate,
      'X-Amz-Content-Sha256': sha256( bodyBuf ),
      'Content-Type': contentType,
      // SPA assets: immutable hashed files long cache; index.html no-cache so deploys are instant.
      'Cache-Control': rel === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
    body: bodyBuf,
  } );
  if ( !res.ok ) {
    const txt = await res.text().catch( () => '' );
    throw new Error( `PUT ${rel} -> ${res.status} ${txt.slice( 0, 200 )}` );
  }
}

(async () => {
  let count = 0;
  for ( const abs of walk( SRC ) ) {
    const rel = abs.slice( SRC.length + 1 ).split( '\\' ).join( '/' );
    await putObject( rel, readFileSync( abs ) );
    count++;
  }
  console.log( `[r2-upload] ✅ uploaded ${count} SPA files to R2 bucket "${BUCKET}".` );
})().catch( ( e ) => {
  console.warn( '[r2-upload] ⚠️ upload failed:', e.message, '— continuing (Render origin still serves the SPA).' );
  process.exit( 0 );
});
