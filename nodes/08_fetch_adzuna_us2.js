// Node: Fetch Adzuna US-2 (companies 11–20, US only)
//
// Continues the Adzuna US fetch for companies 11–20.
// Same parallel pattern as US-1; split to stay within the 60s node timeout.

const atsData = $input.first().json;
const adzunaCompanies = $('Company List').first().json.adzuna;

const allJobs = [...atsData.jobs];
const errors = [...atsData.errors];
const prevJobCount = allJobs.length;
const prevTotalFetched = atsData.total_fetched;

const ADZUNA_APP_ID = 'YOUR_ADZUNA_APP_ID';
const ADZUNA_APP_KEY = 'YOUR_ADZUNA_APP_KEY';

const fetchCompany = async (company) => {
  const displayName = company.displayName || company.name;
  const jobs = [];
  let warn = null;
  try {
    const baseParams = `app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what_or=product+growth+cpo&company=${encodeURIComponent(company.name)}&results_per_page=50&sort_by=date`;
    const url1 = `https://api.adzuna.com/v1/api/jobs/us/search/1?${baseParams}`;
    const response1 = await this.helpers.httpRequest({ method: 'GET', url: url1, timeout: 10000 });

    if (response1 && response1.results) {
      for (const job of response1.results) {
        jobs.push({
          job_id: `az_${job.id}`,
          ats: 'adzuna',
          company: displayName,
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
        const url2 = `https://api.adzuna.com/v1/api/jobs/us/search/2?${baseParams}`;
        const response2 = await this.helpers.httpRequest({ method: 'GET', url: url2, timeout: 10000 });
        if (response2 && response2.results) {
          for (const job of response2.results) {
            jobs.push({
              job_id: `az_${job.id}`,
              ats: 'adzuna',
              company: displayName,
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
          warn = `WARN: Adzuna/${displayName}/US: ${totalCount} total results, only first 100 fetched`;
        }
      }
    }
    return { jobs, error: null, warn };
  } catch (err) {
    return { jobs, error: `Adzuna/${displayName}/US: ${err.message}`, warn };
  }
};

const companies = adzunaCompanies.slice(10, 20);
const results = await Promise.allSettled(companies.map(c => fetchCompany(c)));

for (const result of results) {
  if (result.status === 'fulfilled') {
    allJobs.push(...result.value.jobs);
    if (result.value.error) errors.push(result.value.error);
    if (result.value.warn) errors.push(result.value.warn);
  }
}

return [{ json: { total_fetched: prevTotalFetched + (allJobs.length - prevJobCount), errors, jobs: allJobs } }];
