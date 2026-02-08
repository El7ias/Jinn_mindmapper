/**
 * Built-in Preset Templates for MindMapper
 *
 * Each preset contains:
 *   id, name, description, icon, category,
 *   data: { nodes[], connections[] }
 */

// --- Helper: unique IDs per preset ---
let _pid = 0;
const nid = () => `pn_${++_pid}`;
const cid = () => `pc_${++_pid}`;

// ─────────────────────────────────────
//  1. Smartphone App — iOS
// ─────────────────────────────────────
function iosApp() {
  _pid = 0;
  const n = {
    core:   nid(), ui:     nid(), logic:  nid(), data:   nid(),
    nav:    nid(), auth:   nid(), api:    nid(), push:   nid(),
    store:  nid(), test:   nid(), analytics: nid(),
  };
  return {
    id: 'ios-app',
    name: 'iOS App',
    description: 'Full iOS app architecture — SwiftUI, Auth, APIs, App Store',
    icon: '📱',
    category: 'mobile',
    data: {
      nodes: [
        { id: n.core,   text: 'iOS App Core',       x: 350,  y: 0,   color: '#00e5ff', shape: 'rounded' },
        { id: n.ui,     text: 'UI / SwiftUI',        x: 50,   y: 140, color: '#7c4dff', shape: 'rectangle' },
        { id: n.logic,  text: 'Business Logic',      x: 350,  y: 140, color: '#00e5ff', shape: 'rectangle' },
        { id: n.data,   text: 'Data Layer',          x: 650,  y: 140, color: '#ffc107', shape: 'parallelogram' },
        { id: n.nav,    text: 'Navigation',          x: 0,    y: 290, color: '#7c4dff', shape: 'diamond' },
        { id: n.auth,   text: 'Auth Flow',           x: 250,  y: 290, color: '#ff2d78', shape: 'diamond' },
        { id: n.api,    text: 'REST API',            x: 500,  y: 290, color: '#ffc107', shape: 'parallelogram' },
        { id: n.push,   text: 'Push Notifications',  x: 720,  y: 290, color: '#ff6e40', shape: 'circle' },
        { id: n.test,   text: 'Testing',             x: 100,  y: 440, color: '#00ff88', shape: 'hexagon' },
        { id: n.analytics, text: 'Analytics',        x: 400,  y: 440, color: '#ffc107', shape: 'hexagon' },
        { id: n.store,  text: 'App Store',            x: 300,  y: 580, color: '#00ff88', shape: 'pill' },
      ],
      connections: [
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.ui,    targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.logic, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.data,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.ui,   sourcePort: 'bottom', targetId: n.nav,   targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.logic, sourcePort: 'bottom', targetId: n.auth, targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.logic, sourcePort: 'bottom', targetId: n.api,  targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.data,  sourcePort: 'bottom', targetId: n.push, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.nav,   sourcePort: 'bottom', targetId: n.test, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.api,   sourcePort: 'bottom', targetId: n.analytics, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.test,  sourcePort: 'bottom', targetId: n.store, targetPort: 'left', directed: 'forward' },
        { id: cid(), sourceId: n.analytics, sourcePort: 'bottom', targetId: n.store, targetPort: 'right', directed: 'forward' },
      ],
    },
  };
}

