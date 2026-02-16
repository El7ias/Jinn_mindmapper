# 🛡️ Skill Security Assessment Report

**Scanner:** ag-skill-scan v1.0.0  
**Date:** 2026-02-11 21:19:21  
**Skills Scanned:** 6

---

## Summary

| Skill | Score | Level | Findings | Capabilities |
|-------|------:|-------|----------|-------------|
| skill-security-scanner | 100 | 🔴 Critical | 0 | 183 |
| shopify-integration | 86 | 🔴 Critical | 0 | 23 |
| mindmap-to-spec | 69 | 🟠 High | 0 | 12 |
| api-cost-estimator | 65 | 🟠 High | 0 | 10 |
| agent-scaffolding | 55 | 🟠 High | 0 | 18 |
| firebase-deploy | 50 | 🟡 Medium | 0 | 7 |

---

## Detailed Findings

### skill-security-scanner — 100/100 (Critical)

**Path:** `D:\AI_Dev\mindmapper\.gemini\skills\skill-security-scanner`  
**Description:** Global meta-skill that scans .gemini/skills directories for malicious code using Semgrep static analysis, built-in capability detection, and optional LLM-assisted risk scoring. Produces normalized 0-100 risk scores per skill.  
**Code Files:** 7 | **Lines:** 1689

#### Capability Flags

- **[CRITICAL]** os.system() — unrestricted shell execution (`scripts\scan_skills.py:247`)
- **[CRITICAL]** os.popen() — shell command with output capture (`scripts\scan_skills.py:248`)
- **[HIGH]** subprocess invocation (`scripts\scan_skills.py:436`)
- **[CRITICAL]** exec() — arbitrary code execution (`scripts\scan_skills.py:251`)
- **[CRITICAL]** eval() — arbitrary expression evaluation (`scripts\scan_skills.py:252`)
- **[CRITICAL]** Node.js child_process — shell execution (`scripts\scan_skills.py:253`)
- **[CRITICAL]** subprocess with shell=True (`scripts\scan_skills.py:257`)
- **[CRITICAL]** PowerShell Invoke-Expression (`scripts\scan_skills.py:258`)
- **[HIGH]** PowerShell Start-Process (`scripts\scan_skills.py:259`)
- **[HIGH]** system() call (`scripts\scan_skills.py:247`)
- **[HIGH]** fetch() — network request (`scripts\scan_skills.py:268`)
- **[HIGH]** curl command (`scripts\scan_skills.py:271`)
- **[HIGH]** wget download (`scripts\scan_skills.py:272`)
- **[MEDIUM]** WebSocket connection (`scripts\scan_skills.py:274`)
- **[HIGH]** .env file access (may contain secrets) (`scripts\scan_skills.py:155`)
- **[HIGH]** PowerShell file deletion (`scripts\scan_skills.py:292`)
- **[HIGH]** Environment variable access (`scripts\scan_skills.py:670`)
- **[HIGH]** os.getenv() — reading env vars (`scripts\scan_skills.py:298`)
- **[HIGH]** Node.js process.env access (`scripts\scan_skills.py:299`)
- **[HIGH]** Credential pattern in code (`scripts\scan_skills.py:301`)
- **[CRITICAL]** Keychain access (`scripts\scan_skills.py:304`)
- **[HIGH]** pip install — dependency installation (`scripts\scan_skills.py:308`)
- **[HIGH]** npm install — dependency installation (`scripts\scan_skills.py:309`)
- **[HIGH]** yarn add — dependency installation (`scripts\scan_skills.py:310`)
- **[CRITICAL]** Dynamic __import__() call (`scripts\scan_skills.py:312`)
- **[HIGH]** Dynamic require() with variable (`scripts\scan_skills.py:313`)
- **[HIGH]** URL referencing executable code (`scripts\scan_skills.py:46`)
- **[CRITICAL]** Download-and-execute pattern (`scripts\scan_skills.py:315`)
- **[CRITICAL]** Crontab modification (`scripts\scan_skills.py:319`)
- **[CRITICAL]** PowerShell execution policy change (`scripts\scan_skills.py:326`)
- **[MEDIUM]** Reference to system prompt (`scripts\scan_skills.py:333`)
- **[HIGH]** Process spawn (`rules\dangerous-exec.yaml:77`)
- **[CRITICAL]** execSync — synchronous shell execution (`rules\dangerous-exec.yaml:76`)
- **[HIGH]** Dynamic module import (`rules\dangerous-exec.yaml:105`)
- **[HIGH]** Python requests HTTP call (`rules\network-exfil.yaml:14`)
- **[HIGH]** urllib network access (`rules\network-exfil.yaml:40`)
- **[HIGH]** httpx HTTP client (`rules\network-exfil.yaml:52`)
- **[HIGH]** axios HTTP client (`rules\network-exfil.yaml:75`)
- **[MEDIUM]** Raw socket access (`rules\network-exfil.yaml:89`)
- **[HIGH]** SMTP email sending (`rules\network-exfil.yaml:103`)
- **[HIGH]** Paramiko SSH client (`rules\network-exfil.yaml:116`)
- **[HIGH]** Bulk file operations (rmtree/move/copy) (`rules\filesystem-abuse.yaml:33`)
- **[HIGH]** File deletion (`rules\filesystem-abuse.yaml:44`)
- **[HIGH]** Directory deletion (`rules\filesystem-abuse.yaml:49`)
- **[HIGH]** Node.js filesystem mutation (`rules\filesystem-abuse.yaml:63`)
- **[CRITICAL]** System keyring access (`rules\credential-supply-chain.yaml:41`)
- **[MEDIUM]** Base64 encoding (potential obfuscation) (`rules\credential-supply-chain.yaml:56`)
- **[MEDIUM]** Access to sensitive dotfiles (`SKILL.md:122`)
- **[MEDIUM]** Recursive force delete (`SKILL.md:122`)
- **[MEDIUM]** Windows registry modification (`SKILL.md:125`)
- **[MEDIUM]** Prompt injection pattern (`SKILL.md:126`)

