let names_data = document.getElementById("ingredient_names").value;
let units_data = document.getElementById("ingredient_units").value;
let values_data = document.getElementById("ingredient_values").value;
let descriptions_data = document.getElementById("ingredient_descriptions").value;
let scale_ingredient = document.getElementById("ingredients");
let scale_quantity = document.getElementById("scale");
let convert_from = document.getElementById("convertFrom");
let convert_to = document.getElementById("convertTo");
let scale_unit = document.getElementById("scaleUnit");
let convert_selected_button = document.getElementById("convertSelectedButton");
let delete_button = document.getElementById("deleteButton");
let row_added_message = document.getElementById("rowAddedMessage");
let new_row_count = 0;
convert_from.onchange = onConvertFromSelected;
scale_ingredient.onchange = onScaleIngredientSelected;
var names = names_data.substring(2, names_data.length - 2).split("\"\, \"", );
var units = units_data.substring(2, units_data.length - 2).split("\"\, \"", );
var values = values_data.substring(2, values_data.length - 2).split("\"\, \"", );
var descriptions = descriptions_data.substring(2, descriptions_data.length - 2).split("\"\, \"", );
const columnDefs = [
  {
    field: "ingredient",
    checkboxSelection: true,
    rowDrag: true,
    suppressSizeToFit: true,
    width:180,
    valueFormatter:
        'if (value != null && value.trim().substring(0,1) == "#"){ value = value.trim().substring(1); value = value.toUpperCase(); return value;}'
  },
  { field: "quantity", type: 'numericColumn', width: 80 },
  { field: "unscaled", type: 'numericColumn', hide: true },
  { field: "scale", type: 'numericColumn', hide: true },
  { field: "units", width:70 },
  { field: "details", flex: 1, minWidth: 90 }
];

// specify the data
const rowData = [];

for (let i = 0; i < names.length; i++){
    if(values[i] == "None"){
        values[i] = "";
    }
    else{
        values[i] = Number(values[i]);                          //Number trims 0s
        let qty = Qty.parse(values[i] + ' ' + units[i]);        //Convert to a Qty and back to standardize unit spelling
        if(qty != null){
            values[i] = qty.toString().split(' ')[0];
            units[i] = qty.toString().split(' ')[1];
        }
    }

    let entry = { ingredient: unicodeToChar(names[i]), quantity: values[i], unscaled: values[i], scale: 1, units: units[i], details: descriptions[i]};
    rowData.push(entry);
}

// let the grid know which columns and what data to use
const gridOptions = {
    columnDefs: columnDefs,
    rowData: rowData,
    rowHeight: 30,
    defaultColDef: {
        resizable: true,
        editable: true,
        suppressMovable:true
    },
    rowDragManaged: true,
    animateRows: true,
    stopEditingWhenCellsLoseFocus: true,
    domLayout: 'autoHeight',
    rowSelection: 'multiple',
    suppressRowClickSelection: true,
    onCellValueChanged: onCellValueChanged,
    onCellEditingStopped: onCellEditingStopped,
    onSelectionChanged: onSelectionChanged,
    rowClassRules: {
        'subheadings': function (params) {
          var entry = params.data.ingredient;
          if(entry == null){
            entry = 'hi!'
            return false
          }
          else{
            return entry.trim().substring(0,1) == '#';
          }
        },
    },
};


export function onAddRow() {
    new_row_count = 1;
    var api = gridOptions.api;
    let current_scale = 1;
    gridOptions.api.forEachNode((rowNode, index) => {
        if(rowNode.data.scale != null){
            current_scale = rowNode.data.scale;
        }
    })
    api.applyTransaction({add: [{ ingredient: "Ingredient", quantity: 0, units: 'Unit', details: 'Extra Info', scale: current_scale, unscaled: 0}] });
    row_added_message.innerHTML = "1 row added to the bottom of the table.";
}

export function onAddExtraRow() {
    new_row_count += 1;
    var api = gridOptions.api;
    let current_scale = 1;
    gridOptions.api.forEachNode((rowNode, index) => {
        if(rowNode.data.scale != null){
            current_scale = rowNode.data.scale;
        }
    })
    api.applyTransaction({add: [{ ingredient: "Ingredient", quantity: 0, units: 'Unit', details: 'Extra Info', scale: current_scale, unscaled: 0}] });
    row_added_message.innerHTML = new_row_count + " rows added to the bottom of the table.";
}

export function onDeleteRows() {
    var api = gridOptions.api;
    const selectedRows = api.getSelectedRows();
    if(selectedRows.length < 1){
        var heading_error_modal = new bootstrap.Modal(document.getElementById("headingErrorModal"), {});
        heading_error_modal.show();
    }
    api.applyTransaction({remove: selectedRows });
    onCellValueChanged('delete');
}

