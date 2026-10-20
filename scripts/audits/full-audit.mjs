// 汇总审计（native setter 修正版）：后台编辑器 + 前端全部
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import CDP from 'chrome-remote-interface';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9453;
const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--hide-scrollbars', '--window-size=1280,850', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(250); } }
const client = await CDP({ port });
const { Page, Runtime } = client;
await Page.enable();
let pass = 0, fail = 0;
const T = (n, ok, e = '') => { ok ? pass++ : fail++; console.log((ok ? '✓' : '✗ FAIL') + ' ' + n + (e ? ' | ' + e : '')); };
const nativeInput = (sel, val) => `(function(){
  const el = document.querySelector('${sel}'); if (!el) return 'no-el';
  const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (el.tagName === 'INPUT') el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`;

// ===== 后台编辑器 =====
await Page.navigate({ url: 'http://127.0.0.1:4322/admin/login' }).catch(() => {});
await sleep(1000);
await Runtime.evaluate({ expression: `(function(){ document.querySelector('input[name=username]').value='scio'; document.querySelector('input[name=password]').value='test123456'; document.querySelector('form').submit(); })()` });
await sleep(1500);
await Runtime.evaluate({ expression: `location.href='/admin/notes/new'` });
await sleep(3500);
let r = await Runtime.evaluate({ expression: nativeInput('#f-title', '终审-自动保存'), returnByValue: true });
await sleep(2300);
r = await Runtime.evaluate({ expression: `document.getElementById('savemark').textContent`, returnByValue: true });
T('编辑器自动保存', String(r.result.value).includes('已保存'), r.result.value);
void 0;
// 预览
await Runtime.evaluate({ expression: nativeInput('#f-body', '# 标题\n\n**加粗**测试') });
await sleep(800);
await Runtime.evaluate({ expression: `document.getElementById('btn-preview').click()` });
await sleep(700);
r = await Runtime.evaluate({ expression: `(function(){ const pv = document.getElementById('preview'); return pv.style.display === 'block' && !!pv.querySelector('h1') && !!pv.querySelector('strong'); })()`, returnByValue: true });
T('预览分屏（H1+加粗渲染）', r.result.value === true);

// ===== 前端交互复验（上次探索态误报修正：hero opacity 判据）=====
await Page.navigate({ url: 'http://127.0.0.1:4321/' }).catch(() => {});
await sleep(6500);
await Runtime.evaluate({ expression: `(function(){ const b=[...document.querySelectorAll('button,a')].find(x=>/explore/i.test(x.textContent)); b.click(); })()` });
await sleep(3500);
r = await Runtime.evaluate({ expression: `(function(){
  const hero = document.querySelector('.hero');
  return JSON.stringify({
    exit: [...document.querySelectorAll('button')].some(b=>/exit/i.test(b.textContent)),
    heroOp: hero ? getComputedStyle(hero).opacity : 'n/a',
  });
})()`, returnByValue: true });
const e = JSON.parse(r.result.value);
T('探索态（EXIT + hero 视觉隐藏）', e.exit && e.heroOp === '0', `heroOp=${e.heroOp}`);
await Runtime.evaluate({ expression: `(function(){ const b=[...document.querySelectorAll('button')].find(x=>/exit/i.test(x.textContent)); b.click(); })()` });
await sleep(2500);
r = await Runtime.evaluate({ expression: `getComputedStyle(document.querySelector('.hero')).opacity`, returnByValue: true });
T('退出恢复 hero', r.result.value !== '0', `op=${r.result.value}`);

console.log(`\n===== 终审: ${pass} 通过 / ${fail} 失败 =====`);
edge.kill(); process.exit(fail ? 1 : 0);
