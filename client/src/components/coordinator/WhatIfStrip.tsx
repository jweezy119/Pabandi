import { useEffect, useRef, useState } from 'react';
import { coordinatorService } from '../../services/api';
import { PbnIcon } from './icons';
import { formatPercent } from './risk';
import Tooltip from './Tooltip';
import type { WorkOrderFeatures } from './types';

/**
 * One slider: the feature, its plain-language label, and the range it sweeps.
 *
 * `min`/`max` are chosen per feature rather than shared so a slider never
 * spends most of its travel in a region the business will never use — the
 * experience slider stops at 30 years because beyond that it is decorative.
 */
interface SliderDef {
  key: keyof WorkOrderFeatures;
  label: string;
  /** One sentence, shown under the label. This is the tooltip too. */
  help: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

const SLIDERS: SliderDef[] = [
  {
    key: 'schedule_density',
    label: 'Jobs already booked for this day',
    help: 'More jobs on the same day leaves less room to reach this one if something runs long.',
    min: 0,
    max: 10,
    step: 1,
    format: (value) => `${value} ${value === 1 ? 'job' : 'jobs'}`,
  },
  {
    key: 'lead_time_days',
    label: 'Days of notice',
    help: 'How many days passed between the customer booking and the scheduled start.',
    min: 0,
    max: 14,
    step: 0.5,
    format: (value) => (value === 0 ? 'Same day' : `${value} ${value === 1 ? 'day' : 'days'}`),
  },
  {
    key: 'issue_type_complexity',
    label: 'How involved the job is',
    help: 'Routine maintenance sits at the low end; emergencies and major repairs at the high end.',
    min: 0,
    max: 1,
    step: 0.05,
    format: (value) => `${Math.round(value * 100)}%`,
  },
  {
    key: 'technician_skill_match',
    label: "Technician's skill match",
    help: 'How much of this kind of work the assigned technician has done before.',
    min: 0,
    max: 1,
    step: 0.05,
    format: (value) => `${Math.round(value * 100)}%`,
  },
  {
    key: 'technician_experience_years',
    label: "Technician's experience",
    help: 'Years the technician has worked in this trade.',
    min: 0,
    max: 30,
    step: 1,
    format: (value) => `${value} ${value === 1 ? 'year' : 'years'}`,
  },
];

export interface WhatIfStripProps {
  workOrderId: string;
  /** Where the sliders start. Comes from the server's own feature extraction. */
  features: WorkOrderFeatures;
}

interface SimulationState {
  score: number;
  p10: number;
  p50: number;
  p90: number;
  outOfRange: boolean;
}

/**
 * The what-if strip (§7.2).
 *
 * Sliders change a feature; the server recomputes a bootstrapped range. The
 * strip shows the range, never a single number, and greys the result when a
 * slider has moved a feature more than two standard deviations from the
 * training mean — hiding it would look like the model simply refused, and
 * showing it as a confident prediction would be a lie.
 *
 * Slider changes are debounced rather than fired per `input` event: the
 * simulation is rate-limited server-side, and a coordinator dragging a slider
 * should not spend that budget on intermediate positions.
 */
export default function WhatIfStrip({ workOrderId, features }: WhatIfStripProps) {
  const [values, setValues] = useState<WorkOrderFeatures>(features);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The request currently in flight, so a slow earlier response cannot
  // overwrite a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    setValues(features);
  }, [features]);

  // The strip opens with the job's own range, not an empty panel. Keyed on the
  // work order rather than `features` so switching jobs re-runs exactly once.
  useEffect(() => {
    void runSimulation(features);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function runSimulation(next: WorkOrderFeatures) {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const perturbation: Partial<WorkOrderFeatures> = {};
    for (const slider of SLIDERS) {
      const delta = next[slider.key] - features[slider.key];
      if (Math.abs(delta) > 1e-9) perturbation[slider.key] = delta;
    }

    try {
      const response = await coordinatorService.simulateWorkOrderRisk(
        workOrderId,
        perturbation,
      );
      // A newer request has started; this result is stale.
      if (id !== requestId.current) return;

      const payload = response.data?.data;
      if (!payload || typeof payload.riskScore !== 'number') {
        setError('We could not work out that scenario. Move a slider and try again.');
        return;
      }

      setSimulation({
        score: payload.riskScore,
        p10: payload.p10 ?? payload.riskScore,
        p50: payload.p50 ?? payload.riskScore,
        p90: payload.p90 ?? payload.riskScore,
        outOfRange: Boolean(payload.outOfRange),
      });
    } catch {
      if (id !== requestId.current) return;
      setError('We could not work out that scenario. Check your connection and try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  function handleSliderChange(key: keyof WorkOrderFeatures, raw: string) {
    const next = { ...values, [key]: Number(raw) };
    setValues(next);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runSimulation(next);
    }, 300);
  }

  function handleReset() {
    setValues(features);
    if (timer.current) clearTimeout(timer.current);
    void runSimulation(features);
  }

  const isDirty = SLIDERS.some(
    (slider) => Math.abs(values[slider.key] - features[slider.key]) > 1e-9,
  );

  return (
    <section className="pbn-inspector__section" aria-labelledby="pbn-whatif-heading">
      <h3 className="pbn-inspector__section-title" id="pbn-whatif-heading">
        What if?
        <Tooltip
          text="Move a slider to see how the risk would change. We show a range, not one number, because the exact outcome is not knowable in advance."
          label="What does 'What if?' mean?"
        />
      </h3>

      <div className="pbn-whatif">
        {SLIDERS.map((slider) => (
          <div className="pbn-whatif__row" key={slider.key}>
            <label className="pbn-whatif__label" htmlFor={`pbn-whatif-${slider.key}`}>
              {slider.label}
            </label>
            <input
              id={`pbn-whatif-${slider.key}`}
              className="pbn-whatif__slider"
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={values[slider.key]}
              onChange={(event) => handleSliderChange(slider.key, event.target.value)}
              aria-describedby={`pbn-whatif-${slider.key}-help`}
            />
            <span className="pbn-whatif__value">{slider.format(values[slider.key])}</span>
            <p className="pbn-whatif__help" id={`pbn-whatif-${slider.key}-help`}>
              {slider.help}
            </p>
          </div>
        ))}

        <div className="pbn-whatif__actions">
          <button
            type="button"
            className="pbn-btn pbn-btn--ghost"
            onClick={handleReset}
            disabled={!isDirty || loading}
          >
            Reset to this job
          </button>
        </div>

        {error && (
          <p className="pbn-whatif__error" role="alert">
            {error}
          </p>
        )}

        {simulation && (
          <div
            className={[
              'pbn-range',
              simulation.outOfRange ? 'pbn-range--out-of-range' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="pbn-range__heading">
              <span className="pbn-range__label">Likely range</span>
              <span className="pbn-range__value">
                {formatPercent(simulation.p10)} – {formatPercent(simulation.p90)}
              </span>
            </p>
            <div className="pbn-range__track" aria-hidden="true">
              <span
                className="pbn-range__band"
                style={{
                  left: `${Math.round(simulation.p10 * 100)}%`,
                  width: `${Math.max(2, Math.round((simulation.p90 - simulation.p10) * 100))}%`,
                }}
              />
              <span
                className="pbn-range__median"
                style={{ left: `${Math.round(simulation.p50 * 100)}%` }}
              />
            </div>
            <p className="pbn-range__scale" aria-hidden="true">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </p>
            <p className="pbn-range__reading">
              Most likely around <strong>{formatPercent(simulation.p50)}</strong> risk of a
              problem.
            </p>
            {simulation.outOfRange && (
              <p className="pbn-range__warning">
                <PbnIcon name="alert" size={14} />
                Outside validated range — this slider moved further than the jobs we have
                history for, so treat it as a rough indication.
              </p>
            )}
            {loading && (
              <p className="pbn-range__loading" role="status">
                Recalculating…
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
