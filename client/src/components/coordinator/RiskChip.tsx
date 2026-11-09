import type { RiskAssessment } from './types';
import {
  formatPercent,
  OUT_OF_RANGE_TOOLTIP,
  RISK_BAND_LABEL,
  riskBand,
  riskTooltip,
} from './risk';
import Tooltip from './Tooltip';

export interface RiskChipProps {
  assessment: RiskAssessment;
  /**
   * The chip often sits inside a card that is itself a `<button>`, and a
   * button inside a button is invalid HTML. In that context the caller passes
   * `help={false}` and renders `<RiskChipHelp/>` as a sibling of the card
   * instead of nesting one.
   */
  help?: boolean;
  className?: string;
}

/**
 * `71% · High risk`, always with the plain-language label and always with a
 * one-sentence explanation (§4.1, §4.2).
 *
 * The number is mono and the label is sans: mono signals "this is data", sans
 * signals "this is UI" (§2). The two are separate elements rather than one
 * mixed text run.
 */
export default function RiskChip({ assessment, help = true, className = '' }: RiskChipProps) {
  const band = riskBand(assessment.score, assessment.band);
  const outOfRange = assessment.outOfRange;

  return (
    <span
      className={[
        'pbn-risk-chip',
        `pbn-risk-chip--${band}`,
        outOfRange ? 'pbn-risk-chip--out-of-range' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="pbn-risk-chip__score">{formatPercent(assessment.score)}</span>
      <span className="pbn-risk-chip__sep" aria-hidden="true">
        ·
      </span>
      <span className="pbn-risk-chip__label">{RISK_BAND_LABEL[band]}</span>
      {outOfRange && (
        <span className="pbn-risk-chip__flag">Outside validated range</span>
      )}
      {help && <RiskChipHelp assessment={assessment} />}
    </span>
  );
}

/** The "?" affordance for a risk chip, exported so a card can place it outside itself. */
export function RiskChipHelp({
  assessment,
  focusId,
}: {
  assessment: RiskAssessment;
  focusId?: string;
}) {
  const band = riskBand(assessment.score, assessment.band);
  const text = assessment.outOfRange
    ? `${riskTooltip(band, assessment.score)} ${OUT_OF_RANGE_TOOLTIP}`
    : riskTooltip(band, assessment.score);

  return (
    <Tooltip
      text={text}
      label={`What does "${RISK_BAND_LABEL[band]}" mean?`}
      focusId={focusId}
    />
  );
}
