
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN
Number.isNaN = Number.isNaN || function(value) {
    return value !== value;
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger
Number.isInteger = Number.isInteger || function(value) {
    return typeof value === "number" &&
        isFinite(value) &&
        Math.floor(value) === value;
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(predicate) {
        if (this === null) {
            throw new TypeError('Array.prototype.findIndex called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return i;
            }
        }
        return -1;
    };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        //'use strict';
        if (typeof start !== 'number') {
            start = 0;
        }

        if (start + search.length > this.length) {
            return false;
        } else {
            return this.indexOf(search, start) !== -1;
        }
    };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(searchString, position) {
        var subjectString = this.toString();
        if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}

class Filter {
    /**
     * Properties of the applied filter:
     * - `continent`: col_all, row_all, col_any, row_any, col_avg, row_avg.
     * - `condition`: function that returns true if the value satisfies the
     *   conditions to not be filtered.
     */
    continent;
    condition;
}

class Ordering {
    /**
     * Index and ascending/descending property of an ordering.
     */
    index;
    descending;

    constructor(index, descending) {
        this.index = index;
        if (descending) {
            this.descending = true;
        } else {
            this.descending = false;
        }
    }
}

const RenderMode = Object.freeze({
    FULL: Symbol("full"),
    ROWS: Symbol("rows"),
    COLS: Symbol("cols")
});

class TableCell {
    /**
     * Store the contents of a cell as a value and an HTML element.
     */
    value;
    cell_contents;
    is_header;

    constructor(value, cell_contents, is_header) {
        this.value = value;
        this.cell_contents = cell_contents;
        this.is_header = is_header;
    }
}

class TableDataView {
    /**
     * View of the data of a table stored as a 2D matrix.
     * This includes the original data to reset filters and orderings,
     * the current non-filtered view and the current filtered view.
     */
    original_data;
    current_view;
    filtered_rows;
    filtered_cols;
    // Ordering by column or row.
    ordering_by_row;
    // Orderings applied in decreasing priority.
    orderings;
    // Vector of applied filters.
    filters;
    // DOM table (to update it).
    table;

    constructor(data, table) {
        this.original_data = data;
        // A copy is needed.
        this.current_view = data.map((v) => v);
        this.filtered_rows = [];
        this.filtered_cols = [];
        this.ordering_by_row = false;
        this.orderings = [];
        this.filters = [];
        this.table = table;
    }

    static loadTable(table) {
        /**
         * Load the data of a `HTMLTableElement` into a 2D matrix and return
         * a `TableDataView` created with that matrix.
         */
        let data = [];
        let is_header = true;
        for (const row of table.rows) {
            let is_row_header = true;
            let cells = []
            for (const cell of row.cells) {
                let value = cell.innerText;
                if (!is_header && !is_row_header) {
                    let parsed = parseFloat(value);
                    if (!isNaN(parsed)) {
                        value = parsed;
                    }
                }
                cells.push(new TableCell(value, cell.innerHTML, is_header || is_row_header));
                if (is_row_header) {
                    is_row_header = false;
                }
            }
            data.push(cells);
            if (is_header) {
                is_header = false;
            }
        }

        return new TableDataView(data, table);
    }

    sortTable(reset) {
        // Sort implies re-filter.
        if (reset) {
            this.current_view = this.original_data.map((v) => v);
        }
        let affected = this.sortCurrentView(reset);
        if (reset) {
            this.renderTable(RenderMode.FULL);
        } else {
            let mode = RenderMode.ROWS;
            if (this.ordering_by_row) {
                mode = RenderMode.COLS;
            }
            if (this.filters.length > 0) {
                this.updateFilteredRowsAndCols();
            }
            this.renderTable(mode, affected);
        }
    }

    addSortCriterion(crit, by_row) {
        let reset = false;
        if (by_row != this.ordering_by_row) {
            reset = true;
            this.ordering_by_row = by_row;
            this.orderings = [];
        }
        this.orderings.push(crit);
        this.sortTable(reset);
    }

    removeSortCriterion(crit) {
        let i = 0;
        for (const ord of this.orderings) {
            if (ord.index == crit.index) {
                this.orderings.splice(i, 1);
                break;
            }
            i++;
        }
        if (this.orderings.length > 0) {
            this.sortTable(true);
        } else {
            this.resetToOrig();
        }
    }

    resetToOrig() {
        // Copy (not reference) the original data.
        this.current_view = this.original_data.map((v) => v);
        this.ordering_by_row = false;
        this.orderings = [];
        this.filters = [];
        this.renderTable(RenderMode.FULL);
    }

    renderTable(mode, affected_indexes) {
        let affected_cells = [];
        if (mode == RenderMode.FULL) {
            for (const row of this.table.rows) {
                for (const cell of row.cells) {
                    affected_cells.push(cell);
                }
            }
        } else if (mode == RenderMode.ROWS) {
            let i = 0;
            for (const row of this.table.rows) {
                if (affected_indexes.includes(i)) {
                    for (const cell of row.cells) {
                        affected_cells.push(cell);
                    }
                }
                i++;
            }
        } else {
            for (const row of this.table.rows) {
                for (const idx of affected_indexes) {
                    affected_cells.push(row.cells[idx]);
                }
            }
        }
        for (let cell of affected_cells) {
            cell.classList.add("changing-cell");
        }

        // Change the contents of the table.
        let i = 0;
        for (let row of this.table.rows) {
            let j = 0;
            for (let cell of row.cells) {
                cell.innerHTML = this.current_view[i][j].cell_contents;
                const was_filtered = cell.classList.contains("cell-filtered");
                if (was_filtered && !this.filtered_rows.includes(i) && !this.filtered_cols.includes(j)) {
                    cell.classList.remove("cell-filtered");
                    cell.classList.add("cell-unfiltered");
                } else if (!was_filtered && (this.filtered_rows.includes(i) || this.filtered_cols.includes(j))) {
                    if (cell.classList.contains("cell-unfiltered")) {
                        cell.classList.remove("cell-unfiltered");
                    }
                    cell.classList.add("cell-filtered");
                }
                j++;
            }
            i++;
        }

        for (let cell of affected_cells) {
            cell.classList.remove("changing-cell");
        }
    }

    sortCurrentView(reset) {
        // Affected rows/cols are only computed if no reset.
        let affected = null;

        const before = this.current_view.map((v) => v.map((cell) => cell.value));
        this.sortData();

        if (!reset) {
            affected = [];
            // Comparing the value of the header is enough to know it has changed.
            if (this.ordering_by_row) {
                let i = 0;
                for (const col of this.current_view[0]) {
                    if (col.value !== before[0][i]) {
                        affected.push(i);
                    }
                    i++;
                }
            } else {
                let i = 0;
                for (const row of this.current_view) {
                    if (row[0].value !== before[i][0]) {
                        affected.push(i);
                    }
                    i++;
                }
            }
        }

        return affected;
    }

    sortData() {
        if (this.ordering_by_row) {
            // Each row must be sorted by following the criteria of selected
            // rows. So, we first get the sorting indexes based on these rows
            // and then sort all rows by these indexes.
            let indexes = Array.from({ length: this.current_view[0].length }, (_, i) => i);
            indexes.sort((a, b) => {
                let value = 0;
                let ord_idx = 0;
                let ord;
                // Headers are always the first one.
                if (a == 0) {
                    return -1;
                }
                if (b == 0) {
                    return 1;
                }

                while (value == 0 && ord_idx < this.orderings.length) {
                    ord = this.orderings[ord_idx];
                    if (this.current_view[ord.index][a].value > this.current_view[ord.index][b].value) {
                        value = 1;
                    } else if (this.current_view[ord.index][a].value < this.current_view[ord.index][b].value) {
                        value = -1;
                    }
                    ord_idx++;
                }

                if (ord.descending && value != 0) {
                    value = -value;
                }

                return value;
            });
            for (let i = 0; i < this.current_view.length; i++) {
                this.current_view[i] = this.current_view[i].map((v, j, orig) => orig[indexes[j]]);
            }
        } else {
            this.current_view.sort((a, b) => {
                // Headers are always the first one.
                // Check the second column because the first one is always header.
                if (a[1].is_header) {
                    return -1;
                }
                if (b[1].is_header) {
                    return 1;
                }
                let value = 0;
                let ord_idx = 0;
                let ord;

                while (value == 0 && ord_idx < this.orderings.length) {
                    ord = this.orderings[ord_idx];
                    if (a[ord.index].value > b[ord.index].value) {
                        value = 1;
                    } else if (a[ord.index].value < b[ord.index].value) {
                        value = -1;
                    }
                    ord_idx++;
                }

                if (ord.descending && value != 0) {
                    value = -value;
                }

                return value;
            });
        }
    }

    updateFilteredRowsAndCols() {
        // TODO: Filter rows and cols, the types of filters must be defined.
    }
}
