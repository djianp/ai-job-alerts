// Node: Filter PM Roles
//
// Full keyword-matching pass over all fetched jobs (~13,000+).
//
// A job matches if:
//   (isProductRole OR isPMAbbrev) AND (isSenior OR hasAISignal)
//
// Two description-check paths:
//   - GH Batch 1 + Adzuna: use pre-computed ai_in_desc boolean (no description stored)
//   - GH Batch 2 + Lever + Ashby: scan the description field directly

const input = $input.first().json;
const jobs = input.jobs;
const matched = [];

for (const job of jobs) {
  const title = job.title.toLowerCase();
  const desc = (job.description || '').toLowerCase();

  const PRODUCT_KEYWORDS = [
    'product manager', 'product management', 'product lead',
    'product director', 'product owner', 'head of product',
    'vp product', 'vp of product', 'vp, product',
    'director of product', 'director, product',
    'chief product', 'cpo',
  ];
  const isProductRole = PRODUCT_KEYWORDS.some(k => title.includes(k));

  const pmPattern = /\b(ai|ml|senior|sr|staff|principal|lead|group|head)\s+pm\b/;
  const isPMAbbrev = pmPattern.test(title);

  const SENIOR_KEYWORDS = [
    'head of', 'vp ', 'vp,', 'vice president',
    'director', 'senior director', 'sr. director',
    'staff ', 'principal', 'product lead', 'group p',
    'gpm', 'chief',
  ];
  const isSenior = SENIOR_KEYWORDS.some(k => title.includes(k));

  const AI_KEYWORDS = [
    'ai ', 'ai,', 'ai-', '/ai', 'a.i.',
    'ml ', 'ml,', 'ml-', '/ml',
    'machine learning', 'llm', 'nlp',
    'genai', 'gen ai', 'generative ai', 'generative',
    'agents', 'agentic', 'rag',
    'fine-tuning', 'fine tuning', 'finetuning',
    'computer vision', 'deep learning', 'neural',
    'foundation model', 'large language',
    'artificial intelligence', 'chatbot', 'copilot',
    'prompt', 'embedding', 'vector', 'transformer',
  ];
  const aiInTitle = AI_KEYWORDS.some(k => title.includes(k));
  const aiInDesc = (job.ai_in_desc || false) || AI_KEYWORDS.some(k => desc.includes(k));
  const hasAISignal = aiInTitle || aiInDesc;

  const aiKeywordsFound = AI_KEYWORDS.filter(k =>
    title.includes(k) || desc.includes(k)
  ).map(k => k.trim());

  const isMatch = (isProductRole || isPMAbbrev) && (isSenior || hasAISignal);

  if (isMatch) {
    matched.push({
      ...job,
      is_senior: isSenior,
      has_ai_signal: hasAISignal,
      ai_in_title: aiInTitle,
      ai_keywords_found: [...new Set(aiKeywordsFound)].join(', '),
    });
  }
}

return [{
  json: {
    total_fetched: input.total_fetched,
    total_matched: matched.length,
    errors: input.errors,
    jobs: matched,
  }
}];
