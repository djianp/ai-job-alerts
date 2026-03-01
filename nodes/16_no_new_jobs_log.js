// Node: No New Jobs (Log)
//
// Runs on the FALSE branch of the "Any New Jobs?" IF node.
// Sends a daily heartbeat to Slack confirming the scan completed cleanly.
// This prevents silent failures — absence of a daily message is itself a signal.
//
// Errors are split into 3 categories (same as Format Slack Alert):
//   ⚠️  real fetch errors (actionable)
//   ℹ️  Adzuna taxonomy gaps (structural, not fixable)
//   📊  Adzuna result caps (>100 results, only first 100 fetched)

const input = $('Compare & Detect New').first().json;
const summary = input.summary;

const date = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

const realErrors = (summary.errors || []).filter(e => !e.includes('status code 400') && !e.startsWith('WARN:'));
const taxonomyGaps = (summary.errors || []).filter(e => e.includes('status code 400'));
const overflowWarns = (summary.errors || []).filter(e => e.startsWith('WARN:'));

let errorNote = '';
if (realErrors.length > 0) {
  errorNote += `\n⚠️ _${realErrors.length} fetch error(s) — check workflow logs._`;
}
if (taxonomyGaps.length > 0) {
  const gaps = taxonomyGaps.map(e => e.replace('Adzuna/', '').replace(': Request failed with status code 400', ''));
  errorNote += `\nℹ️ _${taxonomyGaps.length} Adzuna taxonomy gap(s): ${gaps.join(', ')}_`;
}
if (overflowWarns.length > 0) {
  const warns = overflowWarns.map(e => e.replace('WARN: Adzuna/', '').replace(/ total results, only first 100 fetched/, ' (>100, capped)'));
  errorNote += `\n📊 _${overflowWarns.length} Adzuna result cap(s): ${warns.join(', ')}_`;
}

return [{
  json: {
    status: 'No new jobs found',
    total_scanned: summary.total_fetched,
    total_matched: summary.total_matched,
    already_in_sheet: summary.existing_in_sheet,
    errors: summary.errors,
    text: `✅ *Daily scan complete* — ${date}\n${summary.total_fetched.toLocaleString()} jobs scanned across 96 companies | ${summary.total_matched} PM roles matched | *0 new roles found*\n_${summary.existing_in_sheet} previously tracked jobs already logged._${errorNote}`,
  }
}];
