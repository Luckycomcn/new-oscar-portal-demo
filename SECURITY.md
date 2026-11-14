# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem. Report it privately so it can be fixed before details are disclosed:

- use GitHub's "Report a vulnerability" (private vulnerability reporting) on this repository, or
- send a direct message to a repository maintainer.

Include the affected version/commit, the page or endpoint, reproduction steps, the impact, and any suggested mitigation. You will receive an acknowledgement once the report has been reviewed. Please follow the [contribution guidelines](CONTRIBUTING.md) when submitting a fix.

## Supported versions

This is a demonstration portal (`0.0.0`). Security fixes are applied to the `main` branch only; released demo builds are replaced rather than patched.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older demo builds | No |

## Scope

The portal is a read-only client of the WIGOS Global Observing Facility Catalogue. Vulnerabilities in the catalogue service, map tile providers, or third-party npm dependencies should be reported to those projects directly. Configuration secrets (basemap keys, proxy credentials) belong in `.env*` files, which are excluded from version control; never commit real keys or paste them into an issue.
