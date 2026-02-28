// Node: Fetch GH Batch 2 (Greenhouse companies 21–41)
//
// Accumulates jobs from Batch 1 and fetches the remaining 21 Greenhouse companies.
// Descriptions stored (truncated to 1,000 chars) — ai_in_desc not pre-computed here.
// Filter PM Roles handles both paths: pre-computed flag (Batch 1) vs description scan (Batch 2).

const batch1Data = $input.first().json;
const greenhouse = $('Company List').first().json.greenhouse;

const allJobs = [...batch1Data.jobs];
const errors = [...batch1Data.errors];

for (const company of greenhouse.slice(20)) {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`;
    const response = await this.helpers.httpRequest({ method: 'GET', url, timeout: 15000 });

    if (response && response.jobs) {
      for (const job of response.jobs) {
        allJobs.push({
          job_id: `gh_${company.token}_${job.id}`,
          ats: 'greenhouse',
          company: company.name,
          title: job.title || '',
          location: job.location ? job.location.name : 'Unknown',
          url: job.absolute_url || `https://boards.greenhouse.io/${company.token}/jobs/${job.id}`,
          date_posted: job.updated_at || '',
          description: (job.content || '').replace(/<[^>]*>/g, ' ').substring(0, 1000),
          departments: (job.departments || []).map(d => d.name).join(', '),
        });
      }
    }
  } catch (err) {
    errors.push(`Greenhouse/${company.name}: ${err.message}`);
  }
}

return [{ json: { total_fetched: allJobs.length, errors, jobs: allJobs } }];
