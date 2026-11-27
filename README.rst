PodWin website
==============

The website and foundation documentation for PodWin, a native Windows 11 app
for WSLc container management. Canonical site: https://podwin.app/

This is a website-only repository with independent Git history. It contains
no PodWin application source, native build outputs, installers, credentials,
or application repository history. The application repository remains private.
Public website source does not change the application's licensing status.

Local preview
-------------

The site uses static HTML, CSS, JavaScript, and owner-supplied PodWin artwork.
No package installation or build step is required. From the repository root::

    python -m http.server 4173 --bind 127.0.0.1 --directory site

Open http://127.0.0.1:4173/ and http://127.0.0.1:4173/docs/.
Use ?scoutTheme=dark or ?scoutTheme=light to select a theme explicitly;
otherwise the site follows the system preference.

Validation
----------

Node.js 24 or later is sufficient; there are no npm dependencies::

    node --test tests\website\site.test.mjs

The checks cover local links, fragment targets, metadata, asset references,
theme selection, preview-status disclosures, and the publication boundary.
Browser acceptance also covers responsive layouts, keyboard tab controls,
no-JavaScript navigation, and reduced-motion behavior.

Publishing
----------

The Project website workflow validates pull requests. After owner approval,
GitHub Pages is configured to use GitHub Actions and the podwin.app custom
domain. Deployments run on main only when the repository variable
PODWIN_PAGES_ENABLED is explicitly true. Only site/ is published.

See tools/website/DEPLOYMENT.rst for the domain verification, Porkbun DNS,
alternate-domain redirects, HTTPS gates, and maintainer instructions.
Deployment configuration does not modify the native application's updater.

Contributions and content
-------------------------

Use an issue and focused pull request for website changes. Keep foundation
capabilities and limitations accurate; planned features are not available
features. Keep Store links, package identifiers, and installation instructions
aligned with the live Microsoft Store listing.

The inventory illustration uses sample data and is not an app screenshot.
The artwork is supplied by the PodWin owner; no third-party app assets or
fonts are redistributed. No separate brand-asset license is granted.

The site has no analytics, advertising, tracking cookies, or third-party
embedded scripts. GitHub Pages handles hosting under GitHub's privacy terms.
