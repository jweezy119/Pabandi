import { PbnIcon } from './icons';
import Tooltip from './Tooltip';
import type { CoordinatorFilter, CoordinatorFilterId } from './types';

export interface LeftRailProps {
  filters: CoordinatorFilter[];
  activeFilter: CoordinatorFilterId;
  onFilterChange: (id: CoordinatorFilterId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewWorkOrder: () => void;
  newWorkOrderDisabled?: boolean;
}

/**
 * The navigation rail.
 *
 * The rail collapses to icon-only at 60px and the choice is persisted. In
 * collapsed mode the visible label is hidden, so the accessible name moves
 * into `aria-label` — dropping it would leave an unlabeled icon button, which
 * is exactly the failure the accessibility constraints rule out.
 */
export default function LeftRail({
  filters,
  activeFilter,
  onFilterChange,
  collapsed,
  onToggleCollapsed,
  onNewWorkOrder,
  newWorkOrderDisabled = false,
}: LeftRailProps) {
  return (
    <nav
      className={`pbn-rail${collapsed ? ' pbn-rail--collapsed' : ''}`}
      aria-label="Work views"
    >
      <div className="pbn-rail__section">
        <button
          type="button"
          className="pbn-btn pbn-btn--primary pbn-rail__new"
          onClick={onNewWorkOrder}
          disabled={newWorkOrderDisabled}
          data-pbn-focus-id="rail-new"
        >
          <PbnIcon name="plus" size={16} />
          <span className="pbn-rail__new-label">New work order</span>
        </button>
        <p className="pbn-rail__heading" id="pbn-rail-heading">
          Views
        </p>
      </div>

      <div className="pbn-rail__section" role="group" aria-labelledby="pbn-rail-heading">
        {filters.map((filter) => {
          const pressed = filter.id === activeFilter;
          return (
            <div className="pbn-rail__row" key={filter.id}>
              <button
                type="button"
                className="pbn-rail__filter"
                aria-pressed={pressed}
                aria-label={
                  collapsed
                    ? `${filter.label}. ${filter.description}${
                        filter.count == null ? '' : ` ${filter.count} items.`
                      }`
                    : undefined
                }
                onClick={() => onFilterChange(filter.id)}
                data-pbn-focus-id={`rail-filter-${filter.id}`}
              >
                <span className="pbn-rail__filter-icon">
                  <PbnIcon name={filter.icon} size={18} />
                </span>
                <span className="pbn-rail__label">{filter.label}</span>
                {filter.count != null && (
                  <span
                    className={`pbn-rail__count${
                      filter.id === 'review' && filter.count > 0 ? ' pbn-rail__count--alert' : ''
                    }`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
              {!collapsed && (
                <Tooltip
                  text={filter.help}
                  label={`What does "${filter.label}" mean?`}
                  focusId={`rail-filter-${filter.id}-help`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="pbn-rail__footer">
        <button
          type="button"
          className="pbn-rail__collapse"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          data-pbn-focus-id="rail-collapse"
        >
          <PbnIcon name={collapsed ? 'expand' : 'collapse'} size={16} />
          {!collapsed && <span className="pbn-rail__collapse-label">Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
