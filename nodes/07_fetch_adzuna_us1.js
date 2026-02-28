// Node: Fetch Adzuna US-1 (companies 1–17, US only)
//
// Searches Adzuna for PM-adjacent roles at big tech companies that don't
// expose a public ATS API. Queries by company name with what_or=product+growth+cpo.
//
// Split into US-1, US-2, and GB to stay within the 60s node timeout.
// Each company fetches up to 2 pages (100 results). A WARN is logged if
// the company has >100 total results (some roles may be missed).

const atsData = $input.first().json;
const adzunaCompanies = $('Company List').first().json.adzuna;

const allJobs = [...atsData.jobs];
const errors = [...atsData.errors];
const prevJobCount = allJobs.length;
const prevTotalFetched = atsData.total_fetched;

const ADZUNA_APP_ID = 'YOUR_ADZUNA_APP_ID';   // replace with your app ID
const ADZUNA_APP_KEY = 'YOUR_ADZUNA_APP_KEY'; // replace with your app key

for (const company of adzunaCompanies.slice(0, 17)) {
  try {
    const baseParams = `app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what_or=product+growth+cpo&company=${encodeURIComponent(company.name)}&results_per_page=50&sort_by=date`;
    const url1 = `https://api.adzuna.com/v1/api/jobs/us/search/1?${baseParams}`;
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
        const url2 = `https://api.adzuna.com/v1/api/jobs/us/search/2?${baseParams}`;
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
          errors.push(`WARN: Adzuna/${company.name}/US: ${totalCount} total results, only first 100 fetched`);
        }
      }
    }
  } catch (err) {
    errors.push(`Adzuna/${company.name}/us: ${err.message}`);
  }
}

const newFetched = allJobs.length - prevJobCount;
return [{ json: { total_fetched: prevTotalFetched + newFetched, errors, jobs: allJobs } }];
