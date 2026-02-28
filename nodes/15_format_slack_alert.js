// Node: Format Slack Alert
//
// Builds the Slack message for new P1/P2 roles.
// Only P1 and P2 jobs appear in the alert — P3 gets a brief mention in the footer.
// Returns an empty text string if there are no P1/P2 jobs (prevents a redundant post).

const input = $('Compare & Detect New').first().json;
const summary = input.summary;
const alertJobs = input.new_p1_p2;

// P3-only case: brief summary, no job listings
if (alertJobs.length === 0) {
  if (summary.new_p3 > 0) {
    return [{
      json: {
        text: `📊 *Job Alert Summary* — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\nNo new P1/P2 roles today, but ${summary.new_p3} new P3 role(s) logged to the sheet.\n\n_${summary.total_fetched.toLocaleString()} jobs scanned across 97 companies._`
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

if (summary.errors && summary.errors.length > 0) {
  message += `\n⚠️ _${summary.errors.length} fetch error(s): ${summary.errors.slice(0, 3).join(', ')}_`;
}

return [{ json: { text: message } }];
