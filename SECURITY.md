# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to mail@ossrandom.com
3. Include a description of the vulnerability and steps to reproduce
4. Allow up to 48 hours for an initial response

We take security seriously and will work to address verified vulnerabilities promptly.

## Scope

ossDevSync runs as a **local development tool**. It:
- Listens on localhost only (not exposed to the network by default)
- Reads local filesystem paths provided by the user
- Stores data in a local SQLite database
- Does not transmit data to external services
