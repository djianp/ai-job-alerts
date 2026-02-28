// Node: Sheet Buffer
//
// Sits between "Read Existing Jobs" (Google Sheets) and "Compare & Detect New".
//
// Problem: n8n's Google Sheets node returns 0 items when the sheet is empty.
// In n8n, 0 items from any node stops execution of ALL downstream nodes — the
// pipeline silently halts on first run with an empty sheet.
//
// Solution: inject a dummy {} item so downstream nodes always have something to execute.
// "Compare & Detect New" handles the empty-object case correctly (existingIds stays empty).

const items = $input.all();
return items.length > 0 ? items : [{ json: {} }];
