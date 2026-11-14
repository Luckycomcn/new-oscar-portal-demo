# Contributing

Thanks for your interest in improving this demonstration portal. Issues, bug reports, documentation fixes and pull requests are welcome.

This is a demonstration application, not an operational WMO service. Contributions should keep the portal read-only: station metadata comes from the WIGOS Global Observing Facility Catalogue (GOFC), and the portal never writes back to it.

## Getting started

Requirements and commands are in [README.md](README.md):

```bash
npm ci
npm run dev      # Vite development server
npm run build    # vue-tsc type check + production build
npm run preview  # serve the production build locally
```

Use the Node.js and npm versions listed under "Requirements" in the README. Do not commit `node_modules/`, `dist/`, `.env*` files or `package-lock.json` churn unrelated to a dependency change.

## Before opening an issue

- Check whether the behaviour is already described in the README or the FAQ.
- Reproduce against the latest `main` with `npm run build`.
- Include the browser and OS, the page URL (hash route), the WIGOS station identifier when relevant, the expected and observed result, and any console errors.
- Remember that live station queries, map tiles and basemap providers need external network access. A blank map or a `—` statistic can be a network/service issue rather than an application defect.

## Pull requests

- Fork the repository, create a topic branch from `main`, and keep one logical change per pull request.
- Describe what changed, why, and how you verified it. Include screenshots for visual changes.
- Run `npm run build` before submitting; the type-check stage must pass with no `vue-tsc` errors.
- Do not add files copied from the current OSCAR/Surface website or other third-party sites (including stylesheets, scripts, fonts, logos and images). See [NOTICE](NOTICE) for the licensing boundary. Reference vocabularies belong in `src/data/` and must carry their source.
- Update all four locales in `src/i18n/locales/` (`en`, `zh`, `fr`, `es`) when adding or changing a user-visible message; English is the fallback.
- Hash routes are declared in `src/router/index.ts`; new pages need a navigation entry in both `AppNavbar.vue` and the mobile menu in `AppLayout.vue`.
- To refresh the programme/network filter options from the WMO codelist, run `npm run refresh:wmdr-codes` and commit the regenerated `src/data/programAffiliations.json`.

## Code and licensing

- Vue 3 single-file components with the Composition API, TypeScript and scoped SCSS.
- Independently authored code is released under the [Apache License 2.0](LICENSE). By submitting a contribution you agree that it is licensed under the same terms, and that you have the right to submit it.
- Third-party dependencies keep their own licences. WMO/OSCAR names and catalogue data remain the property of their respective owners; this project does not imply WMO endorsement.
- Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
