/**
 * NodeManager — Creates, selects, drags, edits, and deletes mind map nodes.
 *
 * Phase 3.2 Enhancement: Nodes now carry orchestration metadata —
 * nodeType, priority, phase, assignedAgent, agentStatus, and agentNotes.
 * Visual overlays include status badges, priority rings, and agent chips.
 */

import { escapeHtml, escapeAttr } from '../core/Sanitize.js';

let _idCounter = 0;
function generateId() {
  return `node_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

const NODE_COLORS = ['#00e5ff', '#ff2d78', '#00ff88', '#ffc107', '#7c4dff', '#ff6e40', '#e6edf3'];

export const NODE_SHAPES = [
  { id: 'rectangle',     icon: '▬', label: 'Rectangle',     meaning: 'Process / Task' },
  { id: 'rounded',       icon: '▢', label: 'Rounded',       meaning: 'Start / End' },
  { id: 'diamond',       icon: '◇', label: 'Diamond',       meaning: 'Decision' },
  { id: 'parallelogram', icon: '▱', label: 'Parallelogram', meaning: 'Input / Output' },
  { id: 'hexagon',       icon: '⬡', label: 'Hexagon',       meaning: 'Preparation' },
  { id: 'circle',        icon: '●', label: 'Circle',        meaning: 'Event / Trigger' },
  { id: 'pill',          icon: '▭', label: 'Pill',          meaning: 'Terminal' },
];

// Phase 3.2: Node type definitions for the agentic system
export const NODE_TYPES = [
  { id: 'general',    icon: '📄', label: 'General',    color: '#7d8590' },
  { id: 'feature',    icon: '⚡', label: 'Feature',    color: '#00e5ff' },
  { id: 'constraint', icon: '🔒', label: 'Constraint', color: '#ffc107' },
  { id: 'reference',  icon: '📎', label: 'Reference',  color: '#7c4dff' },
  { id: 'risk',       icon: '⚠️', label: 'Risk',       color: '#ff2d78' },
  { id: 'techNote',   icon: '🔧', label: 'Tech Note',  color: '#00ff88' },
];

export const PRIORITY_LEVELS = [
  { id: 'critical', icon: '🔴', label: 'Critical', color: '#ff2d78', ring: '#ff2d78' },
  { id: 'high',     icon: '🟠', label: 'High',     color: '#ff6e40', ring: '#ff6e40' },
  { id: 'medium',   icon: '🟡', label: 'Medium',   color: '#ffc107', ring: '#ffc107' },
  { id: 'low',      icon: '🟢', label: 'Low',      color: '#00ff88', ring: '#00ff88' },
];

export const AGENT_STATUS_MAP = {
  unassigned:  { icon: '⚪', label: 'Unassigned', color: '#7d8590' },
  planning:    { icon: '🔵', label: 'Planning',   color: '#00e5ff' },
  'in-review': { icon: '🟡', label: 'In Review',  color: '#ffc107' },
  approved:    { icon: '🟢', label: 'Approved',   color: '#00ff88' },
  blocked:     { icon: '🔴', label: 'Blocked',    color: '#ff2d78' },
};

export const AGENT_ROLES = [
  { id: 'coo',       icon: '👔', label: 'COO' },
  { id: 'cto',       icon: '🏗️', label: 'CTO' },
  { id: 'cfo',       icon: '💰', label: 'CFO' },
  { id: 'frontend',  icon: '🎨', label: 'Frontend UI/UX' },
  { id: 'backend',   icon: '⚙️', label: 'Backend' },
  { id: 'devops',    icon: '🚀', label: 'DevOps' },
  { id: 'qa-tester', icon: '🧪', label: 'QA / Test' },
  { id: 'deep-researcher', icon: '📚', label: 'Deep Researcher' },
  { id: 'devils-advocate', icon: '😈', label: "Devil's Advocate" },
  { id: 'sentinel',  icon: '🛡️', label: 'Sentinel' },
  { id: 'documenter', icon: '📝', label: 'Documenter' },
  { id: 'token-auditor', icon: '🔢', label: 'Token Auditor' },
  { id: 'api-cost-auditor', icon: '💵', label: 'API Cost Auditor' },
  { id: 'project-auditor', icon: '📊', label: 'Project Auditor' },
];

// ─── Phase 8: Commerce & Integration Node Types ──────────────────────────
export const COMMERCE_NODE_TYPES = [
  // E-Commerce
  { id: 'shopify', icon: '🛍️', label: 'Shopify', category: 'e-commerce', color: '#96bf48', displayKey: 'storeUrl',
    fields: [
      { key: 'storeUrl', label: 'Store URL', type: 'text', helpHint: 'Your myshopify.com URL (e.g. my-store.myshopify.com)', helpUrl: 'https://admin.shopify.com/' },
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Found in Settings → Apps → Develop apps → API credentials', helpUrl: 'https://admin.shopify.com/settings/apps/development' },
      { key: 'accessToken', label: 'Access Token', type: 'password', helpHint: 'Admin API access token from your custom app', helpUrl: 'https://shopify.dev/docs/apps/auth/admin-app-access-tokens' },
    ] },
  { id: 'woocommerce', icon: '🛒', label: 'WooCommerce', category: 'e-commerce', color: '#9b5c8f', displayKey: 'siteUrl',
    fields: [
      { key: 'siteUrl', label: 'Site URL', type: 'text', helpHint: 'Your WordPress site URL' },
      { key: 'consumerKey', label: 'Consumer Key', type: 'password', helpHint: 'WooCommerce → Settings → Advanced → REST API', helpUrl: 'https://woocommerce.com/document/woocommerce-rest-api/' },
      { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', helpHint: 'Generated with the Consumer Key above' },
    ] },
  { id: 'etsy', icon: '🧶', label: 'Etsy', category: 'e-commerce', color: '#f1641e', displayKey: 'shopId',
    fields: [
      { key: 'shopId', label: 'Shop ID', type: 'text', helpHint: 'Your Etsy shop name or numeric ID' },
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Create an app at etsy.com/developers', helpUrl: 'https://www.etsy.com/developers/' },
    ] },
  { id: 'facebook-mp', icon: '📘', label: 'Facebook Marketplace', category: 'e-commerce', color: '#1877f2', displayKey: 'pageId',
    fields: [
      { key: 'pageId', label: 'Page ID', type: 'text', helpHint: 'Facebook Page ID for your marketplace listing' },
      { key: 'accessToken', label: 'Access Token', type: 'password', helpHint: 'Graph API token from developers.facebook.com', helpUrl: 'https://developers.facebook.com/tools/explorer/' },
    ] },
  { id: 'ebay', icon: '🏷️', label: 'eBay', category: 'e-commerce', color: '#e53238', displayKey: 'appId',
    fields: [
      { key: 'appId', label: 'App ID', type: 'text', helpHint: 'eBay Developer Program App ID (Client ID)' },
      { key: 'certId', label: 'Cert ID', type: 'password', helpHint: 'App certificate from eBay Developer Portal', helpUrl: 'https://developer.ebay.com/my/keys' },
      { key: 'authToken', label: 'Auth Token', type: 'password', helpHint: 'User auth token or OAuth token' },
    ] },
  // Payments
  { id: 'lemonsqueezy', icon: '🍋', label: 'LemonSqueezy', category: 'payments', color: '#ffc233', displayKey: 'storeId',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Settings → API → Create API key', helpUrl: 'https://app.lemonsqueezy.com/settings/api' },
      { key: 'storeId', label: 'Store ID', type: 'text', helpHint: 'Found in your store settings' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', helpHint: 'Settings → Webhooks → Signing secret' },
    ] },
  { id: 'stripe', icon: '💳', label: 'Stripe', category: 'payments', color: '#635bff', displayKey: 'publishableKey',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', helpHint: 'Starts with pk_test_ or pk_live_', helpUrl: 'https://dashboard.stripe.com/apikeys' },
      { key: 'secretKey', label: 'Secret Key', type: 'password', helpHint: 'Starts with sk_test_ or sk_live_ — keep this safe!', helpUrl: 'https://dashboard.stripe.com/apikeys' },
    ] },
  { id: 'paypal', icon: '🅿️', label: 'PayPal', category: 'payments', color: '#003087', displayKey: 'clientId',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', helpHint: 'PayPal Developer Dashboard → My Apps', helpUrl: 'https://developer.paypal.com/dashboard/applications' },
      { key: 'secret', label: 'Secret', type: 'password', helpHint: 'App secret from your PayPal REST app' },
    ] },
  // Advertising
  { id: 'meta-ads', icon: '📢', label: 'Meta Ads', category: 'advertising', color: '#1877f2', displayKey: 'adAccountId',
    fields: [
      { key: 'appId', label: 'App ID', type: 'text', helpHint: 'Meta for Developers → My Apps', helpUrl: 'https://developers.facebook.com/apps/' },
      { key: 'appSecret', label: 'App Secret', type: 'password', helpHint: 'App Settings → Basic → App Secret' },
      { key: 'adAccountId', label: 'Ad Account ID', type: 'text', helpHint: 'Starts with act_ — found in Ads Manager', helpUrl: 'https://adsmanager.facebook.com/' },
    ] },
  { id: 'google-ads', icon: '📊', label: 'Google Ads', category: 'advertising', color: '#4285f4', displayKey: 'customerId',
    fields: [
      { key: 'customerId', label: 'Customer ID', type: 'text', helpHint: '10-digit ID (xxx-xxx-xxxx) from Google Ads dashboard', helpUrl: 'https://ads.google.com/' },
      { key: 'developerToken', label: 'Developer Token', type: 'password', helpHint: 'API Centre → Developer Token', helpUrl: 'https://developers.google.com/google-ads/api/docs/first-call/dev-token' },
      { key: 'clientId', label: 'OAuth Client ID', type: 'text', helpHint: 'Google Cloud Console → APIs & Services → Credentials', helpUrl: 'https://console.cloud.google.com/apis/credentials' },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password', helpHint: 'OAuth 2.0 Client Secret from Cloud Console' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', helpHint: 'OAuth refresh token for offline access' },
    ] },
  // Email & Marketing
  { id: 'email-marketing', icon: '📧', label: 'Email Marketing', category: 'marketing', color: '#ffe01b', displayKey: 'platform',
    fields: [
      { key: 'platform', label: 'Platform (Mailchimp/Klaviyo/SendGrid)', type: 'text', helpHint: 'Which email service are you using?' },
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Find in your email platform\'s API settings' },
      { key: 'audienceId', label: 'List / Audience ID', type: 'text', helpHint: 'The specific mailing list or audience to target' },
    ] },
  // Analytics
  { id: 'google-analytics', icon: '📈', label: 'Google Analytics', category: 'analytics', color: '#e37400', displayKey: 'measurementId',
    fields: [
      { key: 'measurementId', label: 'Measurement ID', type: 'text', helpHint: 'Starts with G- (GA4). Admin → Data Streams', helpUrl: 'https://analytics.google.com/' },
      { key: 'apiSecret', label: 'API Secret', type: 'password', helpHint: 'Admin → Data Streams → Measurement Protocol API secrets' },
    ] },
  { id: 'mixpanel', icon: '📉', label: 'Mixpanel', category: 'analytics', color: '#7856ff', displayKey: 'projectToken',
    fields: [
      { key: 'projectToken', label: 'Project Token', type: 'text', helpHint: 'Settings → Project Settings → Project Token', helpUrl: 'https://mixpanel.com/' },
      { key: 'apiSecret', label: 'API Secret', type: 'password', helpHint: 'Used for server-side API access' },
    ] },
  // CRM
  { id: 'hubspot', icon: '🗂️', label: 'HubSpot', category: 'crm', color: '#ff7a59', displayKey: 'portalId',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Settings → Integrations → Private Apps', helpUrl: 'https://app.hubspot.com/' },
      { key: 'portalId', label: 'Portal ID', type: 'text', helpHint: 'Your HubSpot account ID (numeric)' },
    ] },
  { id: 'salesforce', icon: '☁️', label: 'Salesforce', category: 'crm', color: '#00a1e0', displayKey: 'instanceUrl',
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', type: 'text', helpHint: 'e.g. https://yourorg.my.salesforce.com', helpUrl: 'https://login.salesforce.com/' },
      { key: 'clientId', label: 'Consumer Key', type: 'text', helpHint: 'Connected App → Consumer Key' },
      { key: 'clientSecret', label: 'Consumer Secret', type: 'password', helpHint: 'Connected App → Consumer Secret' },
      { key: 'accessToken', label: 'Access Token', type: 'password', helpHint: 'OAuth bearer token or session ID' },
    ] },
  // Artist & Creator Marketplaces
  { id: 'gumroad', icon: '🎁', label: 'Gumroad', category: 'creator', color: '#ff90e8', displayKey: 'productId',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', helpHint: 'Settings → Advanced → Application API', helpUrl: 'https://app.gumroad.com/settings/advanced' },
      { key: 'productId', label: 'Product ID', type: 'text', helpHint: 'Found in the product URL or settings' },
    ] },
  { id: 'superhive', icon: '🐝', label: 'Superhive', category: 'creator', color: '#f5a623', displayKey: 'shopId',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'From your Superhive dashboard settings' },
      { key: 'shopId', label: 'Shop ID', type: 'text', helpHint: 'Your Superhive shop identifier' },
    ] },
  { id: 'blender-market', icon: '🎨', label: 'Blender Market', category: 'creator', color: '#ea7600', displayKey: 'shopUrl',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'From your Blender Market seller account' },
      { key: 'shopUrl', label: 'Shop URL', type: 'text', helpHint: 'Your Blender Market shop page URL' },
    ] },
  { id: 'fab', icon: '🎮', label: 'Fab', category: 'creator', color: '#00c7ff', displayKey: 'sellerId',
    fields: [
      { key: 'sellerId', label: 'Seller ID', type: 'text', helpHint: 'Your Fab seller account identifier' },
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'API key from Fab seller dashboard' },
    ] },
  { id: 'unreal-marketplace', icon: '🎯', label: 'Unreal Marketplace', category: 'creator', color: '#2f2f2f', displayKey: 'epicAccount',
    fields: [
      { key: 'epicAccount', label: 'Epic Account', type: 'text', helpHint: 'Your Epic Games account email or ID' },
      { key: 'sellerId', label: 'Seller ID', type: 'text', helpHint: 'From Unreal Marketplace seller portal' },
    ] },
  { id: 'artstation', icon: '🖌️', label: 'ArtStation Market', category: 'creator', color: '#13aff0', displayKey: 'sellerProfile',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'From your ArtStation account settings' },
      { key: 'sellerProfile', label: 'Seller Profile', type: 'text', helpHint: 'Your ArtStation profile URL or username' },
    ] },
  // Cloud & Storage
  { id: 'google-drive', icon: '📁', label: 'Google Drive', category: 'cloud', color: '#4285f4', displayKey: 'folderId',
    fields: [
      { key: 'oauthToken', label: 'OAuth Token', type: 'password', helpHint: 'OAuth 2.0 token from Google Cloud Console', helpUrl: 'https://console.cloud.google.com/apis/credentials' },
      { key: 'folderId', label: 'Folder ID', type: 'text', helpHint: 'The folder ID from the Google Drive URL' },
    ] },
  { id: 'firebase', icon: '🔥', label: 'Firebase', category: 'cloud', color: '#ffca28', displayKey: 'projectId',
    fields: [
      { key: 'projectId', label: 'Project ID', type: 'text', helpHint: 'Firebase Console → Project Settings → General', helpUrl: 'https://console.firebase.google.com/' },
      { key: 'serviceAccountKey', label: 'Service Account Key', type: 'password', helpHint: 'JSON key from Project Settings → Service accounts', helpUrl: 'https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk' },
    ] },
  { id: 'cloud-hosting', icon: '☁️', label: 'Cloud Hosting', category: 'cloud', color: '#00bcd4', displayKey: 'provider',
    fields: [
      { key: 'provider', label: 'Provider (AWS/Vercel/Supabase)', type: 'text', helpHint: 'Which hosting platform are you using?' },
      { key: 'accessKey', label: 'Access Key', type: 'password', helpHint: 'API key or access key from your provider' },
      { key: 'projectUrl', label: 'Project URL', type: 'text', helpHint: 'Your deployed project URL' },
    ] },
  // Data & Productivity
  { id: 'google-sheets', icon: '📊', label: 'Google Sheets', category: 'data', color: '#0f9d58', displayKey: 'spreadsheetId',
    fields: [
      { key: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', helpHint: 'Found in the Google Sheets URL between /d/ and /edit', helpUrl: 'https://sheets.google.com/' },
      { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'password', helpHint: 'JSON key from Google Cloud Console — share the sheet with the service account email', helpUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
    ] },
  // Social & Community Platforms
  { id: 'x-twitter', icon: '𝕏', label: 'X (Twitter)', category: 'social', color: '#000000', displayKey: 'handle',
    fields: [
      { key: 'handle', label: 'Handle (@)', type: 'text', helpHint: 'Your X/Twitter username without the @' },
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Developer Portal → Projects → Keys & Tokens', helpUrl: 'https://developer.x.com/en/portal/dashboard' },
      { key: 'apiSecret', label: 'API Secret', type: 'password', helpHint: 'Generated alongside your API Key' },
      { key: 'bearerToken', label: 'Bearer Token', type: 'password', helpHint: 'App-level auth token for read-only endpoints' },
    ] },
  { id: 'discord', icon: '🎮', label: 'Discord', category: 'social', color: '#5865f2', displayKey: 'serverId',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', helpHint: 'Developer Portal → Bot → Token', helpUrl: 'https://discord.com/developers/applications' },
      { key: 'serverId', label: 'Server (Guild) ID', type: 'text', helpHint: 'Right-click your server → Copy Server ID (enable Developer Mode)' },
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', helpHint: 'Server Settings → Integrations → Webhooks (optional)' },
    ] },
  { id: 'tiktok', icon: '🎵', label: 'TikTok', category: 'social', color: '#010101', displayKey: 'appId',
    fields: [
      { key: 'appId', label: 'App ID', type: 'text', helpHint: 'TikTok for Developers → Manage Apps', helpUrl: 'https://developers.tiktok.com/' },
      { key: 'appSecret', label: 'App Secret', type: 'password', helpHint: 'Found in your TikTok app settings' },
      { key: 'accessToken', label: 'Access Token', type: 'password', helpHint: 'OAuth access token from your app' },
    ] },
  { id: 'youtube', icon: '▶️', label: 'YouTube', category: 'social', color: '#ff0000', displayKey: 'channelId',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Google Cloud Console → APIs & Services → Credentials', helpUrl: 'https://console.cloud.google.com/apis/credentials' },
      { key: 'channelId', label: 'Channel ID', type: 'text', helpHint: 'Your YouTube channel ID (starts with UC)' },
      { key: 'oauthToken', label: 'OAuth Token', type: 'password', helpHint: 'Required for upload/manage operations — optional for read-only' },
    ] },
  { id: 'whatsapp', icon: '💬', label: 'WhatsApp Business', category: 'social', color: '#25d366', displayKey: 'phoneNumberId',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', helpHint: 'Meta Developer Dashboard → WhatsApp → Getting Started', helpUrl: 'https://developers.facebook.com/apps/' },
      { key: 'accessToken', label: 'Access Token', type: 'password', helpHint: 'Permanent token from your System User in Business Manager' },
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text', helpHint: 'WhatsApp Business Account ID from Meta Business Suite' },
    ] },
  { id: 'facebook-pages', icon: '📘', label: 'Facebook Pages', category: 'social', color: '#1877f2', displayKey: 'pageName',
    fields: [
      { key: 'pageName', label: 'Page Name', type: 'text', helpHint: 'Your Facebook Page name or URL slug' },
      { key: 'pageId', label: 'Page ID', type: 'text', helpHint: 'Found in Page Settings → About', helpUrl: 'https://www.facebook.com/pages/' },
      { key: 'pageAccessToken', label: 'Page Access Token', type: 'password', helpHint: 'Long-lived page token from Graph API Explorer', helpUrl: 'https://developers.facebook.com/tools/explorer/' },
    ] },
  // MCP Server
  { id: 'mcp-server', icon: '🔌', label: 'MCP Server', category: 'developer', color: '#00e5ff', displayKey: 'serverName',
    fields: [
      { key: 'serverName', label: 'Server Name', type: 'text', helpHint: 'A unique name for this MCP server' },
      { key: 'command', label: 'Command', type: 'text', helpHint: 'e.g. npx, node, python' },
      { key: 'args', label: 'Arguments (JSON)', type: 'textarea', helpHint: 'JSON array of command arguments, e.g. ["-y", "@anthropic/mcp-server"]' },
      { key: 'envVars', label: 'Env Variables (JSON)', type: 'textarea', helpHint: 'JSON object of environment variables, e.g. {"API_KEY": "..."}' },
    ] },
  // API Credential
  { id: 'api-credential', icon: '🔑', label: 'API Credential', category: 'developer', color: '#ff6e40', displayKey: 'name',
    fields: [
      { key: 'name', label: 'Service Name', type: 'text', helpHint: 'Descriptive name for this API' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', helpHint: 'API base URL, e.g. https://api.example.com/v1' },
      { key: 'apiKey', label: 'API Key', type: 'password', helpHint: 'Authentication key or bearer token' },
      { key: 'headers', label: 'Custom Headers (JSON)', type: 'textarea', helpHint: 'JSON object of additional HTTP headers' },
    ] },
  // GitHub
  { id: 'github-repo', icon: '🐙', label: 'GitHub Repo', category: 'developer', color: '#8b949e', displayKey: 'repo',
    fields: [
      { key: 'owner', label: 'Owner', type: 'text', helpHint: 'GitHub username or organization' },
      { key: 'repo', label: 'Repository', type: 'text', helpHint: 'Repository name (not the full URL)' },
      { key: 'pat', label: 'Personal Access Token', type: 'password', helpHint: 'Settings → Developer settings → Personal access tokens', helpUrl: 'https://github.com/settings/tokens' },
    ] },
  // Custom Integration (user-defined fields)
  { id: 'custom-integration', icon: '🔧', label: 'Custom Integration', category: 'custom', color: '#7c4dff', displayKey: null,
    fields: [] }, // fields defined by user at runtime
];

/**
 * Compute the credential status for a commerce node.
 * @param {object} node — node data with .commerceType and .credentials
 * @param {boolean} [vaultSecured] — whether vault is unlocked and credentials stored there
 * @returns {{ status: string, label: string, color: string, icon: string }}
 */
export function getCredentialStatus(node, vaultSecured = false) {
  const commerceDef = COMMERCE_NODE_TYPES.find(c => c.id === node?.commerceType);
  if (!commerceDef) return { status: 'none', label: '', color: 'transparent', icon: '' };

  const fields = commerceDef.fields;
  if (fields.length === 0) {
    // Custom integration — always "ready" if it exists
    return { status: 'ready', label: 'Custom integration', color: '#00ff88', icon: '🟢' };
  }

  const creds = node.credentials || {};
  const filled = fields.filter(f => creds[f.key]?.length > 0).length;
  const total = fields.length;

  if (filled === 0) {
    return { status: 'unconfigured', label: 'Not configured', color: '#ff4444', icon: '🔴' };
  }
  if (filled < total) {
    return { status: 'partial', label: `${filled}/${total} fields`, color: '#ffaa00', icon: '🟡' };
  }
  // Connection verified overrides vault-secured / ready
  if (node.connectionStatus === 'verified') {
    return { status: 'verified', label: 'Verified ✔', color: '#00ff88', icon: '✅' };
  }
  if (node.connectionStatus === 'failed') {
    return { status: 'failed', label: 'Test failed', color: '#ff4444', icon: '❌' };
  }
  if (vaultSecured) {
    return { status: 'vault-secured', label: 'Vault-secured', color: '#448aff', icon: '🔵' };
  }
  return { status: 'ready', label: 'All configured', color: '#00ff88', icon: '🟢' };
}

export const COMMERCE_CATEGORIES = [
  { id: 'e-commerce',   label: '🛒 E-Commerce' },
  { id: 'payments',     label: '💳 Payments' },
  { id: 'advertising',  label: '📢 Advertising' },
  { id: 'marketing',    label: '📧 Marketing' },
  { id: 'analytics',    label: '📈 Analytics' },
  { id: 'crm',          label: '🗂️ CRM' },
  { id: 'creator',      label: '🎨 Creator' },
  { id: 'cloud',        label: '📁 Cloud' },
  { id: 'data',         label: '📊 Data' },
  { id: 'social',       label: '💬 Social' },
  { id: 'developer',    label: '🔌 Developer' },
  { id: 'custom',       label: '🔧 Custom' },
];

export class NodeManager {
  constructor(bus, viewport) {
    this.bus = bus;
    this.viewport = viewport;
    this.nodesLayer = document.getElementById('nodes-layer');
    this.container = document.getElementById('canvas-container');

    /** @type {Map<string, object>} */
    this.nodes = new Map();
    this.selected = new Set();

    this._dragging = null;
    this._dragOffsets = new Map();
    this.connectionManager = null; // set via setConnectionManager()

    this._bindEvents();
  }

  /** Allow NodeManager to reference ConnectionManager for splice-on-drop */
  setConnectionManager(cm) {
    this.connectionManager = cm;
  }

  _bindEvents() {
    // Double-click canvas → create node
    this.container.addEventListener('dblclick', (e) => {
      // Ignore if clicking on a node, port, or connection wire
      if (e.target.closest('.mind-node') || e.target.closest('.node-port')) return;
      if (e.target.closest('.connection-group') || e.target.closest('.connection-hit-area')) return;

      const rect = this.container.getBoundingClientRect();
      const world = this.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.createNode(world.x - 70, world.y - 20);
    });

    // Click canvas → deselect all
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.viewport.isSpaceDown) return;
      if (!e.target.closest('.mind-node') && !e.target.closest('.toolbar') && !e.target.closest('.property-panel') && !e.target.closest('.context-menu')) {
        this.deselectAll();
        this.bus.emit('selection:changed', []);
      }
    });

    // Global mouse events for dragging
    window.addEventListener('mousemove', (e) => this._onDragMove(e));
    window.addEventListener('mouseup', (e) => this._onDragEnd(e));

    // Toolbar add button
    document.getElementById('btn-add-node')?.addEventListener('click', () => {
      const rect = this.container.getBoundingClientRect();
      const world = this.viewport.screenToWorld(rect.width / 2, rect.height / 2);
      this.createNode(world.x - 70, world.y - 20);
    });

    // Toolbar delete button
    document.getElementById('btn-delete')?.addEventListener('click', () => {
      this.deleteSelected();
    });
  }

  createNode(x, y, opts = {}) {
    const id = opts.id || generateId();
    const text = opts.text || '';
    const color = opts.color || NODE_COLORS[this.nodes.size % NODE_COLORS.length];
    const shape = opts.shape || 'rectangle';

    // Phase 3.2 metadata defaults
    const nodeType = opts.nodeType || 'general';
    const priority = opts.priority || 'medium';
    const phase = opts.phase ?? null;
    const assignedAgent = opts.assignedAgent || null;
    const agentStatus = opts.agentStatus || 'unassigned';
    const agentNotes = opts.agentNotes || null;

    // Phase 8: Commerce node fields
    const commerceType = opts.commerceType || null;
    const credentials = opts.credentials || {};
    const customFields = opts.customFields || null; // for custom-integration
    const connectionStatus = opts.connectionStatus || 'untested'; // P2.1: verified|failed|untested

    // Override color for commerce nodes
    const commerceDef = commerceType ? COMMERCE_NODE_TYPES.find(c => c.id === commerceType) : null;
    const finalColor = commerceType ? (commerceDef?.color || color) : color;

    const el = document.createElement('div');
    el.className = `mind-node appearing shape-${shape}`;
    if (priority !== 'medium') {
      el.classList.add(`priority-${priority}`);
    }
    if (commerceType) {
      el.classList.add('commerce-node');
      el.classList.add(`commerce-${commerceType}`);
    }
    el.dataset.nodeId = id;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // Build inner HTML with Phase 3.2 overlays
    el.innerHTML = this._buildNodeHTML(id, text || (commerceDef?.label || ''), finalColor, nodeType, priority, phase, assignedAgent, agentStatus, commerceType);

    // Remove animation class after it plays
    el.addEventListener('animationend', () => el.classList.remove('appearing'), { once: true });

    // Click to select
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('node-port')) return;
      if (e.button !== 0) return;
      if (this.viewport.isSpaceDown) return;
      e.stopPropagation();

      if (e.shiftKey) {
        this._toggleSelect(id);
      } else if (!this.selected.has(id)) {
        this.deselectAll();
        this._select(id);
      }

      this._startDrag(e, id);
    });

    // Double-click: edit text (normal) or open config (commerce)
    const textEl = el.querySelector('.node-text');
    textEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (commerceType) {
        this.bus.emit('commerce:config-request', { nodeId: id });
      } else {
        this._startEditing(id, textEl);
      }
    });

    this.nodesLayer.appendChild(el);

    const nodeData = { 
      id, text: text || (commerceDef?.label || ''), x, y, color: finalColor, shape, el,
      // Phase 3.2 metadata
      nodeType, priority, phase, assignedAgent, agentStatus, agentNotes,
      // Phase 8 commerce
      commerceType, credentials, customFields,
      // P2.1 connection test status
      connectionStatus,
    };
    this.nodes.set(id, nodeData);

    this.deselectAll();
    this._select(id);

    this.bus.emit('node:created', nodeData);
    this.bus.emit('state:changed');

    // Hide help hint after first node
    const hint = document.getElementById('help-hint');
    if (hint) hint.classList.add('hidden');

    return nodeData;
  }

  _buildNodeHTML(id, text, color, nodeType, priority, phase, assignedAgent, agentStatus, commerceType = null) {
    const statusInfo = AGENT_STATUS_MAP[agentStatus] || AGENT_STATUS_MAP.unassigned;
    const typeInfo = NODE_TYPES.find(t => t.id === nodeType);
    const agentInfo = assignedAgent ? AGENT_ROLES.find(a => a.id === assignedAgent) : null;
    const commerceDef = commerceType ? COMMERCE_NODE_TYPES.find(c => c.id === commerceType) : null;
    
    // Status badge (only when assigned to an agent)
    const statusBadge = agentStatus !== 'unassigned' 
      ? `<span class="node-status-badge" title="${escapeAttr(statusInfo.label)}" style="background:${statusInfo.color}">${statusInfo.icon}</span>` 
      : '';

    // Commerce icon badge with credential status dot
    let commerceBadge = '';
    if (commerceDef) {
      const node = this.nodes.get(id);
      const credStatus = getCredentialStatus(node || { commerceType, credentials: {} });
      const statusDot = `<span class="node-cred-status status-${credStatus.status}" title="${escapeAttr(credStatus.label)}" style="color:${credStatus.color}">●</span>`;
      commerceBadge = `<span class="node-commerce-badge" title="${escapeAttr(commerceDef.label)}">${commerceDef.icon}${statusDot}</span>`;
    }

    // Agent assignment chip
    const agentChip = agentInfo 
      ? `<span class="node-agent-chip" title="${escapeAttr(agentInfo.label)}">${agentInfo.icon} ${escapeHtml(agentInfo.label)}</span>`
      : '';

    // Phase & priority meta line
    const metaParts = [];
    if (phase !== null && phase !== undefined) metaParts.push(`Phase ${phase}`);
    if (nodeType !== 'general') metaParts.push(`${typeInfo?.icon || ''} ${escapeHtml(typeInfo?.label || nodeType)}`);
    if (commerceDef) metaParts.push(`${commerceDef.icon} ${escapeHtml(commerceDef.label)}`);
    const metaLine = metaParts.length > 0 || agentChip
      ? `<div class="node-meta">${agentChip}${metaParts.length > 0 ? `<span class="node-meta-text">${metaParts.join(' · ')}</span>` : ''}</div>`
      : '';

    return `
      <div class="node-color-bar" style="background:${color}"></div>
      ${statusBadge}
      ${commerceBadge}
      <div class="node-text" spellcheck="false">${escapeHtml(text || '')}</div>
      ${metaLine}
      <div class="node-port port-top" data-port="top" data-node-id="${id}"></div>
      <div class="node-port port-right" data-port="right" data-node-id="${id}"></div>
      <div class="node-port port-bottom" data-port="bottom" data-node-id="${id}"></div>
      <div class="node-port port-left" data-port="left" data-node-id="${id}"></div>
    `;
  }

  /**
   * Update the visual overlays on a node to reflect metadata changes
   */
  _refreshNodeOverlays(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const el = node.el;
    const textEl = el.querySelector('.node-text');
    const currentText = textEl?.textContent || node.text;

    // Rebuild HTML (includes Phase 8 commerce badge)
    el.innerHTML = this._buildNodeHTML(
      node.id, currentText, node.color,
      node.nodeType, node.priority, node.phase,
      node.assignedAgent, node.agentStatus, node.commerceType
    );

    // Update priority ring class
    PRIORITY_LEVELS.forEach(p => el.classList.remove(`priority-${p.id}`));
    if (node.priority !== 'medium') {
      el.classList.add(`priority-${node.priority}`);
    }

    // Rebind double-click on the new text element
    const newTextEl = el.querySelector('.node-text');
    newTextEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (node.commerceType) {
        this.bus.emit('commerce:config-request', { nodeId: node.id });
      } else {
        this._startEditing(node.id, newTextEl);
      }
    });
  }

  // ─── Phase 3.2 Metadata Setters ──────────────────────────────────────────

  /**
   * Set the node type (feature, constraint, risk, etc.)
   */
  setNodeType(nodeId, typeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.nodeType = typeId;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the priority level (critical, high, medium, low)
   */
  setPriority(nodeId, priorityId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.priority = priorityId;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the development phase number
   */
  setPhase(nodeId, phaseNum) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.phase = phaseNum;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the assigned agent role
   */
  setAssignedAgent(nodeId, agentRole) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.assignedAgent = agentRole;
    if (agentRole && node.agentStatus === 'unassigned') {
      node.agentStatus = 'planning';
    }
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the agent status
   */
  setAgentStatus(nodeId, status) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.agentStatus = status;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set agent notes on a node
   */
  setAgentNotes(nodeId, notes) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.agentNotes = notes;
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  // ─── Original methods (unchanged) ────────────────────────────────────────

  _startEditing(id, textEl) {
    textEl.contentEditable = 'true';
    textEl.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      textEl.contentEditable = 'false';
      const node = this.nodes.get(id);
      if (node) {
        node.text = textEl.textContent.trim();
        this.bus.emit('node:updated', node);
        this.bus.emit('state:changed');
      }
      textEl.removeEventListener('blur', finish);
      textEl.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textEl.blur();
      }
      if (e.key === 'Escape') {
        textEl.blur();
      }
      e.stopPropagation(); // prevent global shortcuts while editing
    };

    textEl.addEventListener('blur', finish);
    textEl.addEventListener('keydown', onKey);
  }

  _select(id) {
    this.selected.add(id);
    const node = this.nodes.get(id);
    if (node) node.el.classList.add('selected');
    this.bus.emit('selection:changed', [...this.selected]);
  }

  _toggleSelect(id) {
    if (this.selected.has(id)) {
      this.selected.delete(id);
      const node = this.nodes.get(id);
      if (node) node.el.classList.remove('selected');
    } else {
      this._select(id);
    }
    this.bus.emit('selection:changed', [...this.selected]);
  }

  deselectAll() {
    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      if (node) node.el.classList.remove('selected');
    });
    this.selected.clear();
  }

  _startDrag(e, clickedId) {
    this._dragging = clickedId;
    this._dragOffsets.clear();

    const startWorld = this.viewport.screenToWorld(e.clientX, e.clientY);

    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      if (node) {
        node.el.classList.add('dragging');
        this._dragOffsets.set(id, {
          dx: node.x - startWorld.x,
          dy: node.y - startWorld.y
        });
      }
    });
  }

  _onDragMove(e) {
    if (!this._dragging) return;

    const world = this.viewport.screenToWorld(e.clientX, e.clientY);

    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      const offset = this._dragOffsets.get(id);
      if (node && offset) {
        node.x = world.x + offset.dx;
        node.y = world.y + offset.dy;
        node.el.style.left = `${node.x}px`;
        node.el.style.top = `${node.y}px`;
        this.bus.emit('node:moved', node);
      }
    });

    // Splice preview: highlight wire under a single dragged node
    if (this.selected.size === 1 && this.connectionManager) {
      const nodeId = [...this.selected][0];
      const node = this.nodes.get(nodeId);
      if (node) {
        const cx = node.x + node.el.offsetWidth / 2;
        const cy = node.y + node.el.offsetHeight / 2;
        this.connectionManager.highlightSpliceTarget(cx, cy, nodeId);
      }
    }
  }

  _onDragEnd(e) {
    if (!this._dragging) return;

    // Check for wire splice (single node dropped on a wire)
    if (this.selected.size === 1 && this.connectionManager) {
      const nodeId = [...this.selected][0];
      const node = this.nodes.get(nodeId);
      if (node) {
        const cx = node.x + node.el.offsetWidth / 2;
        const cy = node.y + node.el.offsetHeight / 2;
        const conn = this.connectionManager.findConnectionAtPoint(cx, cy, nodeId);
        if (conn) {
          this.connectionManager.clearSpliceHighlight();
          this.connectionManager.spliceNodeIntoConnection(conn.id, nodeId);
        }
      }
      this.connectionManager.clearSpliceHighlight();
    }

    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      if (node) node.el.classList.remove('dragging');
    });

    this._dragging = null;
    this._dragOffsets.clear();
    this.bus.emit('state:changed');
  }

  deleteSelected() {
    if (this.selected.size === 0) return;
    const ids = [...this.selected];
    ids.forEach(id => this.deleteNode(id));
    this.bus.emit('state:changed');
  }

  deleteNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.el.remove();
    this.nodes.delete(id);
    this.selected.delete(id);
    this.bus.emit('node:deleted', { id });
    this.bus.emit('selection:changed', [...this.selected]);
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  /** Change the shape of a node */
  setShape(nodeId, shapeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    // Remove old shape class, add new one
    NODE_SHAPES.forEach(s => node.el.classList.remove(`shape-${s.id}`));
    node.el.classList.add(`shape-${shapeId}`);
    node.shape = shapeId;
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /** Get port center position in world coordinates */
  getPortPosition(nodeId, port) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    // ── DOM-based position (most accurate, handles all CSS quirks) ────
    const portEl = node.el.querySelector(`.port-${port}`);
    if (portEl) {
      const containerRect = this.viewport.container.getBoundingClientRect();
      const portRect = portEl.getBoundingClientRect();

      // Port center in screen-space, relative to the container
      const sx = portRect.left + portRect.width / 2 - containerRect.left;
      const sy = portRect.top + portRect.height / 2 - containerRect.top;

      // Convert screen → world
      return this.viewport.screenToWorld(sx, sy);
    }

    // ── Fallback: math-based (if port element not found) ─────────────
    const w = node.el.offsetWidth;
    const h = node.el.offsetHeight;
    switch (port) {
      case 'top':    return { x: node.x + w / 2, y: node.y };
      case 'right':  return { x: node.x + w,     y: node.y + h / 2 };
      case 'bottom': return { x: node.x + w / 2, y: node.y + h };
      case 'left':   return { x: node.x,         y: node.y + h / 2 };
      default:       return { x: node.x + w / 2, y: node.y + h / 2 };
    }
  }

  /** Serialize all nodes — includes Phase 3.2 + Phase 8 metadata */
  serialize() {
    const arr = [];
    this.nodes.forEach(n => {
      const entry = {
        id: n.id, text: n.text, x: n.x, y: n.y, color: n.color,
        shape: n.shape || 'rectangle',
        // Phase 3.2 metadata
        nodeType: n.nodeType || 'general',
        priority: n.priority || 'medium',
        phase: n.phase ?? null,
        assignedAgent: n.assignedAgent || null,
        agentStatus: n.agentStatus || 'unassigned',
        agentNotes: n.agentNotes || null,
      };
      // Phase 8: Commerce fields (only if present)
      if (n.commerceType) {
        entry.commerceType = n.commerceType;
        entry.credentials = n.credentials || {};
        if (n.customFields) entry.customFields = n.customFields;
        if (n.connectionStatus && n.connectionStatus !== 'untested') {
          entry.connectionStatus = n.connectionStatus;
        }
      }
      arr.push(entry);
    });
    return arr;
  }

  /** Load nodes from serialized data — handles Phase 3.2 + Phase 8 metadata */
  deserialize(data) {
    // Clear existing
    this.nodes.forEach(n => n.el.remove());
    this.nodes.clear();
    this.selected.clear();

    if (!data) return;
    data.forEach(d => {
      this.createNode(d.x, d.y, {
        id: d.id, text: d.text, color: d.color,
        shape: d.shape || 'rectangle',
        // Phase 3.2 metadata (backward compatible)
        nodeType: d.nodeType || 'general',
        priority: d.priority || 'medium',
        phase: d.phase ?? null,
        assignedAgent: d.assignedAgent || null,
        agentStatus: d.agentStatus || 'unassigned',
        agentNotes: d.agentNotes || null,
        // Phase 8: Commerce (backward compatible)
        commerceType: d.commerceType || null,
        credentials: d.credentials || {},
        customFields: d.customFields || null,
        connectionStatus: d.connectionStatus || 'untested',
      });
    });
    this.deselectAll();
  }

  /** Get bounding box of all nodes in world coords */
  getBounds() {
    if (this.nodes.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      const w = n.el.offsetWidth;
      const h = n.el.offsetHeight;
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + w > maxX) maxX = n.x + w;
      if (n.y + h > maxY) maxY = n.y + h;
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
}
