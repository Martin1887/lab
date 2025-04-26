function toggle_element(element) {
    if (element.style.display == "none") {
        element.style.display = "";
    } else {
        element.style.display = "none";
    }
}

function find_next(element, classname) {
    element = element.nextSibling;
    while(element.nodeName != classname)
        element = element.nextSibling;
    return element;
}

function toggle_table(toggle_button) {
    var table = find_next(toggle_button, "TABLE");
    toggle_element(table);
    if (toggle_button.innerHTML == "Show table") {
        toggle_button.innerHTML = "Hide table";
    } else {
        toggle_button.innerHTML = "Show table";
    }
}

function show_table(section) {
    heading = section.children[0];
    var toggle_button = find_next(heading, "BUTTON");
    var table = find_next(toggle_button, "TABLE");
    table.style.display = "";
    toggle_button.innerHTML = "Hide table";
}

function show_main_tables() {
    var names = ["unexplained-errors", "info", "summary"];
    for (var i = 0; i < names.length; i++) {
        var section = document.getElementById(names[i]);
        try {
            show_table(section);
        } catch (e) {
            console.log("No table found for " + names[i]);
        }
    }

    // If there is only one table, show it and hide the button.
    var buttons = document.getElementsByTagName('button');
    var tables = document.getElementsByTagName('table');
    if (buttons.length == 1 && tables.length == 1) {
        tables[0].style.display = "";
        buttons[0].style.display = "none";
    }
}

document.addEventListener("DOMContentLoaded", show_main_tables);
