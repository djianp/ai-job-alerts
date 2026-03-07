// Node: Score Priority & Match
//
// Assigns each matched job a priority (P1/P2/P3) based on location,
// then computes a match_score (50–100) based on seniority + AI signal + domain keywords.
//
// Priority logic reflects a hiring focus on EU/remote-EU roles:
//   P1 = Remote/Hybrid in EU/UK/Israel, or France-based (any mode)
//   P2 = Remote/Hybrid in US, or unlocated Remote (may be EU-eligible)
//   P3 = Everything else (on-site US, unclear location, etc.)

const input = $input.first().json;
const jobs = input.jobs;

const EU_COUNTRIES = [
  'france', 'paris', 'germany', 'berlin', 'munich', 'hamburg',
  'uk', 'united kingdom', 'london', 'england', 'scotland',
  'netherlands', 'amsterdam', 'ireland', 'dublin',
  'spain', 'madrid', 'barcelona', 'italy', 'milan', 'rome',
  'sweden', 'stockholm', 'denmark', 'copenhagen',
  'norway', 'oslo', 'finland', 'helsinki',
  'portugal', 'lisbon', 'belgium', 'brussels',
  'austria', 'vienna', 'switzerland', 'zurich', 'geneva',
  'poland', 'warsaw', 'czech', 'prague',
  'israel', 'tel aviv', 'europe', 'emea',
];

const FRANCE_LOCATIONS = [
  'france', 'paris', 'lyon', 'marseille', 'toulouse',
  'nantes', 'bordeaux', 'lille', 'neuilly',
];

const US_EAST_COAST = [
  'new york', 'nyc', 'boston', 'washington', 'dc', 'philadelphia',
  'miami', 'atlanta', 'charlotte', 'raleigh', 'baltimore',
  'east coast', 'pittsburgh',
];

const REMOTE_KEYWORDS = ['remote', 'anywhere', 'distributed', 'work from home', 'wfh', 'worldwide', 'global', 'open location'];
const HYBRID_KEYWORDS = ['hybrid', 'flexible'];

for (const job of jobs) {
  const loc = (job.location || '').toLowerCase();
  const wt = (job.workplace_type || '').toLowerCase();
  const combined = `${loc} ${wt}`;

  const isRemote = REMOTE_KEYWORDS.some(k => combined.includes(k));
  const isHybrid = HYBRID_KEYWORDS.some(k => combined.includes(k));
  const remotePolicy = isRemote ? 'Remote' : isHybrid ? 'Hybrid' : 'On-site';

  const isEU = EU_COUNTRIES.some(k => loc.includes(k));
  const isFrance = FRANCE_LOCATIONS.some(k => loc.includes(k));
  const isUSEast = US_EAST_COAST.some(k => loc.includes(k));
  const isUS = loc.includes('united states') || loc.includes('us') ||
               loc.includes('usa') || loc.includes('san francisco') ||
               loc.includes('california') || loc.includes('seattle') ||
               isUSEast;

  let priority, priorityReason;

  if ((isRemote || isHybrid) && isEU) {
    priority = 'P1';
    priorityReason = `${remotePolicy}, EU/UK/Israel`;
  } else if (isFrance) {
    priority = 'P1';
    priorityReason = `France-based (${remotePolicy})`;
  } else if ((isRemote || isHybrid) && isUS) {
    priority = 'P2';
    priorityReason = isUSEast ? `${remotePolicy}, US East Coast` : `${remotePolicy}, US`;
  } else if (isRemote && !isUS && !isEU) {
    priority = 'P2';
    priorityReason = 'Remote (location unspecified — may be EU-eligible)';
  } else {
    priority = 'P3';
    priorityReason = `${remotePolicy}, ${loc || 'location unclear'}`;
  }

  // Match score (50–100)
  let matchScore = 50;
  const title = job.title.toLowerCase();

  if (title.includes('head of') || title.includes('vp') || title.includes('director'))
    matchScore += 15;
  if (title.includes('staff') || title.includes('principal') || title.includes('lead'))
    matchScore += 10;
  if (job.ai_in_title) matchScore += 10;
  if (job.has_ai_signal) matchScore += 5;

  const desc = (job.description || '').toLowerCase();
  const domainKeywords = [
    'growth', 'plg', 'product-led', 'onboarding', 'activation',
    'fintech', 'payments', 'lending', 'financial',
    'saas', 'b2b', 'enterprise', 'platform',
    'mobile', 'consumer', 'gaming',
    'experimentation', 'a/b test', 'conversion',
    'startup', '0 to 1', 'zero to one',
    'multilingual', 'international', 'global',
    'stanford', 'mba',
  ];
  const domainMatches = domainKeywords.filter(k => desc.includes(k));
  matchScore += Math.min(domainMatches.length * 3, 20);
  matchScore = Math.min(matchScore, 100);

  job.priority = priority;
  job.priority_reason = priorityReason;
  job.remote_policy = remotePolicy;
  job.match_score = matchScore;
}

const sorted = jobs.sort((a, b) => {
  const pOrder = { P1: 0, P2: 1, P3: 2 };
  if (pOrder[a.priority] !== pOrder[b.priority])
    return pOrder[a.priority] - pOrder[b.priority];
  return b.match_score - a.match_score;
});

return [{
  json: {
    total_fetched: input.total_fetched,
    total_matched: input.total_matched,
    total_p1: sorted.filter(j => j.priority === 'P1').length,
    total_p2: sorted.filter(j => j.priority === 'P2').length,
    total_p3: sorted.filter(j => j.priority === 'P3').length,
    errors: input.errors,
    jobs: sorted,
  }
}];
