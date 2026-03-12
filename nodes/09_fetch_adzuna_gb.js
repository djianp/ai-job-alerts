// Node: Fetch Adzuna GB (all 30 companies, GB only)
//
// Queries all 30 Adzuna companies in the GB market.
// Companies are fetched in parallel (Promise.allSettled) to handle slow API
// responses (~3-6s each). Pre-computes ai_in_desc and domain_score_from_desc,
// discards description text to save memory.

const usData = $input.first().json;
const adzunaCompanies = $('Company List').first().json.adzuna;

const allJobs = [...usData.jobs];
const errors = [...usData.errors];
const prevJobCount = allJobs.length;
const prevTotalFetched = usData.total_fetched || 0;

const ADZUNA_APP_ID = 'YOUR_ADZUNA_APP_ID';
const ADZUNA_APP_KEY = 'YOUR_ADZUNA_APP_KEY';

const AI_KW = ['ai ','ai,','ai-','/ai','a.i.','ml ','ml,','ml-','/ml','machine learning','llm','nlp','genai','gen ai','generative ai','generative','agents','agentic','rag','fine-tuning','fine tuning','finetuning','computer vision','deep learning','neural','foundation model','large language','artificial intelligence','chatbot','copilot','prompt','embedding','vector','transformer'];
const DOMAIN_KW = ['growth','plg','product-led','onboarding','activation','fintech','payments','lending','financial','saas','b2b','enterprise','platform','mobile','consumer','gaming','experimentation','a/b test','conversion','startup','0 to 1','zero to one','multilingual','international','global','stanford','mba'];

const fetchCompany = async (company) => {
  const displayName = company.displayName || company.name;
  const jobs = [];
  let warn = null;
  try {
    const baseParams = `app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what_or=product+growth+cpo&company=${encodeURIComponent(company.name)}&results_per_page=50&sort_by=date`;
    const url1 = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${baseParams}`;
    const response1 = await this.helpers.httpRequest({ method: 'GET', url: url1, timeout: 10000 });

    if (response1 && response1.results) {
      for (const job of response1.results) {
        const desc = (job.description || '').toLowerCase();
        jobs.push({
          job_id: `az_${job.id}`,
          ats: 'adzuna',
          company: displayName,
          title: job.title || '',
          location: job.location ? job.location.display_name : 'Unknown',
          url: job.redirect_url || '',
          date_posted: job.created || '',
          departments: job.category ? job.category.label : '',
          workplace_type: job.contract_time || '',
          ai_in_desc: AI_KW.some(k => desc.includes(k)),
          domain_score_from_desc: Math.min(DOMAIN_KW.filter(k => desc.includes(k)).length * 3, 20),
        });
      }
      const totalCount = response1.count || 0;
      if (totalCount > 50) {
        const url2 = `https://api.adzuna.com/v1/api/jobs/gb/search/2?${baseParams}`;
        const response2 = await this.helpers.httpRequest({ method: 'GET', url: url2, timeout: 10000 });
        if (response2 && response2.results) {
          for (const job of response2.results) {
            const desc = (job.description || '').toLowerCase();
            jobs.push({
              job_id: `az_${job.id}`,
              ats: 'adzuna',
              company: displayName,
              title: job.title || '',
              location: job.location ? job.location.display_name : 'Unknown',
              url: job.redirect_url || '',
              date_posted: job.created || '',
              departments: job.category ? job.category.label : '',
              workplace_type: job.contract_time || '',
              ai_in_desc: AI_KW.some(k => desc.includes(k)),
              domain_score_from_desc: Math.min(DOMAIN_KW.filter(k => desc.includes(k)).length * 3, 20),
            });
          }
        }
        if (totalCount > 100) {
          warn = `WARN: Adzuna/${displayName}/GB: ${totalCount} total results, only first 100 fetched`;
        }
      }
    }
    return { jobs, error: null, warn };
  } catch (err) {
    return { jobs, error: `Adzuna/${displayName}/GB: ${err.message}`, warn };
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
const results = await Promise.allSettled(
  adzunaCompanies.map((c, i) =>
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
