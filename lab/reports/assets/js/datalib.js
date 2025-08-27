const HIDE_BUTTONS_TITLE = "Hide manipulation buttons";
const SHOW_BUTTONS_TITLE = "Enable sorting and filtering";

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

class IndexValuePair {
    index;
    value;

    constructor(index, value) {
        this.index = index;
        this.value = value;
    }
}

class TableDataView {
    // The index and value before rearranging rows and cols
    // after a sort operation.
    current_view;
    // The index and value after sorting.
    sorted_view;
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

    constructor(table) {
        let values = this.loadValuesAndButtons(table);
        // structuredClone may be too recent for some browsers, so the values
        // are assigned to current and sorted views.
        this.current_view = new Array(table.rows.length);
        this.sorted_view = new Array(table.rows.length);
        for (let i = 0; i < this.current_view.length; i++) {
            this.current_view[i] = new IndexValuePair(i, new Array(table.rows[0].cells.length));
            this.sorted_view[i] = new IndexValuePair(i, new Array(table.rows[0].cells.length));
            for (let j = 0; j < this.current_view[i].value.length; j++) {
                this.current_view[i].value[j] = new IndexValuePair(j, values[i][j]);
                this.sorted_view[i].value[j] = new IndexValuePair(j, values[i][j]);
            }
        }
        this.filtered_rows = [];
        this.filtered_cols = [];
        this.ordering_by_row = false;
        this.orderings = [];
        this.filters = [];
        this.table = table;
    }

    loadValuesAndButtons(table) {
        let values = [];
        let is_header = true;
        // TODO: Filters dialog.
        let i = 0;
        for (const row of table.rows) {
            let is_row_header = true;
            let j = 0;
            let row_values = [];
            for (const cell of row.cells) {
                cell.setAttribute("row-index", i);
                cell.setAttribute("col-index", j);
                let value = cell.innerText;
                if (!is_header && !is_row_header) {
                    let parsed = parseFloat(value);
                    if (!isNaN(parsed)) {
                        value = parsed;
                    }
                } else {
                    // Add manipulation buttons.
                    if (is_header && is_row_header) {
                        // The first cell of the table contains general
                        // controls instead of row/column ones:
                        // toggle manipulation buttons, reset to orig and filter.
                        let toggle_button = table.querySelector(".nf-fae-tools");
                        let left_buttons_container = toggle_button.parentElement;
                        // Remove event listeners.
                        left_buttons_container.removeChild(toggle_button);
                        TableDataView.addButton(left_buttons_container,
                            "Toggle sorting and filtering controls",
                            ["button-left", "button-bordered", "nf", "nf-oct-eye"],
                            (button) => TableDataView.toggleVisibility(table, button.currentTarget));

                        TableDataView.addButton(left_buttons_container,
                            "Reset to the original view",
                            ["danger", "button-bordered", "button-left", "nf", "nf-fa-undo"],
                            () => this.resetToOrig());
                        let right_buttons_container = document.createElement("div");
                        right_buttons_container.classList.add("buttons-container");
                        left_buttons_container.parentElement.appendChild(right_buttons_container);
                        TableDataView.addButton(right_buttons_container,
                            "Open filters window",
                            ["button-bordered", "button-right", "nf", "nf-fa-filter"],
                            () => this.toggleFiltersDialog());
                    } else {
                        // Sort and hide buttons.
                        let cell_container = document.createElement("div");
                        cell_container.classList.add("cell-flex");

                        let cell_contents_div = document.createElement("div");
                        cell_contents_div.classList.add("cell-contents");
                        cell_contents_div.innerHTML = cell.innerHTML;

                        let left_buttons_container = document.createElement("div");
                        left_buttons_container.classList.add("buttons-container");
                        TableDataView.addButton(left_buttons_container,
                            "Filter " + (is_header ? "column" : "row"),
                            ["button-left", "danger", "nf", "nf-fa-minus_circle"],
                            is_row_header ? () => this.hideRow(cell) : () => this.hideColumn(cell));

                        let right_buttons_container = document.createElement("div");
                        right_buttons_container.classList.add("buttons-container", "buttons-together-container");
                        TableDataView.addButton(right_buttons_container,
                            "Add sort criterion by ascending order",
                            ["button-nomargin", "nf", "nf-fa-sort_asc", "button-sorting-asc"],
                            is_row_header ? () => this.toggleSortCriterion(cell, true, false) : () => this.toggleSortCriterion(cell, false, false));
                        let inter_sorting_buttons = document.createElement("span");
                        inter_sorting_buttons.classList.add("inter-sorting-buttons", "inter-sorting-buttons-empty", "nf");
                        right_buttons_container.appendChild(inter_sorting_buttons);
                        TableDataView.addButton(right_buttons_container,
                            "Add sort criterion by descending order",
                            ["button-nomargin", "nf", "nf-fa-sort_desc", "button-sorting-desc"],
                            is_row_header ? () => this.toggleSortCriterion(cell, true, true) : () => this.toggleSortCriterion(cell, false, true));

                        let title_container = document.createElement("div");
                        title_container.classList.add("flex-cell-title-header");
                        let title_span = document.createElement("span");
                        title_span.classList.add("cell-contents");
                        title_span.innerHTML = cell.innerHTML;
                        title_container.appendChild(title_span);

                        cell_container.appendChild(left_buttons_container);
                        cell_container.appendChild(title_container);
                        cell_container.appendChild(right_buttons_container);
                        cell.innerHTML = '';
                        cell.appendChild(cell_container);
                    }
                }
                row_values.push(value);
                if (is_row_header) {
                    is_row_header = false;
                }
                j++;
            }
            i++;
            values.push(row_values);
            is_header = false;
        }

        return values;
    }

