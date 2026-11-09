/**
 * Offline calibration for the predictive engine.
 *
 * Reads work-order history, fits the logistic weights, and writes
 * `config/predictive-engine.json`. Nothing in the request path calls this —
 * it is run on a schedule or by hand, which is what makes it free to do the
 * cross-tenant aggregation §1 forbids in a client request.
 *
 *   npm run calibrate:predictive
 *
 * The script is idempotent: every run overwrites the model file with a
 * complete, self-describing snapshot. A failed run leaves the previous model
 * in place because the write is atomic (temp file + rename).
 *
 * WHAT IT NEEDS
 * ------------
 * A reachable database. `npm install` on this machine blocked Prisma's
 * postinstall, so the engines may not be present; check with
 * `npx prisma generate` before the first run.
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  buildCalibrationInput,
  calibrateWeights,
  type HistoricalWorkOrder,
  type TrainingSample,
} from '../src/services/predictiveEngine.service';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

const MODEL_PATH =
  process.env.PREDICTIVE_MODEL_PATH ?? path.join(process.cwd(), 'config', 'predictive-engine.json');

/** Cap on stored training samples; the nearest-neighbour search only needs a representative set. */
const MAX_SAMPLES = Number(process.env.PREDICTIVE_MAX_SAMPLES ?? 5000);

interface HistoricalRow {
  id: string;
  businessId: string;
  vertical: string | null;
  issueType: string;
  priority: string;
  status: string;
  scheduledFor: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  technicianId: string | null;
  technicianExperienceYears: number | null;
  technicianSkills: string[];
  sameDayJobCount: number;
}

async function loadHistory(): Promise<HistoricalRow[]> {
  // The latest assignment per work order, so a job reassigned mid-flight is
  // scored against the technician who actually did it.
  return prisma.$queryRaw<HistoricalRow[]>`
    WITH latest_assignment AS (
      SELECT DISTINCT ON (a."workOrderId")
        a."workOrderId",
        a."technicianId",
        t."experienceYears",
        t."skills"
      FROM "WorkOrderAssignment" a
      JOIN "Technician" t ON t."id" = a."technicianId"
      ORDER BY a."workOrderId", a."assignedAt" DESC
    )
    SELECT
      wo."id"            AS "id",
      wo."businessId"    AS "businessId",
      s."vertical"       AS "vertical",
      wo."issueType"     AS "issueType",
      wo."priority"      AS "priority",
      wo."status"        AS "status",
      wo."scheduledFor"  AS "scheduledFor",
      wo."createdAt"     AS "createdAt",
      wo."completedAt"   AS "completedAt",
      la."technicianId"  AS "technicianId",
      la."experienceYears" AS "technicianExperienceYears",
      la."skills"        AS "technicianSkills",
      COUNT(*) OVER (
        PARTITION BY wo."businessId", date_trunc('day', COALESCE(wo."scheduledFor", wo."createdAt"))
      ) - 1 AS "sameDayJobCount"
    FROM "WorkOrder" wo
    LEFT JOIN "BusinessSettings" s ON s."businessId" = wo."businessId"
    LEFT JOIN latest_assignment la ON la."workOrderId" = wo."id"
    WHERE wo."status" IN ('COMPLETED', 'CANCELLED')
    ORDER BY wo."createdAt" DESC
  `;
}

function sampleForStorage(samples: TrainingSample[]): TrainingSample[] {
  if (samples.length <= MAX_SAMPLES) return samples;
  // Even stride rather than "the most recent 5000", which would silently
  // discard every older job and bias the near-neighbour search toward the
  // present.
  const stride = samples.length / MAX_SAMPLES;
  const picked: TrainingSample[] = [];
  for (let index = 0; index < MAX_SAMPLES; index++) {
    picked.push(samples[Math.floor(index * stride)]);
  }
  return picked;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  logger.info('[Calibration] loading work-order history');

  const rows = await loadHistory();
  if (rows.length === 0) {
    logger.warn('[Calibration] no completed or cancelled work orders found; nothing to fit');
    return;
  }

  const history: HistoricalWorkOrder[] = rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    vertical: row.vertical,
    issueType: row.issueType,
    priority: row.priority,
    status: row.status,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    technicianId: row.technicianId,
    technicianExperienceYears: row.technicianExperienceYears,
    technicianSkills: row.technicianSkills ?? [],
    sameDayJobCount: Number(row.sameDayJobCount ?? 0),
  }));

  const { samples, global, vertical, excluded } = buildCalibrationInput(history);

  if (samples.length < 50) {
    logger.warn(
      `[Calibration] only ${samples.length} labelled work orders; a logistic fit on fewer than 50 is noise. ` +
        'Run this again once more history exists.',
    );
  }

  logger.info(
    `[Calibration] ${samples.length} labelled jobs, ${excluded} still open (excluded), ` +
      `${Object.keys(vertical).length} verticals`,
  );

  const weights = calibrateWeights(samples, {
    counts: { global, vertical },
  });

  const payload = {
    ...weights,
    trainingSamples: sampleForStorage(samples),
    calibratedWith: {
      labelledJobs: samples.length,
      excludedOpen: excluded,
      verticals: Object.keys(vertical).length,
      source: 'scripts/calibrate-predictive-engine.ts',
    },
  };

  mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  const tempPath = `${MODEL_PATH}.tmp`;
  writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  renameSync(tempPath, MODEL_PATH);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.info(`[Calibration] wrote ${MODEL_PATH} in ${elapsed}s`);
  logger.info(
    `[Calibration] weights: density=${weights.schedule_density.toFixed(3)} ` +
      `leadTime=${weights.lead_time_days.toFixed(3)} complexity=${weights.issue_type_complexity.toFixed(3)} ` +
      `skillMatch=${weights.technician_skill_match.toFixed(3)} experience=${weights.technician_experience_years.toFixed(3)}`,
  );
  logger.info(
    `[Calibration] global on-time rate=${(global.onTime / Math.max(1, global.onTime + global.wentWrong)).toFixed(3)} ` +
      `over ${global.onTime + global.wentWrong} jobs`,
  );
}

main()
  .catch((error) => {
    logger.error('[Calibration] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
