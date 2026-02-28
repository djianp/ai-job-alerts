// Node: Fetch GH Batch 1 (Greenhouse companies 1–20)
//
// Memory optimisation: descriptions are consumed here rather than stored.
// ai_in_desc (boolean) and domain_score_from_desc (int) are pre-computed
// from the raw HTML description, then the description is dropped.
// This keeps per-job payload at ~300 bytes vs ~1,300 bytes with description stored.

const input = $input.first().json;
const allJobs = [];
const errors = [];

const AI_KW = [
  'ai ','ai,','ai-','/ai','a.i.','ml ','ml,','ml-','/ml',
  'machine learning','llm','nlp','genai','gen ai','generative ai','generative',
  'agents','agentic','rag','fine-tuning','fine tuning','finetuning',
  'computer vision','deep learning','neural','foundation model','large language',
  'artificial intelligence','chatbot','copilot','prompt','embedding','vector','transformer',
];

const DOMAIN_KW = [
  'growth','plg','product-led','onboarding','activation',
  'fintech','payments','lending','financial',
  'saas','b2b','enterprise','platform','mobile','consumer','gaming',
  'experimentation','a/b test','conversion',
  'startup','0 to 1','zero to one','multilingual','international','global',
  'stanford','mba',
];

for (const company of input.greenhouse.slice(0, 20)) {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`;
    const response = await this.helpers.httpRequest({ method: 'GET', url, timeout: 15000 });

    if (response && response.jobs) {
      for (const job of response.jobs) {
        const desc = (job.content || '').replace(/<[^>]*>/g, ' ').toLowerCase();
        allJobs.push({
          job_id: `gh_${company.token}_${job.id}`,
          ats: 'greenhouse',
          company: company.name,
          title: job.title || '',
          location: job.location ? job.location.name : 'Unknown',
          url: job.absolute_url || `https://boards.greenhouse.io/${company.token}/jobs/${job.id}`,
          date_posted: job.updated_at || '',
          departments: (job.departments || []).map(d => d.name).join(', '),
          // Pre-computed flags — description not stored
          ai_in_desc: AI_KW.some(k => desc.includes(k)),
          domain_score_from_desc: Math.min(DOMAIN_KW.filter(k => desc.includes(k)).length * 3, 20),
        });
      }
    }
  } catch (err) {
    errors.push(`Greenhouse/${company.name}: ${err.message}`);
  }
}

return [{ json: { total_fetched: allJobs.length, errors, jobs: allJobs } }];
