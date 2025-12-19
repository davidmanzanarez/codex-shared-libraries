# ⚠️ SECURITY WARNING - PUBLIC REPOSITORY

**This repository is PUBLIC. Anyone can read this code.**

## What MUST NEVER Be Added Here

- ❌ API keys, tokens, or secrets of any kind
- ❌ Passwords or credentials
- ❌ Internal IP addresses or server hostnames
- ❌ Database connection strings
- ❌ Environment variable VALUES (only names as examples)
- ❌ Specific rate limit configurations used in production
- ❌ Security vulnerability details about the Dodekatloi system
- ❌ User data or PII
- ❌ Private keys or certificates

## What IS Safe Here

- ✅ Generic middleware logic (rate limiting mechanism, not actual limits)
- ✅ Generic auth patterns (JWT verification logic, not secrets)
- ✅ Type definitions
- ✅ Utility functions
- ✅ Example code with placeholder values

## For Claude Code / AI Assistants

**IMPORTANT:** When working on this repository:

1. **NEVER** add hardcoded secrets, even as examples
2. **NEVER** add actual production configuration values
3. **ALWAYS** use placeholder values like `'your-secret-here'` or `process.env.SECRET`
4. **ALWAYS** check your changes against this list before committing
5. **ASK** the user before adding any new files if unsure about security implications

## Reporting Security Issues

If you discover sensitive information in this repository, please:
1. Do NOT create a public issue
2. Contact the repository owner directly
3. The information will be removed and git history will be rewritten if necessary