    static toggleVisibility(table, toggle_button) {
        let buttons = table.querySelectorAll(".button");
        if (toggle_button.classList.contains("nf-fae-tools")) {
            // Show.
            toggle_button.classList.remove("nf-fae-tools");
            toggle_button.classList.add("nf-oct-eye");
            toggle_button.title = HIDE_BUTTONS_TITLE;
            for (let button of buttons) {
                if (button != toggle_button) {
                    button.classList.remove("element-hidden");
                }
            }
        } else {
            // Hide.
            toggle_button.classList.remove("nf-oct-eye");
            toggle_button.classList.add("nf-fae-tools");
            toggle_button.title = SHOW_BUTTONS_TITLE;
            for (let button of buttons) {
                if (button != toggle_button) {
                    button.classList.add("element-hidden");
                }
            }
        }
    }

    static addButton(container, title, css_classes, on_click) {
        let button = document.createElement("button");
        button.title = title;
        button.classList.add("button");
        for (let css_class of css_classes) {
            button.classList.add(css_class);
        }
        button.addEventListener("click", on_click);
        container.appendChild(button);

        return button;
    }

    static loadTable(table) {
        /**
         * Load the data of a `HTMLTableElement` into a 2D matrix and return
         * a `TableDataView` created with that matrix.
         */
        // Bucket of hidden rows and columns.
        let hidden_row = document.createElement("div");
        hidden_row.classList.add("hidden-elements-row", "row-hidden");
        let hidden_row_flex = document.createElement("div");
        hidden_row_flex.classList.add("hidden-elements-row-flex");
        hidden_row.appendChild(hidden_row_flex);
        for (let column of ["rows", "cols"]) {
            let hidden_cell = document.createElement("div");
            hidden_cell.classList.add("hidden-elements-cell", ("hidden-" + column));
            let hidden_header = document.createElement("div");
            hidden_header.classList.add("hidden-elements-header");
            hidden_header.innerText = "Hidden " + (column == "cols" ? "columns" : column);
            let hidden_contents = document.createElement("div");
            hidden_contents.classList.add("hidden-elements-contents");
            let empty_list = document.createElement("ul");
            empty_list.classList.add("undecorated-list");
            hidden_contents.appendChild(empty_list);
            hidden_cell.append(hidden_header);
            hidden_cell.append(hidden_contents);
            hidden_row_flex.append(hidden_cell);
        }
        table.prepend(hidden_row);

        return new TableDataView(table);
    }

