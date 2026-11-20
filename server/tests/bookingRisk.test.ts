import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BOOKING_FEATURE_NAMES,
  DEFAULT_BOOKING_WEIGHTS,
  loadBookingModelWeights,
} from '../src/services/bookingRisk.service';

/**
 * Booking risk owns its features and its weights.
 *
 * The architectural guard at the bottom is the point of this file: booking risk
 * used to reach into `predictiveEngine.service.ts` and score bookings with a
 * work-order model. If that dependency comes back, the test fails.
 */

afterEach(() => {
  delete process.env.BOOKING_RISK_MODEL_PATH;
});

describe('booking feature vocabulary', () => {
  it('has no technician features, because a booking has no assigned technician', () => {
    // These two were the tell: they existed on the borrowed work-order model and
    // had no meaning for a booking, yet they moved the score.
    expect(BOOKING_FEATURE_NAMES).not.toContain('technician_skill_match');
    expect(BOOKING_FEATURE_NAMES).not.toContain('technician_experience_years');
    expect([...BOOKING_FEATURE_NAMES].sort()).toEqual([
      'issue_type_complexity',
      'lead_time_days',
      'schedule_density',
      'service_value',
    ]);
  });
});

describe('booking model weights', () => {
  it('ships documented defaults that are explicitly uncalibrated', () => {
    expect(DEFAULT_BOOKING_WEIGHTS.sampleSize).toBe(0);
    expect(DEFAULT_BOOKING_WEIGHTS.trainedAt).toBe('uncalibrated');
    expect(DEFAULT_BOOKING_WEIGHTS.globalCounts).toEqual({ onTime: 0, wentWrong: 0 });
  });

  it('has a mean and a spread for every feature, so centring always works', () => {
    for (const name of BOOKING_FEATURE_NAMES) {
      expect(Number.isFinite(DEFAULT_BOOKING_WEIGHTS.trainingMeans[name])).toBe(true);
      expect(Number.isFinite(DEFAULT_BOOKING_WEIGHTS.trainingStd[name])).toBe(true);
      expect(Number.isFinite(DEFAULT_BOOKING_WEIGHTS.standardErrors[name])).toBe(true);
    }
  });

  it('falls back to the defaults when no calibration file exists', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'booking-risk-'));
    process.env.BOOKING_RISK_MODEL_PATH = path.join(dir, 'absent.json');
    expect(loadBookingModelWeights()).toEqual(DEFAULT_BOOKING_WEIGHTS);
    rmSync(dir, { recursive: true, force: true });
  });

  it('ignores a file that does not look like a fitted model', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'booking-risk-'));
    const file = path.join(dir, 'booking-risk-model.json');
    writeFileSync(file, JSON.stringify({ sampleSize: 0, trainingMeans: null }));
    process.env.BOOKING_RISK_MODEL_PATH = file;

    expect(loadBookingModelWeights()).toEqual(DEFAULT_BOOKING_WEIGHTS);
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads a calibrated file and reports it as calibrated', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'booking-risk-'));
    const file = path.join(dir, 'booking-risk-model.json');
    writeFileSync(
      file,
      JSON.stringify({ ...DEFAULT_BOOKING_WEIGHTS, sampleSize: 500, trainedAt: '2026-01-01T00:00:00Z' }),
    );
    process.env.BOOKING_RISK_MODEL_PATH = file;

    const weights = loadBookingModelWeights();
    expect(weights.sampleSize).toBe(500);
    expect(weights.trainedAt).toBe('2026-01-01T00:00:00Z');
    rmSync(dir, { recursive: true, force: true });
  });
});

/**
 * Removes comments before asserting on imports, so a doc comment explaining
 * why a dependency was REMOVED does not read as the dependency being present.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('dependency direction', () => {
  it('booking risk does not import the coordinator engine', () => {
    const source = stripComments(
      readFileSync(
        path.join(__dirname, '..', 'src', 'services', 'bookingRisk.service.ts'),
        'utf8',
      ),
    );
    expect(source).not.toContain('predictiveEngine.service');
    expect(source).toContain('riskModel');
  });

  it('the coordinator engine still owns the work-order feature vocabulary', () => {
    const source = readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'predictiveEngine.service.ts'),
      'utf8',
    );
    expect(source).toContain('technician_skill_match');
    expect(existsSync(path.join(__dirname, '..', 'src', 'services', 'predictiveEngine.service.ts'))).toBe(
      true,
    );
  });
});
