// Node: Fetch Adzuna GB (all 33 companies, GB only)
//
// Repeats the Adzuna search for the GB market across all 33 companies.
// Separated from the US pass because running both US + GB in a single node
// would exceed the 60s timeout.

const atsData = $input.first().json;
const adzunaCompanies = $('Company List').first().json.adzuna;

const allJobs = [...atsData.jobs];
const errors = [...atsData.errors];
const prevJobCount = allJobs.length;
const prevTotalFetched = atsData.total_fetched;

const ADZUNA_APP_ID = 'YOUR_ADZUNA_APP_ID';
const ADZUNA_APP_KEY = 'YOUR_ADZUNA_APP_KEY';

for (const company of adzunaCompanies) {
  try {
    const baseParams = `app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what_or=product+growth+cpo&company=${encodeURIComponent(company.name)}&results_per_page=50&sort_by=date`;
    const url1 = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${baseParams}`;
    const response1 = await this.helpers.httpRequest({ method: 'GET', url: url1, timeout: 10000 });

    if (response1 && response1.results) {
      for (const job of response1.results) {
        allJobs.push({
          job_id: `az_${job.id}`,
          ats: 'adzuna',
          company: company.name,
          title: job.title || '',
          location: job.location ? job.location.display_name : 'Unknown',
          url: job.redirect_url || '',
          date_posted: job.created || '',
          description: (job.description || '').substring(0, 1000),
          departments: job.category ? job.category.label : '',
          workplace_type: job.contract_time || '',
        });
      }

      const totalCount = response1.count || 0;
      if (totalCount > 50) {
        const url2 = `https://api.adzuna.com/v1/api/jobs/gb/search/2?${baseParams}`;
        const response2 = await this.helpers.httpRequest({ method: 'GET', url: url2, timeout: 10000 });
        if (response2 && response2.results) {
          for (const job of response2.results) {
            allJobs.push({
              job_id: `az_${job.id}`,
              ats: 'adzuna',
              company: company.name,
              title: job.title || '',
              location: job.location ? job.location.display_name : 'Unknown',
              url: job.redirect_url || '',
              date_posted: job.created || '',
              description: (job.description || '').substring(0, 1000),
              departments: job.category ? job.category.label : '',
              workplace_type: job.contract_time || '',
            });
          }
        }
        if (totalCount > 100) {
          errors.push(`WARN: Adzuna/${company.name}/GB: ${totalCount} total results, only first 100 fetched`);
        }
      }
    }
  } catch (err) {
    errors.push(`Adzuna/${company.name}/gb: ${err.message}`);
  }
}

const newFetched = allJobs.length - prevJobCount;
return [{ json: { total_fetched: prevTotalFetched + newFetched, errors, jobs: allJobs } }];