    sortTable(reset) {
        this.sortData();
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
            this.renderTable(mode);
        }
    }

    addSortCriterion(crit, by_row) {
        let reset = false;
        if (by_row != this.ordering_by_row) {
            reset = true;
            this.ordering_by_row = by_row;
            this.orderings = [];
            this.sortData(true);
        }
        this.orderings.push(crit);
        this.sortTable(reset);

        return reset;
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
        this.ordering_by_row = false;
        this.orderings = [];
        this.filters = [];
        this.updateSortButtons();
        this.sortData(true);
        this.renderTable(RenderMode.FULL);
    }

    swapRows(sorted_row_idx) {
        let desired_index = this.sorted_view[sorted_row_idx].index;
        // The index 0 is header, never sorted.
        for (let i = 1; i < this.current_view.length; i++) {
            if (this.current_view[i].index == desired_index) {
                // Insert the element in the position.
                this.current_view.splice(sorted_row_idx, 0, this.current_view[i]);
                // Remove it from its previous position.
                this.current_view.splice(i+1, 1);
                // Move the row in the DOM table.
                this.table.tBodies[0].insertBefore(this.table.rows[i], this.table.rows[sorted_row_idx]);
                break;
            }
        }
    }

    swapCols(sorted_col_idx) {
        // The same index for all non-header rows.
        let desired_index = this.sorted_view[1].value[sorted_col_idx].index;
        for (let j = 1; j < this.current_view[1].value.length; j++) {
            if (this.current_view[1].value[j].index == desired_index) {
                for (let i = 0; i < this.current_view.length; i++) {
                    // Insert the element in the position.
                    this.current_view[i].value.splice(sorted_col_idx, 0, this.current_view[i].value[j]);
                    // Remove it from its previous position.
                    this.current_view[i].value.splice(j+1, 1);
                    // Move the row in the DOM table.
                    let node = this.table.rows[i].removeChild(this.table.rows[i].cells[j]);
                    this.table.rows[i].insertBefore(node, this.table.rows[i].cells[sorted_col_idx]);
                }
                break;
            }
        }
    }

    renderTable(mode) {
        // The index 0 is header, never sorted.
        if (mode == RenderMode.ROWS || mode == RenderMode.FULL) {
            for (let i = 1; i < this.current_view.length; i++) {
                if (this.current_view[i].index != this.sorted_view[i].index) {
                    this.swapRows(i);
                }
            }
        }
        if (mode == RenderMode.COLS || mode == RenderMode.FULL) {
            // If some non-header column is swapped, the same swapping is in all rows.
            for (let j = 1; j < this.current_view[1].value.length; j++) {
                if (this.current_view[1].value[j].index != this.sorted_view[1].value[j].index) {
                    this.swapCols(j);
                }
            }
        }
    }

    sortData(reset) {
        if (reset) {
            for (let i = 0; i < this.sorted_view.length; i++) {
                this.sorted_view.sort((a, b) => { return a.index > b.index; });
                this.sorted_view[i].value.sort((a, b) => { return a.index > b.index; });
            }
        } else {
            if (this.ordering_by_row) {
                // Each row must be sorted by following the criteria of selected
                // rows. So, we first get the sorting indexes based on these rows
                // and then sort all rows by these indexes.
                let indexes = Array.from({ length: this.sorted_view[0].value.length }, (_, i) => i);
                if (!reset) {
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
                            if (this.sorted_view[ord.index].value[a].value > this.sorted_view[ord.index].value[b].value) {
                                value = 1;
                            } else if (this.sorted_view[ord.index].value[a].value < this.sorted_view[ord.index].value[b].value) {
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
                for (let i = 0; i < this.sorted_view.length; i++) {
                    this.sorted_view[i].value = this.sorted_view[i].value.map((v, j, orig) => orig[indexes[j]]);
                }
            } else {
                this.sorted_view.sort((a, b) => {
                    // Headers are always the first one.
                    // Check the second column because the first one is always header.
                    if (a.index == 0) {
                        return -1;
                    }
                    if (b.index == 0) {
                        return 1;
                    }
                    let value = 0;
                    let ord_idx = 0;
                    let ord;

                    while (value == 0 && ord_idx < this.orderings.length) {
                        ord = this.orderings[ord_idx];
                        if (a.value[ord.index].value > b.value[ord.index].value) {
                            value = 1;
                        } else if (a.value[ord.index].value < b.value[ord.index].value) {
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
    }

    hideRow(cell) {
        let row = cell.parentElement;
        row.classList.add("row-hidden");
        for (let cell of row.cells) {
            cell.classList.add("cell-hidden");
        }

        let hidden_row = this.table.querySelector(".hidden-elements-row");
        hidden_row.classList.remove("row-hidden");
        let hidden_cell_contents_list = this.table.querySelector(".hidden-rows .hidden-elements-contents ul");
        let list_element = document.createElement("li");
        TableDataView.addButton(list_element,
            "Unfilter row",
            ["button-left", "positive", "nf", "nf-fa-plus_circle"],
            () => {
                hidden_cell_contents_list.removeChild(list_element);
                if (hidden_cell_contents_list.children.length === 0 &&
                    this.table.querySelector(".hidden-cols .hidden-elements-contents ul").children.length === 0) {
                    hidden_row.classList.add("row-hidden");
                }
                row.classList.remove("row-hidden");
                for (let cell of row.cells) {
                    cell.classList.remove("cell-hidden");
                }
            });
        let list_contents = document.createElement("span");
        list_contents.innerText = cell.querySelector(".cell-contents").innerText;
        list_element.appendChild(list_contents);
        hidden_cell_contents_list.appendChild(list_element);
    }

    hideColumn(cell) {
        let index = cell.getAttribute("col-index");
        for (let row of this.table.rows) {
            for (let cell of row.cells) {
                if (cell.getAttribute("col-index") == index) {
                    cell.classList.add("cell-hidden");
                    break;
                }
            }
        }

        let hidden_row = this.table.querySelector(".hidden-elements-row");
        hidden_row.classList.remove("row-hidden");
        let hidden_cell_contents_list = this.table.querySelector(".hidden-cols .hidden-elements-contents ul");
        let list_element = document.createElement("li");
        TableDataView.addButton(list_element,
            "Unfilter column",
            ["button-left", "positive", "nf", "nf-fa-plus_circle"],
            () => {
                hidden_cell_contents_list.removeChild(list_element);
                if (hidden_cell_contents_list.children.length === 0 &&
                    this.table.querySelector(".hidden-rows .hidden-elements-contents ul").children.length === 0) {
                    hidden_row.classList.add("row-hidden");
                }
                for (let row of this.table.rows) {
                    for (let cell of row.cells) {
                        if (cell.getAttribute("col-index") == index) {
                            cell.classList.remove("cell-hidden");
                            break;
                        }
                    }
                }
            });
        let list_contents = document.createElement("span");
        list_contents.innerText = cell.querySelector(".cell-contents").innerText;
        list_element.appendChild(list_contents);
        hidden_cell_contents_list.appendChild(list_element);
    }

    toggleSortCriterion(cell, by_row, descending) {
        let table_view = this;
        let index = (by_row ?
            parseInt(cell.getAttribute("row-index")) :
            parseInt(cell.getAttribute("col-index")));
        let crit = new Ordering(index, descending);
        let reset = this.addSortCriterion(crit, by_row);
        if (reset) {
            this.updateSortButtons();
        }
        let inter_sorting_buttons = document.createElement("span");
        inter_sorting_buttons.classList.add("nf", "nf-fa-close", "inter-sorting-buttons", "danger");
        let number_indicator = document.createElement("span");
        number_indicator.classList.add("sort-number-indicator");
        number_indicator.innerText = this.orderings.length;
        let buttons_container = cell.querySelector(".buttons-together-container");
        for (let button of buttons_container.children) {
            button.classList.add("element-hidden");
        }
        let remove_button = TableDataView.addButton(buttons_container,
            "Remove sort criterion",
            ["button-nomargin", "button-bordered", "button-sorting", "button-remove-sort"],
            () => table_view.removeSortButton(remove_button, crit));
        remove_button.setAttribute("index", index);
        remove_button.setAttribute("by_row", by_row);
        if (descending) {
            remove_button.appendChild(number_indicator);
            remove_button.appendChild(inter_sorting_buttons);
        }
        TableDataView.addButton(remove_button,
            "",
            ["button-nomargin", "nf",
             (descending ? "nf-fa-sort_desc" : "nf-fa-sort_asc"),
             (descending ? "button-sorting-desc" : "button-sorting-asc")],
            () => {});
        if (!descending) {
            remove_button.appendChild(inter_sorting_buttons);
            remove_button.appendChild(number_indicator);
        }
    }

    removeSortButtonUI(remove_button) {
        let parent = remove_button.parentNode;
        parent.removeChild(remove_button);
        for (let button of parent.children) {
            button.classList.remove("element-hidden");
        }
    }

    removeSortButton(remove_button, crit) {
        this.removeSortButtonUI(remove_button);
        this.removeSortCriterion(crit);
        this.updateSortButtons();
    }

    updateSortButtons() {
        let all_remove_sort_buttons = this.table.querySelectorAll(".button-remove-sort");
        for (let btn of all_remove_sort_buttons) {
            let index = btn.getAttribute("index");
            let by_row = btn.getAttribute("by_row") === "true";
            let new_index = null;
            if (this.ordering_by_row == by_row) {
                let i = 1;
                for (let crit of this.orderings) {
                    if (crit.index == index) {
                        new_index = i;
                        break;
                    }
                    i++;
                }
            }
            if (new_index) {
                let number_indicator = btn.querySelector(".sort-number-indicator");
                number_indicator.innerText = new_index;
            } else {
                this.removeSortButtonUI(btn);
            }
        }
    }


    toggleFiltersDialog() {
        let classes = this.table.querySelector(".filters-dialog").classList;
        if (classes.contains("filters-dialog-hidden")) {
            classes.remove("filters-dialog-hidden");
        } else {
            classes.add("filters-dialog-hidden");
        }
    }

    updateFilteredRowsAndCols() {
        // TODO: Filter rows and cols, the types of filters must be defined.
    }
}
