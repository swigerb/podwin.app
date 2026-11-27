import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../../site/", import.meta.url));
const origin = "https://podwin.app";
const contactLinks = ["support", "info", "security", "privacy"].map((name) => `mailto:${name}@podwin.app`);
const allowedEmailLinks = [...contactLinks, "mailto:brian@mightybs.com"];
const listFiles = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await listFiles(filename) : [filename]));
  }
  return files;
};
const files = await listFiles(root);
const pages = await Promise.all(files.filter((file) => file.endsWith(".html")).map(async (file) => ({
  file,
  source: await readFile(file, "utf8"),
  url: new URL(path.relative(root, file).split(path.sep).join("/").replace(/index\.html$/, ""), `${origin}/`),
})));

test("the published directory contains only intentional static website files", () => {
  const extensions = new Set([".html", ".css", ".js", ".png", ".ico", ".webmanifest", ".txt", ".xml"]);
  for (const file of files) {
    assert.ok(extensions.has(path.extname(file)) || path.basename(file) === ".nojekyll", file);
    assert.doesNotMatch(path.relative(root, file), /(?:^|[/\\])(?:\.git|\.squad|node_modules|src|artifacts)(?:[/\\]|$)/);
  }
});

test("the public repository remains website-only", async () => {
  const entries = await readdir(new URL("../../", import.meta.url));
  for (const privatePath of [
    "src", ".squad", ".mcp.json", ".vscode", "PodWin.slnx",
    "global.json", "NuGet.Config", "Directory.Build.props", "Directory.Packages.props",
  ]) {
    assert.ok(!entries.includes(privatePath), `Application content must not be published: ${privatePath}`);
  }
  const readme = await readFile(new URL("../../README.rst", import.meta.url), "utf8");
  assert.match(readme, /^PodWin website/);
  assert.match(readme, /independent Git history/);
});