// ─────────────────────────────────────
//  2. Smartphone App — Android
// ─────────────────────────────────────
function androidApp() {
  _pid = 100;
  const n = {
    core:   nid(), ui:     nid(), logic:  nid(), data:   nid(),
    nav:    nid(), auth:   nid(), api:    nid(), firebase: nid(),
    play:   nid(), test:   nid(), permissions: nid(),
  };
  return {
    id: 'android-app',
    name: 'Android App',
    description: 'Android app architecture — Jetpack Compose, Firebase, Play Store',
    icon: '🤖',
    category: 'mobile',
    data: {
      nodes: [
        { id: n.core,   text: 'Android App',         x: 350,  y: 0,   color: '#00ff88', shape: 'rounded' },
        { id: n.ui,     text: 'Jetpack Compose',      x: 50,   y: 140, color: '#7c4dff', shape: 'rectangle' },
        { id: n.logic,  text: 'ViewModel / Logic',    x: 350,  y: 140, color: '#00e5ff', shape: 'rectangle' },
        { id: n.data,   text: 'Room Database',        x: 650,  y: 140, color: '#ffc107', shape: 'parallelogram' },
        { id: n.nav,    text: 'Navigation Graph',     x: 0,    y: 290, color: '#7c4dff', shape: 'diamond' },
        { id: n.auth,   text: 'Auth / OAuth',         x: 250,  y: 290, color: '#ff2d78', shape: 'diamond' },
        { id: n.api,    text: 'Retrofit API',         x: 500,  y: 290, color: '#ffc107', shape: 'parallelogram' },
        { id: n.firebase, text: 'Firebase Services',  x: 720,  y: 290, color: '#ff6e40', shape: 'circle' },
        { id: n.permissions, text: 'Permissions',     x: 100,  y: 440, color: '#ff6e40', shape: 'hexagon' },
        { id: n.test,   text: 'Espresso Tests',       x: 400,  y: 440, color: '#00ff88', shape: 'hexagon' },
        { id: n.play,   text: 'Play Store',           x: 300,  y: 580, color: '#00ff88', shape: 'pill' },
      ],
      connections: [
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.ui,    targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.logic, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.data,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.ui,   sourcePort: 'bottom', targetId: n.nav,   targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.logic, sourcePort: 'bottom', targetId: n.auth, targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.logic, sourcePort: 'bottom', targetId: n.api,  targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.data,  sourcePort: 'bottom', targetId: n.firebase, targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.nav,   sourcePort: 'bottom', targetId: n.permissions, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.api,   sourcePort: 'bottom', targetId: n.test, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.permissions, sourcePort: 'bottom', targetId: n.play, targetPort: 'left', directed: 'forward' },
        { id: cid(), sourceId: n.test,  sourcePort: 'bottom', targetId: n.play, targetPort: 'right', directed: 'forward' },
      ],
    },
  };
}

// ─────────────────────────────────────
//  3. Local Executable Program
// ─────────────────────────────────────
function localExe() {
  _pid = 200;
  const n = {
    app:    nid(), ui:     nid(), core:   nid(), files:  nid(),
    config: nid(), cli:    nid(), db:     nid(),
    pkg:    nid(), test:   nid(), logs:   nid(),
  };
  return {
    id: 'local-exe',
    name: 'Local Executable',
    description: 'Desktop application — GUI, file I/O, configuration, packaging',
    icon: '🖥️',
    category: 'desktop',
    data: {
      nodes: [
        { id: n.app,    text: 'Application',       x: 350,  y: 0,   color: '#00e5ff', shape: 'rounded' },
        { id: n.ui,     text: 'GUI Framework',      x: 50,   y: 150, color: '#7c4dff', shape: 'rectangle' },
        { id: n.core,   text: 'Core Engine',         x: 350,  y: 150, color: '#00e5ff', shape: 'rectangle' },
        { id: n.files,  text: 'File I/O',            x: 650,  y: 150, color: '#ffc107', shape: 'parallelogram' },
        { id: n.config, text: 'Configuration',       x: 0,    y: 310, color: '#ffc107', shape: 'hexagon' },
        { id: n.cli,    text: 'CLI Interface',       x: 220,  y: 310, color: '#e6edf3', shape: 'parallelogram' },
        { id: n.db,     text: 'Local Database',      x: 470,  y: 310, color: '#ffc107', shape: 'parallelogram' },
        { id: n.logs,   text: 'Logging',             x: 700,  y: 310, color: '#ff6e40', shape: 'hexagon' },
        { id: n.test,   text: 'Unit / Integration',  x: 200,  y: 470, color: '#00ff88', shape: 'hexagon' },
        { id: n.pkg,    text: 'Installer / Package', x: 450,  y: 470, color: '#00ff88', shape: 'pill' },
      ],
      connections: [
        { id: cid(), sourceId: n.app,  sourcePort: 'bottom', targetId: n.ui,    targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.app,  sourcePort: 'bottom', targetId: n.core,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.app,  sourcePort: 'bottom', targetId: n.files, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.ui,   sourcePort: 'bottom', targetId: n.config, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.cli,   targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.core, sourcePort: 'bottom', targetId: n.db,    targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.files, sourcePort: 'bottom', targetId: n.logs, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.cli,  sourcePort: 'bottom', targetId: n.test,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.db,   sourcePort: 'bottom', targetId: n.pkg,   targetPort: 'top', directed: 'forward' },
      ],
    },
  };
}