export function onSizeToFit() {
    gridOptions.api.sizeColumnsToFit();
}

export function onAutoSize() {
    var allColumnIds = [];
    gridOptions.columnApi.getColumns().forEach((column) => {
        allColumnIds.push(column.getId());
    });
    gridOptions.columnApi.autoSizeColumns(allColumnIds, true);
}

export function onSelectAllOrNone() {
    let selectAll = true;
    let firstRow = true
    gridOptions.api.forEachNode((rowNode, index) => {
        if(firstRow){
            selectAll = rowNode.isSelected();
            firstRow = false;
        }
        if(selectAll){
            rowNode.setSelected(false);
        }
        else{
            rowNode.setSelected(true);
        }
    })
}

export function onToggleHeading() {
    var selectedRows = gridOptions.api.getSelectedNodes();
    if(selectedRows.length < 1){
        var heading_error_modal = new bootstrap.Modal(document.getElementById("headingErrorModal"), {});
        heading_error_modal.show();
    }
    else{
        for(let i = 0; i < selectedRows.length; i++) {
            var rowNode = selectedRows[i];
            if(rowNode.data.ingredient.substring(0, 1) == "#"){
                try{
                    rowNode.setDataValue('ingredient', rowNode.data.ingredient.substring(1));
                }
                catch{
                }
            }
            else{
                rowNode.setDataValue('ingredient', "#" + rowNode.data.ingredient);
            }
            rowNode.setSelected(false);
        }
    }
}

export function onScaleQuantities() {
    if(scale_quantity.value>0){
        let ingredient_index = scale_ingredient.selectedIndex;
        var subheading_locations = [];
        gridOptions.api.forEachNode((rowNode, index) => {                   //index subheading locations
            if(rowNode.data.ingredient.trim().substring(0,1) == '#' || isNaN(rowNode.data.quantity) || rowNode.data.quantity == "" || rowNode.data.quantity == 0){
                subheading_locations.push(index);
            }
        })
        for(let i = 0; i < subheading_locations.length; i++){               //adjust ingredient index with subheading locations
            if(subheading_locations[i] < ingredient_index){
                ingredient_index++;
            }
        }
        let new_quantity = scale_quantity.value;
        let scale = 1;
        gridOptions.api.forEachNode((rowNode, index) => {                   //find row with adjusted index
            if(ingredient_index-1 == index){
                scale = new_quantity / rowNode.data.unscaled;
            }
        })
        gridOptions.api.forEachNode((rowNode, index) => {                   //scale all ingredients
            if(rowNode.data.ingredient.trim().substring(0,1) != '#'  && !isNaN(rowNode.data.quantity) && rowNode.data.quantity != ""){
                //rowNode.setDataValue('quantity', Number((rowNode.data.unscaled * scale).toFixed(2)));
                rowNode.setDataValue('quantity', roundQuantity(rowNode.data.unscaled * scale));
                rowNode.setDataValue('scale', scale);
            }
        })
    }
    scale_unit.textContent = "";
    scale.value = "";
}

export function onResetQuantities() {
    gridOptions.api.forEachNode((rowNode, index) => {
        if (rowNode.data.quantity != "") {
            rowNode.setDataValue('quantity', roundQuantity(rowNode.data.quantity/rowNode.data.scale));
            rowNode.setDataValue('unscaled', roundQuantity(rowNode.data.quantity));
            rowNode.setDataValue('scale', 1);
        }
    })

}

function roundQuantity(number) {                                    //rounds more precisely at lower values
    let qty = Qty.parse(number + ' g');
    let qty1 = qty.toPrec('0.01 g').toString().split(' ')[0];
    let qty2 = qty.toPrec('0.05 g').toString().split(' ')[0];
    let qty3 = qty.toPrec('0.1 g').toString().split(' ')[0];
    let qty4 = qty.toPrec('0.5 g').toString().split(' ')[0];
    let qty5 = qty.toPrec('1 g').toString().split(' ')[0];
    let qty6 = qty.toPrec('5 g').toString().split(' ')[0];
    let qty7 = qty.toPrec('10 g').toString().split(' ')[0];
    let qty8 = qty.toPrec('50 g').toString().split(' ')[0];
    let qty9 = qty.toPrec('100 g').toString().split(' ')[0];
    let qty10 = qty.toPrec('500 g').toString().split(' ')[0];
    var numbers = [qty1, qty2, qty3, qty4, qty5, qty6, qty7, qty8, qty9, qty10];
    let result = numbers[0];
    for(let i = numbers.length; i>=0; i--){
        if(numbers[i] != result){
            if(Math.abs(numbers[i] - result)/result < .0025){        //if difference less than 2.5% don't round more precisely.
                break;
            }
            else{
                result = numbers[i];
            }
        }
    }
    return result;
}

