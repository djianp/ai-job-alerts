// Node: Split into Rows
//
// Converts the sheet_rows array (one object with N rows) into N separate items,
// one per new job. n8n's "Append to Sheet" node expects one item per row.

const input = $input.first().json;
const rows = input.sheet_rows;
return rows.map(row => ({ json: row }));
