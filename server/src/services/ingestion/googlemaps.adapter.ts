import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../../utils/logger';
import { DataSourceAdapter, RawBusinessProfile } from './types';

const execFileAsync = promisify(execFile);

const DOCKER_IMAGE = 'gosom/google-maps-scraper';

interface GoogleMapsPlace {
  input_id?: string;
  link?: string;
  title?: string;
  category?: string;
  address?: string;
  complete_address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  website?: string;
  latitude?: number | string;
  longitude?: number | string;
  review_rating?: number | string;
  review_count?: number | string;
  cid?: string;
  place_id?: string;
  emails?: string[];
  description?: string;
  plus_code?: string;
  price_range?: string;
  data_id?: string;
  status?: string;
  timezone?: string;
}

interface GoogleMapsAdapterOptions {
  query: string;
  category?: string;
  geo?: string;
  radius?: number;
  limit?: number;
}

export class GoogleMapsAdapter implements DataSourceAdapter {
  readonly id = 'googlemaps';

  async fetchBusinesses(query: any): Promise<RawBusinessProfile[]> {
    const { query: searchQuery, category, geo, radius, limit = 50 } = query || {};

    if (!searchQuery) {
      logger.warn('[GoogleMaps] No query provided');
      return [];
    }

    let tmpDir: string | null = null;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmaps-'));
      const inputFile = path.join(tmpDir, 'queries.txt');
      const outputFile = path.join(tmpDir, 'results.json');

      // Write queries file
      fs.writeFileSync(inputFile, searchQuery + '\n', 'utf-8');

      // Build docker command
      const args: string[] = [
        'run',
        '--rm',
        '-v', `${inputFile}:/queries.txt:ro`,
        '-v', `${outputFile}:/out/results.json`,
        '-e', `APIFY_API_TOKEN=${process.env.APIFY_API_TOKEN || ''}`,
        DOCKER_IMAGE,
        '-input', '/queries.txt',
        '-json',
        '-results', '/out/results.json',
        '-depth', '1',
        '-c', '4',
        '-exit-on-inactivity', '3m',
      ];

      if (geo) {
        args.push('-geo', geo);
      }
      if (radius) {
        args.push('-radius', String(radius));
      }
      if (limit) {
        args.push('-limit', String(limit));
      }

      logger.info(`[GoogleMaps] Running docker: docker ${args.join(' ')}`);

      const { stdout, stderr } = await execFileAsync('docker', args, {
        timeout: 600_000, // 10 minutes max
        maxBuffer: 50 * 1024 * 1024, // 50MB output buffer
      });

      if (stderr) {
        logger.warn(`[GoogleMaps] Docker stderr: ${stderr.slice(0, 500)}`);
      }

      // Read output file
      let rawContent = '';
      try {
        rawContent = fs.readFileSync(outputFile, 'utf-8');
      } catch {
        logger.warn('[GoogleMaps] No output file produced');
        return [];
      }

      if (!rawContent.trim()) {
        logger.warn('[GoogleMaps] Empty output');
        return [];
      }

      const places = this.parseGoogleMapsOutput(rawContent);
      return places.map((p) => this.mapPlace(p, category));
    } catch (error) {
      logger.error(`[GoogleMaps] fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    } finally {
      if (tmpDir) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // cleanup best effort
        }
      }
    }
  }

  private parseGoogleMapsOutput(raw: string): GoogleMapsPlace[] {
    // Try JSON array first
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as GoogleMapsPlace[];
      }
      if (parsed && typeof parsed === 'object') {
        return [parsed as GoogleMapsPlace];
      }
    } catch {
      // Not a single JSON object/array, try JSONL (one JSON per line)
    }

    // Try JSONL format
    const places: GoogleMapsPlace[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        places.push(JSON.parse(trimmed) as GoogleMapsPlace);
      } catch {
        // Skip unparseable lines
      }
    }
    return places;
  }

  private mapPlace(p: GoogleMapsPlace, categoryOverride?: string): RawBusinessProfile {
    const lat = typeof p.latitude === 'number' ? p.latitude : p.latitude ? Number(p.latitude) : undefined;
    const lng = typeof p.longitude === 'number' ? p.longitude : p.longitude ? Number(p.longitude) : undefined;
    const rating = typeof p.review_rating === 'number' ? p.review_rating : p.review_rating ? Number(p.review_rating) : undefined;
    const reviewCount = typeof p.review_count === 'number' ? p.review_count : p.review_count ? Number(p.review_count) : undefined;

    return {
      name: p.title || p.complete_address || 'Unknown Business',
      address: p.complete_address || p.address || '',
      city: p.city || undefined,
      state: p.state || undefined,
      country: p.country || undefined,
      postalCode: p.postal_code ? String(p.postal_code) : undefined,
      phone: p.phone ? String(p.phone) : undefined,
      website: p.website ? String(p.website) : undefined,
      lat,
      lng,
      googleRating: rating,
      reviewCount,
      verificationStatus: 'pending',
      sourceId: p.cid || p.place_id || p.data_id || p.link ? String(p.cid || p.place_id || p.data_id || p.link) : undefined,
      source: 'googlemaps',
    };
  }
}
