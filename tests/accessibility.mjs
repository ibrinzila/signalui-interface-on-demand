import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowserHarness, browserAssert } from './browser-helpers.mjs';

await mkdir('artifacts/proof', { recursive: true });
const harness = await launchBrowserHarness({ width: 390, height: 844 });
const checks = [];
const check = (condition, message, detail = undefined) => { checks.push({ message, passed: Boolean(condition), ...(detail === undefined ? {} : { detail }) }); browserAssert(condition, message); };
try {
  await harness.client.evaluate(`window.SignalUIDemo.setProfile('operator-mobile')`);
  const dom = await harness.client.evaluate(`(() => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const buttons = [...document.querySelectorAll('button')].filter(visible);
    const unnamedButtons = buttons.filter(button => !(button.getAttribute('aria-label') || button.textContent.trim()));
    const smallTargets = buttons.map(button => ({ label: button.getAttribute('aria-label') || button.textContent.trim(), rect: button.getBoundingClientRect() }))
      .filter(item => item.rect.width < 44 || item.rect.height < 44)
      .map(item => ({ label: item.label, width: Math.round(item.rect.width), height: Math.round(item.rect.height) }));
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    const duplicates = ids.filter((id,index) => ids.indexOf(id) !== index);
    const imagesWithoutAlt = [...document.images].filter(image => !image.hasAttribute('alt')).map(image => image.src);
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map(node => ({ level: Number(node.tagName[1]), text: node.textContent.trim() }));
    return {
      lang: document.documentElement.lang,
      mainCount: document.querySelectorAll('main').length,
      h1Count: document.querySelectorAll('h1').length,
      skipLink: Boolean(document.querySelector('.skip-link[href="#workspace"]')),
      liveRegion: Boolean(document.querySelector('[role="status"][aria-live]')),
      unnamedButtons,
      smallTargets,
      duplicates,
      imagesWithoutAlt,
      headings,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      reducedMotion: document.documentElement.dataset.reducedMotion,
      largeTargets: document.documentElement.dataset.largeTargets,
      explanationButton: Boolean(document.querySelector('[data-action="show-explanation"]')),
      fullWorkspaceButton: Boolean(document.querySelector('[data-action="show-full-workspace"]'))
    };
  })()`);
  check(dom.lang === 'en', 'Document language must be declared.');
  check(dom.mainCount === 1, 'Exactly one main landmark must be present.');
  check(dom.h1Count === 1, 'Each compiled page must expose exactly one level-one heading.');
  check(dom.skipLink, 'A skip link must target the active workspace.');
  check(dom.liveRegion, 'Command outcomes must be announced through a live region.');
  check(dom.unnamedButtons.length === 0, 'Every visible button must have an accessible name.', dom.unnamedButtons);
  check(dom.smallTargets.length === 0, 'Large-target mode must keep visible buttons at least 44 by 44 CSS pixels.', dom.smallTargets);
  check(dom.duplicates.length === 0, 'DOM IDs must be unique.', dom.duplicates);
  check(dom.imagesWithoutAlt.length === 0, 'Every evidence image must provide alternative text.', dom.imagesWithoutAlt);
  check(!dom.horizontalOverflow, 'The mobile surface must not overflow horizontally.');
  check(dom.reducedMotion === 'true' && dom.largeTargets === 'true', 'Explicit accessibility preferences must be projected into the document.');
  check(dom.explanationButton && dom.fullWorkspaceButton, 'Every adaptive surface must expose explanation and reversal controls.');

  const ax = await harness.client.send('Accessibility.getFullAXTree');
  const roles = ax.nodes.map((node) => node.role?.value).filter(Boolean);
  const names = ax.nodes.map((node) => node.name?.value).filter(Boolean);
  check(roles.includes('main'), 'Accessibility tree must contain the main landmark.');
  check(roles.includes('heading'), 'Accessibility tree must expose headings.');
  check(names.some((name) => String(name).includes('Why am I seeing this?')), 'Accessibility tree must expose the adaptation explanation control.');

  await harness.client.evaluate(`document.querySelector('[data-action="show-explanation"]').click()`);
  const panel = await harness.client.evaluate(`({
    hidden: document.getElementById('adaptation-explanation').hidden,
    activeName: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent.trim(),
    content: document.getElementById('adaptation-explanation').textContent
  })`);
  check(!panel.hidden, 'The explanation panel must be operable.');
  check(Boolean(panel.activeName), 'Opening the explanation must move focus into the panel.');
  check(panel.content.includes('What was not inferred'), 'The explanation must disclose non-inferences.');

  const report = { generatedAt: new Date().toISOString(), passed: true, checks, domSummary: dom };
  await writeFile('artifacts/proof/accessibility.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Accessibility checks passed (${checks.length}/${checks.length}).`);
} catch (error) {
  await writeFile('artifacts/proof/accessibility.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), passed: false, checks, error: String(error) }, null, 2)}\n`);
  throw error;
} finally {
  await harness.close();
}
