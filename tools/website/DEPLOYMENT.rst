PodWin website operations
=========================

This file is for maintainers, outside the published directory. The website root
is site/. Only that directory is uploaded by .github/workflows/pages.yml.
This is the separate swigerb/podwin.app website repository. It must not acquire
native application source, build outputs, or history from swigerb/PodWin.
Tests, operations guidance, and repository metadata are not website artifacts.
The deployment job is disabled until PODWIN_PAGES_ENABLED is explicitly true.
No CNAME file is used: with an Actions publishing source, configure the custom
domain in the repository Pages settings, not in an ignored CNAME file.

Local development
-----------------

No dependency installation or build step is required. From the repository root::

    node --test tests\website\site.test.mjs
    python -m http.server 4173 --bind 127.0.0.1 --directory site

Open http://127.0.0.1:4173/ and /docs/. The custom 404 page assumes the final
custom-domain root, not the temporary github.io/PodWin project subpath.
This repository contains website validation only, not native app CI.

Content and assets
------------------

The site reflects the application's documented foundation. Its application
source is private; only owner-approved public product details belong here.
Do not add download links, open-source claims, a Store badge, or an update URL
before the corresponding release/license decisions. The inventory illustration
is explicitly labeled synthetic, not an application screenshot.

The owner supplied the PodWin original-art PNG exports and website icons.
The horizontal suffix denotes the intended background. Their source is the
owner's branding folder; the site does not use the separately adapted SVG.
No third-party app artwork, fonts, JavaScript, or analytics are loaded.
No separate brand-asset license is granted by this website.

Publication gates
-----------------

1. Owner approves publication of the exact site content and selected artwork.
   The project was private with no license or public release when this site
   was prepared. Do not change visibility or choose a license implicitly.
2. The owner selected a separate public website-only repository:
   swigerb/podwin.app. Create it with independent history and only the
   reviewed website files. Do not copy or publish the app repository's
   history, README, Squad state, native source, or settings.
3. Bootstrap main with the approved initial website commit. Subsequent
   changes use issues and reviewed PRs; keep Website validation green.
4. In the swigerb account's Pages settings, add podwin.app to the verified
   domain list. Obtain GitHub's exact TXT challenge and add only that TXT at
   Porkbun. Complete verification and retain the TXT record.
5. Enable repository Pages with GitHub Actions as its source. Set the custom
   domain to podwin.app BEFORE adding GitHub-serving DNS records.
6. Configure a github-pages environment restricted to main, with any desired
   reviewer gate. Set repository variable PODWIN_PAGES_ENABLED=true only
   after owner approval, then run Project website on main.
7. Apply the DNS/redirect plan below, inspect Pages' DNS and TLS status, and
   enable Enforce HTTPS once its certificate is available. Certificate
   issuance and DNS propagation are asynchronous; do not claim readiness
   while either is pending.

Porkbun routing plan
-------------------

Inspect/export current records before changing anything. Preserve unrelated
MX, TXT, DKIM, SPF, DMARC, and other service records. Remove only conflicting
parking/forwarding A, AAAA, ALIAS, or CNAME records after owner approval.
Do not add wildcard records pointed at GitHub Pages.

The initial read-only inspection found parking apex ALIAS and wildcard CNAME
records on podwin.app, podwin.org, and podwinapp.dev. podwinapp.com has a
configured Link In Bio 302 forward with uixie.porkbun.com serving records;
replacing it is an explicit part of the approval, not an additive change.
podwinapp.com and podwinapp.net have Porkbun mail-forwarding MX/SPF records
that must remain. Preserve existing ACME TXT records too. Re-read everything
before applying changes; these observations are not a current-state lock.

For podwin.app, add four apex A records (host blank or @ per Porkbun's UI)::

    185.199.108.153
    185.199.109.153
    185.199.110.153
    185.199.111.153

Add www CNAME -> swigerb.github.io (no repository path). With the apex bound
in Pages, GitHub handles www -> https://podwin.app canonical redirection.
IPv6 is optional; do not retain conflicting parking AAAA records. If IPv6
is enabled, use all four addresses in GitHub's current documentation.

For each alternate below, configure Porkbun URL Forwarding for the apex
and www explicitly (not arbitrary wildcard subdomains)::

    podwinapp.com
    podwin.org
    podwinapp.dev
    podwinapp.net

Destination: https://podwin.app
Type: 301 Permanent Redirect, not masked.
Include the requested URI path: enabled.
Confirm query-string behavior with a real request; do not assume it.
Forwarding must support HTTPS with a valid certificate on each source host.
This is essential for .dev, which browsers force to HTTPS through HSTS.
If Porkbun cannot provision HTTPS forwarding, stop and obtain approval for
an HTTPS-capable redirect service; DNS alone cannot perform HTTP redirects.

Acceptance
----------

* https://podwin.app/ and /docs/ return the intended pages.
* www redirects to the apex over valid HTTPS.
* HTTP upgrades to HTTPS; /missing-page returns the branded 404 with HTTP 404.
* Every alternate apex and www host returns a permanent redirect over HTTP
  and HTTPS. Test /docs/ and a query string, not only /.
* Canonicals, social images, icons, sitemap, and robots resolve on podwin.app.
* .app and .dev work without certificate warnings (both are HSTS-preloaded).
* No email or unrelated DNS service is disturbed.

Keep Velopack unchanged
----------------------

The current app has no configured update feed. This website is not a
Velopack feed and does not provide /releases/. A future GitHub Releases
source or CDN needs its own signed-release and updater implementation.
Do not point the updater at an HTML page or create a fictional feed URL.

References
----------

* https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
* https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages
* https://kb.porkbun.com/article/39-how-to-set-up-url-forwarding