function onSelectionChanged(event){
    var rowCount = event.api.getSelectedNodes().length;
    if (rowCount == 0){
        delete_button.textContent = 'Delete';
        convert_selected_button.textContent = 'Convert Selected';
    }
    else{
        delete_button.textContent = 'Delete (' + rowCount + ')';
        convert_selected_button.textContent = 'Convert Selected (' + rowCount + ')';
    }
}

function onScaleIngredientSelected(){
    let ingredient_index = scale_ingredient.selectedIndex;
    var subheading_locations = [];
    gridOptions.api.forEachNode((rowNode, index) => {
        if(rowNode.data.ingredient.trim().substring(0,1) == '#' || isNaN(rowNode.data.quantity) || rowNode.data.quantity == "" || rowNode.data.quantity == 0){
            subheading_locations.push(index);
        }
    })
    for(let i = 0; i < subheading_locations.length; i++){
        if(subheading_locations[i] < ingredient_index){
            ingredient_index++;
        }
    }
    gridOptions.api.forEachNode((rowNode, index) => {
        if(ingredient_index-1 == index){
            scale_unit.textContent = rowNode.data.units;
            scale.value = rowNode.data.quantity;
        }
    })
}

function onConvertFromSelected(){
    try{
        var fromUS = '';
        var US = '';
        if(convert_from.value.endsWith("(US)")){
            US = ' (US)';
            fromUS = 'US-';
        }
        let qty1 = Qty('1 ' + fromUS + convert_from.value.split(' ')[0]);
        let units = Qty.getUnits(qty1.kind());
        while(convert_to.length > 0){
            convert_to.remove(convert_to[0]);
        }
        var option = document.createElement("option");
        option.text = "Convert to...";
        convert_to.add(option);
        for(let i = 0; i < units.length; i++){
            let qty2 = Qty('1 ' + units[i]);
            if(qty1.isCompatible(qty2)){
                var option = document.createElement("option");
                option.text = units[i];
                convert_to.add(option);
            }
        }
    }
    catch{}
}

export function onConvert() {
    if(convert_to.value == convert_from.value){
        return;
    }
    var toUS = '';
    if(convert_to.value.endsWith("(US)")){
        toUS = 'US-';
    }
    var fromUS = '';
    var US = '';
    if(convert_from.value.endsWith("(US)")){
        US = ' (US)';
        fromUS = 'US-';
    }
    gridOptions.api.forEachNode((rowNode, index) => {
        if(rowNode.data.units + US == convert_from.value && !isNaN(rowNode.data.quantity) && rowNode.data.quantity != ''){
            try{
                let qty = Qty.parse(rowNode.data.quantity + ' ' + fromUS + rowNode.data.units);
                qty = qty.to(toUS + convert_to.value);
                if(qty != null){
                    let unit = qty.toString().split(' ')[1].split('-')[0];
                    if (unit == 'US'){
                        unit = qty.toString().split(' ')[1].split('-')[1];
                    }
                    let quantity = roundQuantity(qty.toString().split(' ')[0])
                    rowNode.setDataValue('quantity', quantity);
                    rowNode.setDataValue('units', unit);
                    rowNode.setDataValue('unscaled', quantity / rowNode.data.scale);
                }
            }
            catch{
            }
        }
    })
}

