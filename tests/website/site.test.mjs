import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../../site/", import.meta.url));
const origin = "https://podwin.app";
const contactLinks = ["support", "info", "security", "privacy"].map((name) => `mailto:${name}@podwin.app`);
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
        assert.ok(match[0].startsWith("href=") && contactLinks.includes(match[1]), `Unexpected email link: ${match[0]}`);
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
  assert.deepEqual(locations.sort(), [`${origin}/`, `${origin}/docs/`]);
  assert.match(await readFile(path.join(root, "robots.txt"), "utf8"), /Sitemap: https:\/\/podwin\.app\/sitemap\.xml/);
});

test("the preview discloses sample data and private-source/release limitations", async () => {
  const home = await readFile(path.join(root, "index.html"), "utf8");
  const docs = await readFile(path.join(root, "docs", "index.html"), "utf8");
  assert.match(home, /not a screenshot or a live runtime connection/);
  assert.match(home, /No public installer yet/);
  assert.match(home, /repository is currently private/);
  assert.match(docs, /no source-code license has been selected/i);
  assert.match(docs, /Compose file parsing, validation, planning, and execution/);
  assert.match(docs, /No public installer, automatic update feed, or Microsoft Store listing/);
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
