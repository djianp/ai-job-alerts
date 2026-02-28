// Node: Fetch Ashby Batch 2 (companies 11–21)
//
// Completes the Ashby fetch. Split from Batch 1 to stay within the 60s node timeout.

const batch1Data = $input.first().json;
const ashby = $('Company List').first().json.ashby;

const allJobs = [...batch1Data.jobs];
const errors = [...batch1Data.errors];

for (const company of ashby.slice(10)) {
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