for (const page of pages) {
  const name = path.relative(root, page.file);
  test(`${name}: semantic landmarks, metadata, image descriptions, and unique IDs`, () => {
    assert.match(page.source, /<!doctype html>/i);
    assert.match(page.source, /<html lang="en"/);
    assert.match(page.source, /<meta name="viewport"/);
    assert.equal((page.source.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    assert.equal((page.source.match(/<main(?:\s|>)/g) ?? []).length, 1);
    assert.match(page.source, /class="skip-link" href="#main"/);
    const ids = [...page.source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: duplicate IDs`);
    for (const image of page.source.matchAll(/<img\b[^>]*>/g)) {
      assert.match(image[0], /\balt="[^"]*"/);
      assert.match(image[0], /\bwidth="\d+"/);
      assert.match(image[0], /\bheight="\d+"/);
    }
    if (name !== "404.html") {
      assert.match(page.source, /<meta name="description" content="[^"]+"/);
      assert.ok(page.source.includes(`<link rel="canonical" href="${page.url.href}">`));
      assert.match(page.source, /property="og:image" content="https:\/\/podwin\.app\/assets\/podwin-banner\.png"/);
    }
  });

  test(`${name}: every local link, asset, and fragment resolves`, async () => {
    for (const match of page.source.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const target = new URL(match[1], page.url);
      if (target.protocol === "mailto:") {
        assert.ok(match[0].startsWith("href=") && allowedEmailLinks.includes(match[1]), `Unexpected email link: ${match[0]}`);
        continue;
      }
      if (target.origin !== origin) {
        assert.equal(target.protocol, "https:", `Unexpected external URL: ${target.href}`);
        continue;
      }
      const filename = path.join(root, decodeURIComponent(target.pathname));
      const resolved = target.pathname.endsWith("/") ? path.join(filename, "index.html") : filename;
      assert.ok((await stat(resolved)).isFile(), `${name}: ${match[1]}`);
      if (target.hash) {
        const source = await readFile(resolved, "utf8");
        assert.ok(source.includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `${name}: missing ${match[1]}`);
      }
    }
  });

  test(`${name}: no third-party embeds, tracking, or premature distribution claims`, () => {
    assert.doesNotMatch(page.source, /github\.com\/swigerb\/PodWin(?:[/"#?]|$)/i);
    assert.doesNotMatch(page.source, /<(?:script|img)\b[^>]*src="https?:/i);
    assert.doesNotMatch(page.source, /<iframe\b|<a\b[^>]*\sdownload(?:=|\s|>)/i);
    assert.doesNotMatch(page.source, /MIT[- ]licensed|<a\b[^>]*>[^<]*(?:Download (?:now|PodWin)|Get it from Microsoft)|fully compatible/i);
    assert.doesNotMatch(page.source, /on(?:click|load|error)=/i);
  });
}

test("manifest icons and sitemap use the intended domain and real assets", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "site.webmanifest"), "utf8"));
  assert.equal(manifest.display, "browser");
  for (const icon of manifest.icons) assert.ok((await stat(path.join(root, icon.src))).isFile());
  const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations.sort(), [`${origin}/`, `${origin}/docs/`, `${origin}/privacy/`]);
  assert.match(await readFile(path.join(root, "robots.txt"), "utf8"), /Sitemap: https:\/\/podwin\.app\/sitemap\.xml/);
});

test("the preview discloses sample data and private-source/release limitations", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const docs = await readFile(path.join(root, "docs", "index.html"), "utf8");
  assert.match(home, /not a screenshot or a live runtime connection/);
  assert.match(home, /No public installer yet/);
  assert.match(home, /repository is currently private/);
  for (const page of [home, docs]) {
    assert.match(page, /Apache License 2\.0/);
    assert.doesNotMatch(page, /license has not been selected|no source-code license has been selected|WSLc 3\.0\.3 or later/i);
  }
  assert.match(docs, /Compose file parsing, validation, planning, and execution/);
  assert.match(docs, /No public installer or Microsoft Store listing/);
});

test("the privacy policy page covers the distribution facts and is linked locally", async () => {
  const privacy = await readFile(path.join(root, "privacy", "index.html"), "utf8");
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const docs = await readFile(path.join(root, "docs", "index.html"), "utf8");
  assert.match(privacy, /Last updated: November 27, 2026/);
  assert.match(privacy, /PodWin is published on the Microsoft Store under the MightyB handle by Brian Swiger \(mightybs\.com\)/);
  assert.match(privacy, /support@podwin\.app/);
  assert.match(privacy, /usage analytics, advertising, behavioral tracking, or remote crash reporting/);
  assert.match(privacy, /Direct build/);
  assert.match(privacy, /Microsoft Store-managed updates|Store-managed updates/);
  assert.match(privacy, /Start at sign-in/);
  assert.match(privacy, /Microsoft Privacy Statement/);
  assert.match(privacy, /%USERPROFILE%\\\.podwin\\PodWin\.Sessions\.Store/);
  assert.match(privacy, /%USERPROFILE%\\\.podwin\\PodWin\.Sandboxes\.Store/);
  assert.match(privacy, /%LOCALAPPDATA%\\PodWin\.Sessions\.Direct/);
  assert.match(privacy, /%LOCALAPPDATA%\\PodWin\.Sandboxes\.Direct/);
  assert.doesNotMatch(privacy, /Store build (?:doesn&apos;t|doesn't) create PodWin-owned sessions/);
  assert.match(privacy, /Agent Sandboxes are available in both the Direct and Store builds/);
  assert.match(privacy, /sandbox containers run with networking disabled/);
  assert.match(privacy, /local named pipe secured to the current Windows account/);
  assert.match(privacy, /podwin-mcp\.exe/);
  assert.match(privacy, /PodWin\.McpServer\.exe/);
  assert.match(privacy, /Neither the listener nor the sidecar opens a network listener/);
  assert.match(privacy, /image reference to the chosen public registry only after consent/);
  assert.match(privacy, /private registry credentials/);
  assert.match(privacy, /ExcludeProfileDirs/);
  assert.match(privacy, /href="\.\.\/docs\/#remove-retained-data"/);
  assert.match(home, /href="privacy\/">Privacy/);
  assert.match(docs, /href="\.\.\/privacy\/">Privacy/);
});

test("the privacy and support content states the local-only and consent contracts", async () => {
  const privacy = await readFile(path.join(root, "privacy", "index.html"), "utf8");
  assert.match(privacy, /PodWin has zero app telemetry/);
  assert.match(privacy, /local, redacted, size-bounded diagnostics/);
  assert.match(privacy, /Diagnostic files remain on your device and are never uploaded/);
  assert.match(privacy, /explicitly confirmed as Running/);
  assert.match(privacy, /explicit consent before it creates, terminates, or otherwise mutates session state/);
  assert.match(privacy, /local MCP server is opt-in and its listener is off by default/);
  assert.match(privacy, /An agent's MCP request cannot start this removal/);
  const support = privacy.match(/<section id="support">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(support, "Missing support section");
  assert.match(support, /Windows 11 22H2 or later on x64 with Microsoft WSLc 3\.0\.3 or 3\.0\.4/);
  assert.match(support, /href="mailto:support@podwin\.app"/);
  assert.match(support, /href="mailto:brian@mightybs\.com"/);
  assert.match(support, /%PROGRAMFILES%\\WSL\\wslc\.exe/);
  assert.match(support, /does not search other locations or install, update, or elevate WSLc/);
  assert.match(support, /Discovery found no existing sessions; it does not create one/);
  assert.match(support, /A timeout, canceled read, or other error is not an empty inventory/);
  assert.match(support, /does not require deleting environment disks, running <code>wsl --shutdown<\/code>, or changing WSL configuration/);
  assert.match(support, /href="https:\/\/github\.com\/swigerb\/podwin\.app\/issues"/);
  assert.doesNotMatch(support, /github\.com\/swigerb\/PodWin(?:[/"#?]|$)/);
});

test("retained-data removal instructions cover both channels and registration guards", async () => {
  const docs = await readFile(path.join(root, "docs", "index.html"), "utf8");
  const section = docs.match(/<section id="remove-retained-data">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section, "Missing retained-data removal section");
  assert.match(section, /<h2>Remove retained PodWin data<\/h2>/);
  assert.match(section, /PodWin/);
  assert.match(section, /PodWinStore/);
  assert.match(section, /%LOCALAPPDATA%\\PodWin\.Sessions\.Direct/);
  assert.match(section, /%USERPROFILE%\\\.podwin\\PodWin\.Sessions\.Store/);
  assert.match(section, /%LOCALAPPDATA%\\PodWin\.Sandboxes\.Direct\\&lt;32-hex ID&gt;/);
  assert.match(section, /%USERPROFILE%\\\.podwin\\PodWin\.Sandboxes\.Store\\&lt;32-hex ID&gt;/);
  assert.equal((section.match(/read-only WSLc session list/g) ?? []).length, 4);
  assert.match(section, /do not remove any files/);
  assert.match(section, /Never remove the whole <code>\.podwin<\/code> directory or another session's directory/);
  assert.match(section, /<h3>Repair retained storage access<\/h3>/);
  assert.match(section, /storage\\storage\.vhdx/);
  assert.match(section, /owner-v2\.json/);
});

test("Pages deploys only the static directory after an explicit enablement gate", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /vars\.PODWIN_PAGES_ENABLED == 'true'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.event_name != 'pull_request'/);
  assert.match(workflow, /path: site\b/);
  assert.match(workflow, /needs: validate/);
  assert.doesNotMatch(workflow, /enablement:\s*true|secrets\./);
});

test("visitors can find and use all four project contacts without JavaScript", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const docs = await readFile(path.join(root, "docs", "index.html"), "utf8");
  assert.match(home, /href="docs\/#contact">Contact PodWin<\/a>/);
  const section = docs.match(/<section id="contact">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section, "Missing contact section");
  for (const href of contactLinks) {
    assert.ok(section.includes(`<a href="${href}">${href.slice("mailto:".length)}</a>`), href);
  }
});

test("theme bootstrap honors valid overrides and otherwise follows the system", async () => {
  const script = await readFile(path.join(root, "assets", "theme.js"), "utf8");
  for (const [search, prefersDark, expected] of [
    ["", true, "dark"], ["", false, "light"],
    ["?scoutTheme=light", true, "light"], ["?scoutTheme=dark", false, "dark"],
    ["?scoutTheme=invalid", true, "dark"], ["?scoutTheme=invalid", false, "light"],
  ]) {
    const document = { documentElement: { dataset: {} } };
    runInNewContext(script, {
      document,
      URLSearchParams,
      window: { location: { search }, matchMedia: () => ({ matches: prefersDark }) },
    });
    assert.equal(document.documentElement.dataset.theme, expected);
  }
});