// ─────────────────────────────────────
//  4. SaaS Application
// ─────────────────────────────────────
function saasApp() {
  _pid = 300;
  const n = {
    product:  nid(), frontend: nid(), backend:  nid(), db:       nid(),
    auth:     nid(), billing:  nid(), hosting:  nid(), monitor:  nid(),
    ci:       nid(), marketing: nid(), onboard: nid(),
  };
  return {
    id: 'saas',
    name: 'SaaS Platform',
    description: 'SaaS architecture — Frontend, API, Auth, Billing, DevOps',
    icon: '☁️',
    category: 'saas',
    data: {
      nodes: [
        { id: n.product,  text: 'SaaS Product',     x: 350,  y: 0,   color: '#7c4dff', shape: 'rounded' },
        { id: n.frontend, text: 'Frontend (React)',   x: 50,   y: 150, color: '#00e5ff', shape: 'rectangle' },
        { id: n.backend,  text: 'Backend API',        x: 350,  y: 150, color: '#00e5ff', shape: 'rectangle' },
        { id: n.db,       text: 'Database',            x: 650,  y: 150, color: '#ffc107', shape: 'parallelogram' },
        { id: n.auth,     text: 'Auth & Users',       x: 50,   y: 310, color: '#ff2d78', shape: 'diamond' },
        { id: n.billing,  text: 'Billing / Stripe',   x: 280,  y: 310, color: '#ff6e40', shape: 'circle' },
        { id: n.onboard,  text: 'Onboarding',         x: 500,  y: 310, color: '#00ff88', shape: 'hexagon' },
        { id: n.hosting,  text: 'Hosting / CDN',      x: 720,  y: 310, color: '#e6edf3', shape: 'hexagon' },
        { id: n.ci,       text: 'CI / CD Pipeline',   x: 100,  y: 470, color: '#00ff88', shape: 'hexagon' },
        { id: n.monitor,  text: 'Monitoring',         x: 380,  y: 470, color: '#ff6e40', shape: 'circle' },
        { id: n.marketing, text: 'Marketing Site',    x: 600,  y: 470, color: '#7c4dff', shape: 'rounded' },
      ],
      connections: [
        { id: cid(), sourceId: n.product,  sourcePort: 'bottom', targetId: n.frontend, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.product,  sourcePort: 'bottom', targetId: n.backend,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.product,  sourcePort: 'bottom', targetId: n.db,       targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.frontend, sourcePort: 'bottom', targetId: n.auth,     targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.backend,  sourcePort: 'bottom', targetId: n.billing,  targetPort: 'top', directed: 'both' },
        { id: cid(), sourceId: n.backend,  sourcePort: 'bottom', targetId: n.onboard,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.db,       sourcePort: 'bottom', targetId: n.hosting,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.auth,     sourcePort: 'bottom', targetId: n.ci,       targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.billing,  sourcePort: 'bottom', targetId: n.monitor,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.hosting,  sourcePort: 'bottom', targetId: n.marketing, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.frontend, sourcePort: 'right',  targetId: n.backend,  targetPort: 'left', directed: 'both' },
      ],
    },
  };
}

// ─────────────────────────────────────
//  5. Website Wireframe
// ─────────────────────────────────────
function websiteWireframe() {
  _pid = 400;
  const n = {
    page:    nid(), header: nid(), hero:   nid(), features: nid(),
    cta:     nid(), social: nid(), footer: nid(),
    about:   nid(), contact: nid(), pricing: nid(),
  };
  return {
    id: 'wireframe',
    name: 'Website Wireframe',
    description: 'Page layout wireframe — Header, Hero, Sections, Footer',
    icon: '📐',
    category: 'web',
    data: {
      nodes: [
        { id: n.page,     text: 'Homepage',           x: 300,  y: 0,   color: '#00e5ff', shape: 'rounded' },
        { id: n.header,   text: 'Header / Nav Bar',   x: 300,  y: 130, color: '#7c4dff', shape: 'rectangle' },
        { id: n.hero,     text: 'Hero Section',       x: 300,  y: 260, color: '#ff2d78', shape: 'rectangle' },
        { id: n.features, text: 'Features Grid',      x: 100,  y: 390, color: '#ffc107', shape: 'rectangle' },
        { id: n.cta,      text: 'CTA Banner',         x: 500,  y: 390, color: '#ff2d78', shape: 'rectangle' },
        { id: n.social,   text: 'Social Proof',       x: 300,  y: 520, color: '#e6edf3', shape: 'rectangle' },
        { id: n.footer,   text: 'Footer',             x: 300,  y: 650, color: '#7c4dff', shape: 'rectangle' },
        { id: n.about,    text: 'About Page',         x: 680,  y: 130, color: '#00ff88', shape: 'rounded' },
        { id: n.pricing,  text: 'Pricing Page',       x: 680,  y: 260, color: '#ff6e40', shape: 'rounded' },
        { id: n.contact,  text: 'Contact Page',       x: 680,  y: 390, color: '#ffc107', shape: 'rounded' },
      ],
      connections: [
        { id: cid(), sourceId: n.page,   sourcePort: 'bottom', targetId: n.header,   targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.header, sourcePort: 'bottom', targetId: n.hero,     targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.hero,   sourcePort: 'bottom', targetId: n.features, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.hero,   sourcePort: 'bottom', targetId: n.cta,      targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.features, sourcePort: 'bottom', targetId: n.social, targetPort: 'left', directed: 'forward' },
        { id: cid(), sourceId: n.cta,    sourcePort: 'bottom', targetId: n.social,   targetPort: 'right', directed: 'forward' },
        { id: cid(), sourceId: n.social, sourcePort: 'bottom', targetId: n.footer,   targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.header, sourcePort: 'right',  targetId: n.about,    targetPort: 'left', directed: 'forward' },
        { id: cid(), sourceId: n.about,  sourcePort: 'bottom', targetId: n.pricing,  targetPort: 'top', directed: 'none' },
        { id: cid(), sourceId: n.pricing, sourcePort: 'bottom', targetId: n.contact, targetPort: 'top', directed: 'none' },
      ],
    },
  };
}

