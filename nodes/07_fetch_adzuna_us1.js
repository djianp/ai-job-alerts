// Node: Fetch Adzuna US-1 (companies 1–10, US only)
//
// Searches Adzuna for PM-adjacent roles at big tech companies that don't
// expose a public ATS API. Queries by company name with what_or=product+growth+cpo.
//
// Split into US-1, US-2, US-3, and GB to stay within the 60s node timeout.
// Companies are fetched in parallel (Promise.allSettled) to handle slow API
// responses (~3-6s each). Each company fetches up to 2 pages (100 results).

const atsData = $input.first().json;
const adzunaCompanies = $('Company List').first().json.adzuna;

const allJobs = [...atsData.jobs];
const errors = [...atsData.errors];
const prevJobCount = allJobs.length;
const prevTotalFetched = atsData.total_fetched;

const ADZUNA_APP_ID = 'YOUR_ADZUNA_APP_ID';   // replace with your app ID
const ADZUNA_APP_KEY = 'YOUR_ADZUNA_APP_KEY'; // replace with your app key

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

const fetchWithRetry = async (company) => {
  const result = await fetchCompany(company);
  if (result.error && result.error.includes('429')) {
    await new Promise(r => setTimeout(r, 2000));
    return await fetchCompany(company);
  }
  return result;
};

const STAGGER_MS = 750;
const companies = adzunaCompanies.slice(0, 10);
const results = await Promise.allSettled(
  companies.map((c, i) =>
    new Promise(resolve => setTimeout(resolve, i * STAGGER_MS))
      .then(() => fetchWithRetry(c))
  )
);

for (const result of results) {
  if (result.status === 'fulfilled') {
    allJobs.push(...result.value.jobs);
    if (result.value.error) errors.push(result.value.error);
    if (result.value.warn) errors.push(result.value.warn);
  }
}

return [{ json: { total_fetched: prevTotalFetched + (allJobs.length - prevJobCount), errors, jobs: allJobs } }];
