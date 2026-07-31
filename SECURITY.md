# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch | ✅ Yes |
| Older tags | ❌ No |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a security issue, email: **security@[your-domain].com**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive a response within **48 hours**. If the vulnerability is confirmed, we aim to release a fix within **7 days** for critical issues.

## Security Measures in This Project

- All inputs validated with Zod schemas
- Markdown output sanitized with DOMPurify
- Firestore Security Rules enforce deny-all by default
- Content Security Policy applied via both meta tag and Cloudflare Pages headers
- No secrets committed — Firebase API keys are client-safe project identifiers
- Rate limiting on auth endpoints
- `rel="noopener noreferrer"` on all external links
- HTTPS-only resource URLs enforced by Zod schema

## Scope

In-scope for vulnerability reports:
- XSS via topic content or search
- Auth bypass or privilege escalation
- Firestore data access by unauthorized users
- Information disclosure via error messages

Out of scope:
- Issues requiring physical access to the user's device
- Social engineering attacks
- Attacks requiring a compromised browser extension
