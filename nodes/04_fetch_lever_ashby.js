// Node: Fetch Lever + Ashby Batch 1
//
// Accumulates all Greenhouse jobs from input, then adds:
//   - Lever (2 companies, ~2s)
//   - Ashby Batch 1 (companies 1–10, ~18s)

const ghData = $input.first().json;
const input = $('Company List').first().json;

const allJobs = [...ghData.jobs];
const errors = [...ghData.errors];

// --- LEVER ---
for (const company of input.lever) {
  try {
    const url = `https://api.lever.co/v0/postings/${company.token}?mode=json`;
    const response = await this.helpers.httpRequest({ method: 'GET', url, timeout: 15000 });

    if (response && Array.isArray(response)) {
      for (const job of response) {
        const loc = job.categories ? job.categories.location : 'Unknown';
        allJobs.push({
          job_id: `lv_${company.token}_${job.id}`,
          ats: 'lever',
          company: company.name,
          title: job.text || '',
          location: loc || 'Unknown',
          url: job.hostedUrl || job.applyUrl || '',
          date_posted: job.createdAt ? new Date(job.createdAt).toISOString() : '',
          description: (job.descriptionPlain || job.description || '').substring(0, 1000),
          departments: job.categories ? (job.categories.team || job.categories.department || '') : '',
          workplace_type: job.workplaceType || '',
        });
      }
    }
  } catch (err) {
    errors.push(`Lever/${company.name}: ${err.message}`);
  }
}

// --- ASHBY Batch 1 (companies 1–10) ---
for (const company of input.ashby.slice(0, 10)) {
  try {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${company.token}?includeCompensation=true`;
    const response = await this.helpers.httpRequest({ method: 'GET', url, timeout: 15000 });

    if (response && response.jobs) {
      for (const job of response.jobs) {
        if (!job.isListed) continue;
        allJobs.push({
          job_id: `ab_${company.token}_${job.id || job.title.replace(/\s+/g, '_')}`,
          ats: 'ashby',
          company: company.name,
          title: job.title || '',
          location: job.location || 'Unknown',
          url: job.jobUrl || '',
          date_posted: job.publishedAt || '',
          description: (job.descriptionPlain || '').substring(0, 1000),
          departments: [job.department, job.team].filter(Boolean).join(', '),
          workplace_type: job.workplaceType || '',
          compensation: job.compensation ? job.compensation.compensationTierSummary : '',
        });
      }
    }
  } catch (err) {
    errors.push(`Ashby/${company.name}: ${err.message}`);
  }
}

return [{ json: { total_fetched: allJobs.length, errors, jobs: allJobs } }];
