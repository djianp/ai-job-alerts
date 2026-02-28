// Node: No New Jobs (Log)
//
// Runs on the FALSE branch of the "Any New Jobs?" IF node.
// Sends a daily heartbeat to Slack confirming the scan completed cleanly.
// This prevents silent failures — absence of a daily message is itself a signal.

const input = $('Compare & Detect New').first().json;
const summary = input.summary;

const date = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

const errorNote = summary.errors && summary.errors.length > 0
  ? `\n⚠️ _${summary.errors.length} fetch error(s) — check workflow logs._`
  : '';

return [{
  json: {
    status: 'No new jobs found',
    total_scanned: summary.total_fetched,
    total_matched: summary.total_matched,
    already_in_sheet: summary.existing_in_sheet,
    errors: summary.errors,
    text: `✅ *Daily scan complete* — ${date}\n${summary.total_fetched.toLocaleString()} jobs scanned across 97 companies | ${summary.total_matched} PM roles matched | *0 new roles found*\n_${summary.existing_in_sheet} previously tracked jobs already logged._${errorNote}`,
  }
}];