### shopify-integration — 86/100 (Critical)

**Path:** `D:\AI_Dev\mindmapper\.gemini\skills\shopify-integration`  
**Description:** End-to-end Shopify integration skill for MindMapper — covers Shopify Admin API setup, Custom App creation, MCP server configuration, credential management, connection testing, theme development, and the Shopify ↔ Agent bridge.  
**Code Files:** 0 | **Lines:** 0

#### Capability Flags

- **[MEDIUM]** .env file access (may contain secrets) (`SKILL.md:509`)
- **[MEDIUM]** Credential pattern in code (`SKILL.md:338`)
- **[MEDIUM]** URL referencing executable code (`SKILL.md:66`)

### mindmap-to-spec — 69/100 (High)

**Path:** `D:\AI_Dev\mindmapper\.gemini\skills\mindmap-to-spec`  
**Description:** Comprehensive guide to MindMapper's mind-map-to-specification pipeline — serialization, validation, prompt generation, agent orchestration, model tier routing, and export. The complete data flow from visual canvas to executable agent workflow.  
**Code Files:** 0 | **Lines:** 0

#### Capability Flags

- **[MEDIUM]** Credential pattern in code (`SKILL.md:288`)
- **[MEDIUM]** URL referencing executable code (`SKILL.md:72`)
- **[MEDIUM]** Reference to system prompt (`SKILL.md:768`)

### api-cost-estimator — 65/100 (High)

**Path:** `D:\AI_Dev\mindmapper\.gemini\skills\api-cost-estimator`  
**Description:** Complete guide to MindMapper's API cost estimation, tracking, budgeting, and optimization systems — covering model pricing, token heuristics, three-tier routing, CostTracker, BrowserAgentBridge cost history, AgentPanel estimation model, CFO/auditor agent prompts, and budget enforcement.  
**Code Files:** 0 | **Lines:** 0

#### Capability Flags

- **[MEDIUM]** URL referencing executable code (`SKILL.md:860`)
- **[MEDIUM]** Reference to system prompt (`SKILL.md:733`)

### agent-scaffolding — 55/100 (High)

**Path:** `D:\AI_Dev\mindmapper\.gemini\skills\agent-scaffolding`  
**Description:** Complete reference for MindMapper's multi-agent execution framework — covering AgentBase lifecycle, all 14 specialist agents, AgentRegistry, MessageBus, ContextManager, ExecutionEngine round-based orchestration, COOAgent planning, BrowserAgentBridge streaming, agent factory pattern, and main.js wiring.  
**Code Files:** 0 | **Lines:** 0

#### Capability Flags

- **[MEDIUM]** URL referencing executable code (`SKILL.md:3`)
- **[MEDIUM]** Reference to system prompt (`SKILL.md:1241`)

### firebase-deploy — 50/100 (Medium)

**Path:** `D:\AI_Dev\mindmapper\.gemini\skills\firebase-deploy`  
**Description:** Standardized Firebase deployment workflow for MindMapper — covers environment validation, selective deployment (Hosting, Cloud Functions, Firestore Rules), emulator testing, rollback, and troubleshooting.  
**Code Files:** 0 | **Lines:** 0

#### Capability Flags

- **[MEDIUM]** .env file access (may contain secrets) (`SKILL.md:98`)
- **[MEDIUM]** npm install — dependency installation (`SKILL.md:68`)
- **[MEDIUM]** URL referencing executable code (`SKILL.md:42`)
