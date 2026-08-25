import { memo, useMemo, useState } from "react";
import { ChevronDownIcon, CheckIcon } from "@/components/Icons";

// Multi-select variant of the metrics FilterDropdown: checkboxes instead of a
// single active row, plus a search box. selectedIds=[] means "no filter -
// everything included" server-side, but is rendered with every box UNCHECKED
// (not all ticked) - showing them all as checked would mean picking a second
// or third item requires first unchecking every other one, which is
// backwards from how a fresh multi-select is normally used.
const MultiSelectFilterDropdown = memo(
  ({ id, label, icon, options = [], selectedIds = [], onChange, searchable = false }) => {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredOptions = useMemo(() => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return options;
      return options.filter((option) =>
        String(option?.name || "")
          .toLowerCase()
          .includes(query)
      );
    }, [options, searchTerm]);

    const isAllState = selectedIds.length === 0;
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const toggleOption = (optionId) => {
      if (isAllState) {
        // Coming from "everything selected", clicking one item narrows down
        // to just that item - not "everyone except this one" (which used to
        // build a filter list of every other id, sometimes hundreds of them,
        // for what the user meant as a single-item filter).
        onChange([optionId]);
        return;
      }
      const next = selectedSet.has(optionId)
        ? selectedIds.filter((optId) => optId !== optionId)
        : [...selectedIds, optionId];
      // If toggling back on lands on literally every option, collapse to the
      // implicit all-state so the trigger label stays clean.
      onChange(next.length === options.length ? [] : next);
    };

    const triggerLabel = isAllState
      ? label
      : selectedIds.length === 1
        ? `${label}: ${options.find((option) => option.id === selectedIds[0])?.name || "1 selected"}`
        : `${label}: ${selectedIds.length} selected`;
    const isActive = !isAllState;

    return (
      <details
        id={id}
        data-testid={`metrics-filter-${label.toLowerCase().replace(/ /g, "-")}`}
        className="dropdown"
        tabIndex={0}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.removeAttribute("open");
          }
        }}
      >
        <summary
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium cursor-pointer select-none transition-colors ${
            isActive
              ? "bg-primary/10 border-primary text-base-content"
              : "bg-base-100 border-base-300 text-base-content/70 hover:bg-base-200"
          }`}
        >
          {icon}
          <span className="truncate max-w-[160px]">{triggerLabel}</span>
          <ChevronDownIcon className="w-3 h-3 flex-shrink-0 text-base-content/50" />
        </summary>

        {/* Centered under its own trigger (left-1/2 + -translate-x-1/2) instead
            of a hardcoded left/right side - a fixed side only stays correct
            for as long as this pill sits at that same spot in the toolbar.
            Centering keeps it anchored to its own button regardless of where
            the row wraps or reflows, so it can't drift off past the left or
            right edge of the screen depending on which filter it is. */}
        <div className="dropdown-content z-high mt-2 left-1/2 -translate-x-1/2 p-1 shadow-lg bg-base-100 rounded-box w-64 max-w-[90vw] border border-base-300">
          {searchable && (
            <div className="px-1 pb-1">
              <input
                autoComplete="off"
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-sm w-full bg-base-200 border-base-content/20"
              />
            </div>
          )}
          <ul className="menu flex flex-col flex-nowrap p-0 max-h-64 w-full overflow-y-auto overflow-x-hidden">
            {filteredOptions.map((option) => {
              const checked = selectedSet.has(option.id);
              return (
                <li key={option.id} className="w-full">
                  <a className="flex items-center gap-2 w-full truncate py-2" onClick={() => toggleOption(option.id)}>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                        checked ? "bg-primary border-primary" : "border-base-content/30"
                      }`}
                    >
                      {checked && <CheckIcon className="w-3 h-3 text-primary-content" />}
                    </span>
                    {option.dotClass && (
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${option.dotClass}`} />
                    )}
                    {option.iconNode && <span className="flex items-center flex-shrink-0">{option.iconNode}</span>}
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="truncate">{option.name}</span>
                      {option.meta && (
                        <span className="text-[10.5px] text-base-content/50 truncate">{option.meta}</span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
            {filteredOptions.length === 0 && (
              <li>
                <a className="pointer-events-none text-base-content/50">No options found</a>
              </li>
            )}
          </ul>
          {!isAllState && (
            <div className="flex justify-end pt-1 mt-1 border-t border-base-300">
              <a
                className="text-xs text-base-content/60 hover:text-base-content px-2 py-1 cursor-pointer"
                onClick={() => onChange([])}
              >
                Reset ({selectedIds.length})
              </a>
            </div>
          )}
        </div>
      </details>
    );
  }
);

MultiSelectFilterDropdown.displayName = "MultiSelectFilterDropdown";

export default MultiSelectFilterDropdown;
