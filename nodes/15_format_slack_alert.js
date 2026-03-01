// Node: Format Slack Alert
//
// Builds the Slack message for new P1/P2 roles.
// Only P1 and P2 jobs appear individually — P3 gets a brief mention in the footer.
// Returns an empty text string if there are no P1/P2/P3 jobs (prevents a redundant post).
//
// Errors are split into 3 categories in the footer:
//   ⚠️  real fetch errors — timeouts, 5xx, network issues (actionable)
//   ℹ️  Adzuna taxonomy gaps — status code 400, company not in Adzuna's index (not fixable)
//   📊  Adzuna result caps — WARN: entries, >100 results, only first 100 fetched

const input = $('Compare & Detect New').first().json;
const summary = input.summary;
const alertJobs = input.new_p1_p2;

const realErrors = (summary.errors || []).filter(e => !e.includes('status code 400') && !e.startsWith('WARN:'));
const taxonomyGaps = (summary.errors || []).filter(e => e.includes('status code 400'));
const overflowWarns = (summary.errors || []).filter(e => e.startsWith('WARN:'));

const buildErrorFooter = () => {
  let note = '';
  if (realErrors.length > 0) {
    note += `\n⚠️ _${realErrors.length} fetch error(s): ${realErrors.join(', ')}_`;
  }
  if (taxonomyGaps.length > 0) {
    const gaps = taxonomyGaps.map(e => e.replace('Adzuna/', '').replace(': Request failed with status code 400', ''));
    note += `\nℹ️ _${taxonomyGaps.length} Adzuna taxonomy gap(s) — company not in Adzuna's index for that country: ${gaps.join(', ')}_`;
  }
  if (overflowWarns.length > 0) {
    const warns = overflowWarns.map(e => e.replace('WARN: Adzuna/', '').replace(/ total results, only first 100 fetched/, ' (>100, capped)'));
    note += `\n📊 _${overflowWarns.length} Adzuna result cap(s): ${warns.join(', ')}_`;
  }
  return note;
};

// P3-only case: brief summary, no job listings
if (alertJobs.length === 0) {
  if (summary.new_p3 > 0) {
    return [{
      json: {
        text: `📊 *Job Alert Summary* — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\nNo new P1/P2 roles today, but ${summary.new_p3} new P3 role(s) logged to the sheet.\n\n_${summary.total_fetched.toLocaleString()} jobs scanned across 96 companies._${buildErrorFooter()}`
      }
    }];
  }
  return [{ json: { text: '' } }];
}

// P1/P2 alert
let message = `🚨 *NEW JOB ALERT* — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
message += `Found *${alertJobs.length}* new P1/P2 role(s)!\n\n`;

for (const job of alertJobs) {
  const priorityEmoji = job.priority === 'P1' ? '🔴' : '🟡';
  message += `${priorityEmoji} *${job.priority}* — *${job.company}*\n`;
  message += `📋 ${job.title}\n`;
  message += `📍 ${job.location} (${job.remote_policy})\n`;
  message += `🎯 Match: ${job.match_score}%`;
  if (job.ai_keywords_found) {
    message += ` | AI: ${job.ai_keywords_found}`;
  }
  message += `\n`;
  if (job.date_posted) {
    const posted = new Date(job.date_posted).toLocaleDateString('en-GB');
    message += `📅 Posted: ${posted}\n`;
  }
  message += `🔗 <${job.url}|Apply here>\n\n`;
}

message += `---\n`;
message += `📊 _${summary.total_fetched.toLocaleString()} jobs scanned | ${summary.total_matched} PM roles matched | ${summary.new_jobs_found} new (${summary.new_p1} P1, ${summary.new_p2} P2, ${summary.new_p3} P3)_`;
message += buildErrorFooter();

return [{ json: { text: message } }];