// ─────────────────────────────────────
//  6. Website Map (Sitemap)
// ─────────────────────────────────────
function websiteMap() {
  _pid = 500;
  const n = {
    home:     nid(), about:   nid(), products: nid(), blog:   nid(),
    contact:  nid(), login:   nid(), dashboard: nid(), detail: nid(),
    post:     nid(), error:   nid(), terms:   nid(),
  };
  return {
    id: 'sitemap',
    name: 'Website Map',
    description: 'Full sitemap structure — pages, hierarchy, user flows',
    icon: '🗺️',
    category: 'web',
    data: {
      nodes: [
        { id: n.home,      text: 'Home',              x: 350,  y: 0,   color: '#00e5ff', shape: 'rounded' },
        { id: n.about,     text: 'About',             x: 0,    y: 150, color: '#7c4dff', shape: 'rectangle' },
        { id: n.products,  text: 'Products',          x: 200,  y: 150, color: '#ffc107', shape: 'rectangle' },
        { id: n.blog,      text: 'Blog',              x: 420,  y: 150, color: '#00ff88', shape: 'rectangle' },
        { id: n.contact,   text: 'Contact',           x: 630,  y: 150, color: '#e6edf3', shape: 'rectangle' },
        { id: n.login,     text: 'Login / Register',  x: 830,  y: 150, color: '#ff2d78', shape: 'diamond' },
        { id: n.detail,    text: 'Product Detail',    x: 140,  y: 310, color: '#ffc107', shape: 'rectangle' },
        { id: n.post,      text: 'Blog Post',         x: 380,  y: 310, color: '#00ff88', shape: 'rectangle' },
        { id: n.dashboard, text: 'User Dashboard',    x: 750,  y: 310, color: '#7c4dff', shape: 'hexagon' },
        { id: n.error,     text: '404 Not Found',     x: 550,  y: 310, color: '#ff6e40', shape: 'circle' },
        { id: n.terms,     text: 'Terms & Privacy',   x: 0,    y: 310, color: '#e6edf3', shape: 'pill' },
      ],
      connections: [
        { id: cid(), sourceId: n.home,     sourcePort: 'bottom', targetId: n.about,    targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.home,     sourcePort: 'bottom', targetId: n.products, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.home,     sourcePort: 'bottom', targetId: n.blog,     targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.home,     sourcePort: 'bottom', targetId: n.contact,  targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.home,     sourcePort: 'bottom', targetId: n.login,    targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.products, sourcePort: 'bottom', targetId: n.detail,   targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.blog,     sourcePort: 'bottom', targetId: n.post,     targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.login,    sourcePort: 'bottom', targetId: n.dashboard, targetPort: 'top', directed: 'forward' },
        { id: cid(), sourceId: n.contact,  sourcePort: 'bottom', targetId: n.error,    targetPort: 'top', directed: 'none' },
        { id: cid(), sourceId: n.about,    sourcePort: 'bottom', targetId: n.terms,    targetPort: 'top', directed: 'forward' },
      ],
    },
  };
}

// ═══════════════════════════════════
//  Export all built-in presets
// ═══════════════════════════════════
export const BUILTIN_PRESETS = [
  iosApp(),
  androidApp(),
  localExe(),
  saasApp(),
  websiteWireframe(),
  websiteMap(),
];
