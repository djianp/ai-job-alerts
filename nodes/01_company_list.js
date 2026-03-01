// Node: Company List
// Outputs 4 arrays used by all downstream fetch nodes.
// Greenhouse, Lever, and Ashby use public ATS APIs (no auth required).
// Adzuna is used for companies without a public ATS.

const GREENHOUSE_COMPANIES = [
  { name: 'Anthropic', token: 'anthropic' },
  { name: 'Scale', token: 'scaleai' },
  { name: 'Databricks', token: 'databricks' },
  { name: 'DoorDash', token: 'doordashusa' },
  { name: 'Stripe', token: 'stripe' },
  { name: 'Coinbase', token: 'coinbase' },
  { name: 'Grammarly', token: 'grammarly' },
  { name: 'HubSpot', token: 'hubspot' },
  { name: 'Moveworks', token: 'moveworks' },
  { name: 'Asana', token: 'asana' },
  { name: 'Brex', token: 'brex' },
  { name: 'Elastic', token: 'elastic' },
  { name: 'Figma', token: 'figma' },
  { name: 'Instacart', token: 'instacart' },
  { name: 'Intercom', token: 'intercom' },
  { name: 'Miro', token: 'realtimeboardglobal' },
  { name: 'Pinterest', token: 'pinterest' },
  { name: 'Robinhood', token: 'robinhood' },
  { name: 'Roblox', token: 'roblox' },
  { name: 'Stability AI', token: 'stabilityai' },
  { name: 'Unity', token: 'unity3d' },
  { name: 'xAI', token: 'xai' },
  { name: 'Airtable', token: 'airtable' },
  { name: 'Cloudflare', token: 'cloudflare' },
  { name: 'DataDog', token: 'datadog' },
  { name: 'Discord', token: 'discord' },
  { name: 'Dropbox', token: 'dropbox' },
  { name: 'Duolingo', token: 'duolingo' },
  { name: 'Epic Games', token: 'epicgames' },
  { name: 'GitLab', token: 'gitlab' },
  { name: 'Glean', token: 'gleanwork' },
  { name: 'MongoDB', token: 'mongodb' },
  { name: 'Okta', token: 'okta' },
  { name: 'PandaDoc', token: 'pandadoc' },
  { name: 'Runway', token: 'runwayml' },
  { name: 'Together AI', token: 'togetherai' },
  { name: 'Twilio', token: 'twilio' },
  { name: 'Twitch', token: 'twitch' },
  { name: 'Wayve', token: 'wayve' },
  { name: 'Webflow', token: 'webflow' },
  { name: 'Dataiku', token: 'dataiku' },
  { name: 'LinkedIn', token: 'linkedin' },   // moved from Adzuna Mar 2026 (53 jobs)
  { name: 'ZoomInfo', token: 'zoominfo' },   // added Mar 2026 (71 jobs)
];

const LEVER_COMPANIES = [
  { name: 'Spotify', token: 'spotify' },
  { name: 'Mistral', token: 'mistral' },
];

const ASHBY_COMPANIES = [
  { name: 'OpenAI', token: 'openai' },
  { name: 'Cohere', token: 'cohere' },
  { name: 'Notion', token: 'notion' },
  { name: 'Perplexity', token: 'perplexity' },
  { name: 'Snowflake', token: 'snowflake' },
  { name: 'Character.ai', token: 'character' },
  { name: 'Sierra', token: 'sierra' },
  { name: 'Harvey', token: 'harvey' },
  { name: 'ElevenLabs', token: 'elevenlabs' },
  { name: 'Synthesia', token: 'synthesia' },
  { name: 'Dust', token: 'dust' },
  { name: 'Twelve Labs', token: 'twelve-labs' },
  { name: 'Pinecone', token: 'pinecone' },
  { name: 'Poe / Quora', token: 'quora' },
  { name: 'Writer', token: 'writer' },
  { name: 'LangChain', token: 'langchain' },
  { name: 'Ramp', token: 'ramp' },
  { name: 'DeepL', token: 'deepl' },
  { name: 'n8n', token: 'n8n' },
  { name: 'Airwallex', token: 'airwallex' },
  { name: 'Snyk', token: 'snyk' },
];

// Adzuna is used for big tech + companies without a public ATS API.
// IMPORTANT: `name` must match Adzuna's internal taxonomy name (used in the
// `company=` API parameter). `displayName` is shown in Sheet/Slack instead.
// These differ for companies where Adzuna's taxonomy name ≠ brand name.
// Removed: LinkedIn (moved to Greenhouse), Workday (proprietary HCM), Atlassian (iCIMS).
const ADZUNA_COMPANIES = [
  // Big Tech
  { name: 'Google' },
  { name: 'Facebook', displayName: 'Meta' },
  { name: 'Microsoft' },
  { name: 'Amazon' },
  { name: 'Apple' },
  { name: 'Adobe Systems', displayName: 'Adobe' },
  { name: 'NVIDIA' },
  { name: 'IBM' },
  { name: 'Intuit' },
  { name: 'Salesforce.com', displayName: 'Salesforce' },
  { name: 'ServiceNow' },
  { name: 'ByteDance' },
  { name: 'Oracle' },
  // Other / Custom ATS
  { name: 'Airbnb' },
  { name: 'Square', displayName: 'Block' },
  { name: 'Booking.com' },
  { name: 'Deliveroo' },
  { name: 'Expedia' },
  { name: 'Klarna' },
  { name: 'Netflix' },
  { name: 'Palantir Technologies', displayName: 'Palantir' },
  { name: 'Revolut' },
  { name: 'Shopify' },
  { name: 'Zendesk' },
  { name: 'Zoom' },
  { name: 'Adyen' },
  { name: 'Alan' },
  { name: 'BlaBlaCar' },
  { name: 'Typeform' },
  { name: 'UiPath' },
];
// 30 Adzuna companies (was 33 — LinkedIn moved to GH, Workday + Atlassian removed Mar 2026)
// US-1 node: slice(0, 17) | US-2 node: slice(17) | GB node: all

return [{
  json: {
    greenhouse: GREENHOUSE_COMPANIES,
    lever: LEVER_COMPANIES,
    ashby: ASHBY_COMPANIES,
    adzuna: ADZUNA_COMPANIES,
  }
}];
