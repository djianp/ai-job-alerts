// Node: Compare & Detect New
//
// Reads job IDs already logged in Google Sheets (via Sheet Buffer), compares
// against all scored jobs, and outputs only genuinely new roles.
//
// Input flows from "Sheet Buffer" (Google Sheets data).
// Scored jobs are read directly from "Score Priority & Match" via $().
//
// Outputs:
//   summary       — stats for the Slack message footer
//   new_jobs      — all new jobs (used by Split into Rows → Append to Sheet)
//   new_p1_p2     — P1 and P2 jobs only (used by Format Slack Alert)
//   sheet_rows    — pre-formatted rows ready for Google Sheets append

const scoredData = $('Score Priority & Match').first().json;
const allJobs = scoredData.jobs;

const sheetRows = $('Read Existing Jobs').all();
const existingIds = new Set();
for (const row of sheetRows) {
  if (row.json['Job ID']) {
    existingIds.add(row.json['Job ID']);
  }
}

const newJobs = allJobs.filter(job => !existingIds.has(job.job_id));
const newP1 = newJobs.filter(j => j.priority === 'P1');
const newP2 = newJobs.filter(j => j.priority === 'P2');
const newP3 = newJobs.filter(j => j.priority === 'P3');

const now = new Date().toISOString();

const sheetRows_new = newJobs.map(job => ({
  'Job ID': job.job_id,
  'Company': job.company,
  'Title': job.title,
  'Location': job.location,
  'Remote Policy': job.remote_policy,
  'Priority': job.priority,
  'Priority Reason': job.priority_reason,
  'Date First Seen': now,
  'Date Posted': job.date_posted ? new Date(job.date_posted).toISOString().split('T')[0] : 'Unknown',
  'Job URL': job.url,
  'ATS': job.ats,
  'Status': 'New',
  'Match Score': `${job.match_score}%`,
  'AI Keywords': job.ai_keywords_found || '',
  'Department': job.departments || '',
  'Compensation': job.compensation || '',
  'Notes': '',
}));

return [{
  json: {
    summary: {
      total_fetched: scoredData.total_fetched,
      total_matched: scoredData.total_matched,
      existing_in_sheet: existingIds.size,
      new_jobs_found: newJobs.length,
      new_p1: newP1.length,
      new_p2: newP2.length,
      new_p3: newP3.length,
      errors: scoredData.errors,
    },
    new_jobs: newJobs,
    new_p1_p2: [...newP1, ...newP2],
    sheet_rows: sheetRows_new,
  }
}];