export function onConvertSelectedRows() {
    if(convert_to.value == convert_from.value){
        return;
    }
    var selectedRows = gridOptions.api.getSelectedNodes();
    var toUS = '';
    if(convert_to.value.endsWith("(US)")){
        toUS = 'US-';
    }
    var fromUS = '';
    var US = '';
    if(convert_from.value.endsWith("(US)")){
        US = ' (US)';
        fromUS = 'US-';
    }
    for(let i = 0; i < selectedRows.length; i++) {
        var rowNode = selectedRows[i];
        if(rowNode.data.units + US == convert_from.value && !isNaN(rowNode.data.quantity) && rowNode.data.quantity != ''){
            try{
                let qty = Qty.parse(rowNode.data.quantity + ' ' + fromUS + rowNode.data.units);
                qty = qty.to(toUS + convert_to.value);
                if(qty != null){
                    let unit = qty.toString().split(' ')[1].split('-')[0];
                    if (unit == 'US'){
                        unit = qty.toString().split(' ')[1].split('-')[1];
                    }
                    let quantity = roundQuantity(qty.toString().split(' ')[0])
                    rowNode.setDataValue('quantity', quantity);
                    rowNode.setDataValue('units', unit);
                    rowNode.setDataValue('unscaled', quantity / rowNode.data.scale);
                }
            }
            catch{
            }
        }
    }
}
let count = 0;
function onCellValueChanged(event) {
    if(event == 'delete' || event.column.colId == 'ingredient' || event.column.colId == 'units' || event.column.colId == 'quantity'){
        //console.log(count);
        //count++;
        while(scale_ingredient.length > 0){
            scale_ingredient.remove(scale_ingredient[0]);
        }
        while(convert_from.length > 0){
            convert_from.remove(convert_from[0]);
        }
        while(convert_to.length > 0){
            convert_to.remove(convert_to[0]);
        }
        var option = document.createElement("option");
        option.text = "Select Ingredient...";
        scale_ingredient.add(option);
        var option2 = document.createElement("option");
        option2.text = "Convert From...";
        convert_from.add(option2);
        var option3 = document.createElement("option");
        option3.text = "Convert to...";
        convert_to.add(option3);

        gridOptions.api.forEachNode((rowNode, index) => {
            if(rowNode.data.ingredient.trim().substring(0,1) != '#' && rowNode.data.quantity > 0){
                var option = document.createElement("option");
                option.text = rowNode.data.ingredient;
                scale_ingredient.add(option);
                let duplicate = false;
                for(let i = 0; i < convert_from.length; i++){                                                       //check unit not duplicate
                    if(rowNode.data.units != null && rowNode.data.units.trim() == convert_from[i].value.trim()){
                        duplicate = true;
                    }
                }
                if(!duplicate && rowNode.data.units != null && rowNode.data.units != ""){                           //add unit to convert_from dropdown
                    var option = document.createElement("option");
                    option.text = rowNode.data.units.trim();
                    convert_from.add(option);
                    var us_units = ['cup', 'tbsp', 'tsp', 'pt', 'qt', 'gal', 'floz'];
                    if(us_units.indexOf(option.text) != -1){
                        var option2 = document.createElement("option");
                        option2.text = option.text + ' (US)';
                        convert_from.add(option2);
                    }
                }
            }
        })
    }
}

function onCellEditingStopped(event) {
    if(event.column.colId == 'quantity'){
        event.node.setDataValue('unscaled', event.newValue / event.node.data.scale);
    }
    if(event != 'delete' && event.column.colId == 'units'){
        let qty = Qty.parse(1 + ' ' + event.node.data.units);        //Convert to a Qty and back to standardize unit spelling
        if(qty != null){
            event.node.setDataValue('units', qty.toString().split(' ')[1]);
        }
    }
}

// setup the grid after the page has finished loading
document.addEventListener('DOMContentLoaded', () => {
    const gridDiv = document.querySelector('#myGrid');
    new agGrid.Grid(gridDiv, gridOptions);
    const ingredient_options = [];
    const convert_options = [];
    gridOptions.api.forEachNode((rowNode, index) => {
        if(rowNode.data.ingredient.trim().substring(0,1) != '#'  && rowNode.data.quantity > 0){
            var option = document.createElement("option");
            option.text = rowNode.data.ingredient;
            ingredient_options.push(option);
            let duplicate = false;
            for(let i = 0; i < convert_options.length; i++){                                                       //check unit not duplicate
                if(rowNode.data.units != null && rowNode.data.units.trim() == convert_options[i].value.trim()){
                    duplicate = true;
                }
            }
            if(!duplicate && rowNode.data.units != null && rowNode.data.units != ""){                           //add unit to convert_from dropdown
                var option = document.createElement("option");
                option.text = rowNode.data.units.trim();
                convert_options.push(option);
                var us_units = ['cup', 'tbsp', 'tsp', 'pt', 'qt', 'gal', 'floz'];
                if(us_units.indexOf(option.text) != -1){
                    var option2 = document.createElement("option");
                    option2.text = option.text + ' (US)';
                    convert_options.push(option2);
                }
            }
        }
    });
    var option = document.createElement("option");
    option.text = "Select Ingredient...";
    var option2 = document.createElement("option");
    option2.text = "Convert From...";
    var option3 = document.createElement("option");
    option3.text = "Convert to...";
    scale_ingredient.add(option);
    convert_from.add(option2);
    convert_to.add(option3);
    for(let i = 0; i < convert_options.length; i++){
        convert_from.add(convert_options[i]);
    }
    for(let i = 0; i < ingredient_options.length; i++){
        scale_ingredient.add(ingredient_options[i]);
    }
    scale.value = "";
});

function compareOptions(a, b) {                             //use in sort() to compare options [NOT USING]
    // Use toUpperCase() to ignore character casing
    const optionA = a.text.toUpperCase();
    const optionB = b.text.toUpperCase();

    let comparison = 0;
    if (optionA > optionB) {
    comparison = 1;
    } else if (optionA < optionB) {
    comparison = -1;
    }
    return comparison;
}

function unicodeToChar(text) {
   return text.replace(/\\u[\dA-F]{4}/gi,
          function (match) {
            let code = parseInt(match.replace(/\\u/g, ''), 16);
            if (code >= 9632 && code <= 9727){                          //if character is geometric shape (incl checkboxes)
                return '';
            }
            else {
                return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
            }
          });
}