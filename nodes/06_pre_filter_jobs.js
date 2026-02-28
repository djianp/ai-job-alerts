// Node: Pre-Filter Jobs
//
// Memory firewall between the ATS fetch phase and the Adzuna fetch phase.
//
// At this point ~10,000 jobs have been accumulated. The Adzuna nodes will
// each receive this payload as input. Without a pre-filter, the accumulated
// payload would exceed n8n Cloud's ~38MB memory limit by the end of the pipeline.
//
// This filter is intentionally permissive (title-only, broad keywords) to
// avoid false negatives. Full filtering runs in "Filter PM Roles" downstream.
//
// Result: ~10,000 jobs → ~500 PM candidates before Adzuna fetch begins.

const input = $input.first().json;
const jobs = input.jobs;

const preFiltered = jobs.filter(job => {
  const title = job.title.toLowerCase();
  return (
    title.includes('product') ||
    title.includes('cpo') ||
    /\bpm\b/.test(title) ||
    title.includes('gpm')
  );
});

return [{
  json: {
    total_fetched: input.total_fetched,
    pre_filter_in: jobs.length,
    pre_filter_out: preFiltered.length,
    errors: input.errors,
    jobs: preFiltered,
  }
}];
