import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(projectRoot, 'public');
const outputDirectory = resolve(projectRoot, 'standalone');
const outputFile = resolve(outputDirectory, 'Relaverse.html');
const result = await build({
  root: projectRoot,
  mode: 'standalone',
  base: './',
  build: {
    write: false,
    copyPublicDir: false,
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: Infinity,
    reportCompressedSize: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const assets = new Map(outputs.map(item => [item.fileName, item]));
const document = assets.get('index.html');
if (!document || document.type !== 'asset') throw new Error('Vite did not produce index.html.');

const mimeTypes = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const normalizedPath = url => decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\.?\//, '');
const assetText = url => {
  const asset = assets.get(normalizedPath(url));
  if (!asset) throw new Error(`Missing generated asset: ${url}`);
  return asset.type === 'chunk' ? asset.code : Buffer.from(asset.source).toString('utf8');
};
async function embeddedUrl(url, relativeTo = 'index.html') {
  if (/^(data:|#)/i.test(url)) return url;
  if (/^(https?:|\/\/)/i.test(url)) throw new Error(`Standalone build must not load external resources: ${url}`);
  const path = url.startsWith('/') ? normalizedPath(url) : posix.normalize(posix.join(posix.dirname(normalizedPath(relativeTo)), normalizedPath(url)));
  const generated = assets.get(path);
  let bytes;
  if (generated?.type === 'asset') bytes = Buffer.from(generated.source);
  else {
    const localPath = resolve(publicRoot, path);
    if (!localPath.startsWith(publicRoot + sep)) throw new Error(`Asset is outside public/: ${url}`);
    bytes = await readFile(localPath);
  }
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  const mime = mimeTypes[extension];
  if (!mime) throw new Error(`Unsupported embedded asset type: ${path}`);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}
async function inlineCss(css, filename) {
  const urls = [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)];
  const replacements = await Promise.all(urls.map(async match => [match[0], `url("${await embeddedUrl(match[2], filename)}")`]));
  for (const [from, to] of replacements) css = css.replaceAll(from, to);
  return css.replace(/<\/style/gi, '<\\/style');
}
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1];
let html = Buffer.from(document.source).toString('utf8');
const links = [...html.matchAll(/<link\b[^>]*>/gi)];
for (const [tag] of links) {
  const rel = attribute(tag, 'rel'), href = attribute(tag, 'href');
  if (!href) continue;
  if (rel === 'stylesheet') html = html.replace(tag, `<style>${await inlineCss(assetText(href), href)}</style>`);
  else if (rel === 'icon') html = html.replace(tag, tag.replace(href, await embeddedUrl(href)));
  else throw new Error(`Unexpected linked resource in standalone document: ${tag}`);
}
html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_, src) => {
  const code = assetText(src).replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${code}</script>`;
});

// Fail the build if a later feature accidentally reintroduces companion files.
if (/<script\b[^>]*\bsrc=/i.test(html) || /<link\b[^>]*\brel=["'](?:stylesheet|modulepreload)["']/i.test(html)) {
  throw new Error('Standalone document still references external scripts or styles.');
}
if (!html.includes('data:image/jpeg;base64,') || !html.includes('data:image/svg+xml;base64,')) {
  throw new Error('The painting and favicon must both be embedded in the HTML.');
}
for (const stylesheet of html.matchAll(/<style>([\s\S]*?)<\/style>/gi)) {
  if ([...stylesheet[1].matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].some(match => !/^(data:|#)/i.test(match[2]))) {
    throw new Error('A stylesheet still references an external resource.');
  }
}
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, html, 'utf8');
const files = await readdir(outputDirectory);
console.log(`\nStandalone HTML: ${outputFile}`);
console.log(`Size: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
console.log('JavaScript, CSS, painting, and favicon are embedded. No server or companion files required.');
if (files.length !== 1) console.log('Other files already exist in standalone/; only Relaverse.html is needed for sharing.');
