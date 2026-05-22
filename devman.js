#!/usr/bin/env node

import { execSync } from 'child_process';
import readline from 'readline';
import path from 'path';

// ── ANSI ──────────────────────────────────────────────────────────────────────
const R      = '\x1b[0m';
const B      = (s) => `\x1b[1m${s}${R}`;
const DIM    = (s) => `\x1b[2m${s}${R}`;
const fg     = (n, s) => `\x1b[38;5;${n}m${s}${R}`;
const GREEN  = (s) => fg(82,  s);
const RED    = (s) => fg(203, s);
const YELLOW = (s) => fg(220, s);
const CYAN   = (s) => fg(117, s);
const GRAY   = (s) => fg(245, s);
const WHITE  = (s) => fg(255, s);
const ORANGE = (s) => fg(214, s);
const PURPLE = (s) => fg(183, s);

const CLR  = '\x1b[2J\x1b[H';
const HIDE = '\x1b[?25l';
const SHOW = '\x1b[?25h';

const plain   = (s) => s.replace(/\x1b\[[^m]*m/g, '');
const visLen  = (s) => plain(s).length;
const pad     = (s, n) => { const d = n - visLen(s); return d <= 0 ? s : s + ' '.repeat(d); };
const truncAt = (s, n) => { const p = plain(s); return p.length <= n ? p : p.slice(0, n - 1) + '…'; };

// ── Dev filter ────────────────────────────────────────────────────────────────
const DEV_PATTERNS = [
  /\bnode\b/i, /\bbun\b/i, /\bdeno\b/i,
  /\bpython\b/i, /\bpython3\b/i, /\buvicorn\b/i, /\bgunicorn\b/i, /\bflask\b/i, /\bdjango\b/i,
  /\bruby\b/i, /\brails\b/i, /\bpuma\b/i,
  /\bphp\b/i, /\bartisan\b/i,
  /\bjava\b/i, /\bspring\b/i, /\bgradle\b/i,
  /\bgo\b/i, /\bcargo\b/i, /\brust\b/i,
  /\bnginx\b/i, /\bcaddy\b/i, /\bapache\b/i,
  /\bvite\b/i, /\bnext\b/i, /\bnuxt\b/i, /\bwebpack\b/i, /\bparcel\b/i,
  /\belixir\b/i, /\bphoenix\b/i, /\bmix\b/i,
  /\bjupyter\b/i, /\bstorybook\b/i,
  /\bnpx\b/i, /\bpnpm\b/i, /\byarn\b/i,
];

const SYS_BLOCK = [
  /^ControlCe/i, /^OneDrive/i, /^rapportd/i, /^USBAppCon/i,
  /^WorkflowA/i, /^WorkflowKit/i, /^com\./i,
  /^launchd/i, /^kernel/i, /^loginwindow/i, /^mds/i,
  /^coreaudio/i, /^bluetooth/i, /^notifyd/i, /^configd/i,
  /^airportd/i, /^netbiosd/i, /^awdd/i, /^bird\b/i,
  /^cloudd/i, /^dasd/i, /^symptomsd/i,
  /^trustd/i, /^secd\b/i, /^securityd/i, /^authd/i,
  /^vmnet/i, /^vpnkit/i, /^hyperkit/i,
  /^diskarb/i, /^diskmanagementd/i, /^fseventsd/i,
];

const isDevProc = (name, cmd) => {
  if (SYS_BLOCK.some(r => r.test(name))) return false;
  return DEV_PATTERNS.some(r => r.test(name + ' ' + (cmd || '')));
};

// ── Label builder ─────────────────────────────────────────────────────────────
function buildLabel(name, cmdline) {
  if (!cmdline) return name;
  const args = cmdline.split(/\s+/);
  const cmd  = cmdline.toLowerCase();
  if (/^(node|bun|deno)$/i.test(name)) {
    if (cmd.includes('vite'))      return 'node · vite';
    if (cmd.includes('next'))      return 'node · next.js';
    if (cmd.includes('nuxt'))      return 'node · nuxt';
    if (cmd.includes('webpack'))   return 'node · webpack';
    if (cmd.includes('storybook')) return 'node · storybook';
    if (cmd.includes('ts-node'))   return 'ts-node';
    if (cmd.includes('nodemon'))   return 'node · nodemon';
    if (cmd.includes('jest'))      return 'node · jest';
    if (cmd.includes('vitest'))    return 'node · vitest';
    const script = args.find(a => /\.(js|ts|mjs|cjs)$/.test(a) && !a.startsWith('-'));
    if (script) return `node · ${script.split('/').pop().replace(/\.(js|ts|mjs|cjs)$/, '')}`;
    return name;
  }
  if (/^python/.test(name.toLowerCase())) {
    const mIdx = args.indexOf('-m');
    if (mIdx !== -1 && args[mIdx + 1]) return `python · ${args[mIdx + 1]}`;
    const script = args.find(a => a.endsWith('.py'));
    if (script) return `python · ${script.split('/').pop().replace('.py', '')}`;
    return 'python';
  }
  if (/^ruby/.test(name.toLowerCase())) {
    if (cmd.includes('rails')) return 'ruby · rails';
    if (cmd.includes('puma'))  return 'ruby · puma';
  }
  return name;
}

// ── CWD / path resolver ───────────────────────────────────────────────────────
function getCwd(pid) {
  try {
    if (process.platform === 'linux') {
      return execSync(`readlink /proc/${pid}/cwd 2>/dev/null`, { encoding: 'utf8' }).trim();
    } else if (process.platform === 'darwin') {
      // lsof -p <pid> -a -d cwd gives us the cwd
      const out = execSync(`lsof -p ${pid} -a -d cwd -Fn 2>/dev/null`, { encoding: 'utf8' });
      const match = out.match(/\nn(.+)/);
      return match ? match[1].trim() : '';
    }
  } catch (_) {}
  return '';
}

// Shorten path: replace $HOME with ~, then if still long show …/last2/parts
function shortPath(p, maxLen = 50) {
  if (!p) return '';
  const home = process.env.HOME || '';
  if (home && p.startsWith(home)) p = '~' + p.slice(home.length);
  if (p.length <= maxLen) return p;
  const parts = p.split('/');
  // Keep last 3 segments
  return '…/' + parts.slice(-3).join('/');
}

// ── Process info helpers ──────────────────────────────────────────────────────
function getCmdline(pid) {
  try { return execSync(`ps -p ${pid} -o args= 2>/dev/null`, { encoding: 'utf8' }).trim(); } catch (_) { return ''; }
}
function getProcName(pid) {
  try { return execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: 'utf8' }).trim(); } catch (_) { return 'unknown'; }
}
function getCPU(pid) {
  try { return parseFloat(execSync(`ps -p ${pid} -o %cpu= 2>/dev/null`, { encoding: 'utf8' }).trim()) || 0; } catch (_) { return 0; }
}
function getMem(pid) {
  try {
    const kb = parseInt(execSync(`ps -p ${pid} -o rss= 2>/dev/null`, { encoding: 'utf8' }).trim());
    if (isNaN(kb)) return '?';
    return kb > 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)}G`
         : kb > 1024        ? `${(kb / 1024).toFixed(0)}M`
         : `${kb}K`;
  } catch (_) { return '?'; }
}
function getStarted(pid) {
  try {
    const raw = execSync(`ps -p ${pid} -o lstart= 2>/dev/null`, { encoding: 'utf8' }).trim();
    return raw ? new Date(raw) : null;
  } catch (_) { return null; }
}

// ── Port scanner ──────────────────────────────────────────────────────────────
function getListeningProcesses() {
  const platform = process.platform;
  const procs = [];
  try {
    let raw = '';
    if (platform === 'linux') {
      raw = execSync("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null", { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } else if (platform === 'darwin') {
      raw = execSync("lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null", { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    }

    if (platform === 'linux') {
      for (const line of raw.split('\n').filter(l => l.includes('LISTEN'))) {
        const portMatch = line.match(/:(\d+)\s/);
        const pidMatch  = line.match(/pid=(\d+)/);
        const nameMatch = line.match(/\("([^"]+)",/);
        if (!portMatch || !pidMatch) continue;
        const port = parseInt(portMatch[1]);
        if (port < 1024 || port > 65000) continue;
        const pid     = parseInt(pidMatch[1]);
        const rawName = nameMatch ? nameMatch[1] : getProcName(pid);
        const cmdline = getCmdline(pid);
        if (!isDevProc(rawName, cmdline)) continue;
        const cwd = getCwd(pid);
        procs.push({ port, pid, name: buildLabel(rawName, cmdline), cwd, cpu: getCPU(pid), mem: getMem(pid), started: getStarted(pid) });
      }
    } else if (platform === 'darwin') {
      for (const line of raw.split('\n').slice(1).filter(Boolean)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) continue;
        const rawName   = parts[0];
        const pid       = parseInt(parts[1]);
        const portMatch = parts[8].match(/:(\d+)$/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1]);
        if (port < 1024 || port > 65000) continue;
        const cmdline = getCmdline(pid);
        if (!isDevProc(rawName, cmdline)) continue;
        const cwd = getCwd(pid);
        procs.push({ port, pid, name: buildLabel(rawName, cmdline), cwd, cpu: getCPU(pid), mem: getMem(pid), started: getStarted(pid) });
      }
    }
  } catch (_) {}

  const SELF_PIDS = new Set([process.pid, process.ppid].filter(Boolean));
  const seen = new Set();
  return procs
    .filter(p => !SELF_PIDS.has(p.pid))
    .filter(p => { if (seen.has(p.port)) return false; seen.add(p.port); return true; })
    .sort((a, b) => a.port - b.port);
}

function killProc(pid) {
  try { process.kill(pid, 'SIGTERM'); return true; }
  catch (_) { try { execSync(`kill -9 ${pid} 2>/dev/null`); return true; } catch (__) { return false; } }
}

// ── Uptime ────────────────────────────────────────────────────────────────────
function uptime(d) {
  if (!d) return '?';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s) || s < 0) return '?';
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${s % 60}s`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}

// ── CPU bar ───────────────────────────────────────────────────────────────────
function cpuBar(val, barCount = 8) {
  const pct   = Math.min(val, 100);
  const bars  = Math.round((pct / 100) * barCount);
  const color = pct > 70 ? RED : pct > 30 ? ORANGE : GREEN;
  return color('█'.repeat(bars)) + GRAY('░'.repeat(barCount - bars)) + ` ${pct.toFixed(1)}%`;
}

// ── Render ────────────────────────────────────────────────────────────────────
let selected    = 0;
let processes   = [];
let logs        = [];
let lastRefresh = Date.now();

function cols() { return process.stdout.columns || 100; }

// Draw a full-width horizontal rule char-string
const hr = () => '─'.repeat(cols() - 2);

// Build a row — two-line design:
//   line 1:  ▶  NAME (bold)          :PORT   [K] kill
//   line 2:     ~/path/to/project     pid  cpu▓▓▓  mem  uptime
function drawEntry(p, isSelected) {
  const W     = cols();
  const inner = W - 2;           // space between │ chars
  const hi    = isSelected ? (s) => `\x1b[48;5;234m${s}\x1b[49m` : (s) => s;
  const pfx   = isSelected ? CYAN('▶ ') : '  ';  // 2 chars

  // ── Line 1: name + port + kill ───────────────────────────────────────────
  const killLabel  = isSelected ? RED('[K] kill') : GRAY('  kill  ');
  const killLen    = 10;
  const portStr    = CYAN(`:${p.port}`);
  const portLen    = 1 + String(p.port).length + 2; // ":XXXXX  "
  const nameAvail  = inner - 2 - portLen - killLen - 2;
  const nameStr    = hi(B(WHITE(truncAt(p.name, nameAvail))));

  const line1 = CYAN('│')
    + pfx
    + pad(nameStr, nameAvail)
    + pad(hi(portStr), portLen)
    + '  '
    + killLabel
    + CYAN('│');

  // ── Line 2: path + pid + cpu + mem + uptime ──────────────────────────────
  const pidStr  = GRAY(`pid:${p.pid}`);
  const cpuStr  = cpuBar(p.cpu, 6);   // 6-block bar + " XX.X%"  ≈ 13 chars visible
  const memStr  = YELLOW(p.mem);
  const upStr   = GRAY(uptime(p.started));

  // Fixed-width right section: "  pid:XXXXX  ░░░░░░ XX.X%  XXM  XXhXXm  "
  const rightFixed = `  ${plain(pidStr)}  ${'░'.repeat(6)} XX.X%  ${plain(memStr)}  ${plain(upStr)}  `;
  const pathAvail  = inner - 2 - rightFixed.length;
  const pathDisp   = p.cwd ? PURPLE(truncAt(shortPath(p.cwd, pathAvail), pathAvail)) : GRAY('path unknown');

  const rightPart  = '  ' + pidStr + '  ' + cpuStr + '  ' + memStr + '  ' + upStr + '  ';
  const rightPad   = inner - 2 - visLen(pathDisp) - visLen(rightPart);

  const line2 = CYAN('│')
    + '  '
    + pathDisp
    + ' '.repeat(Math.max(0, rightPad))
    + rightPart
    + CYAN('│');

  return [line1, line2];
}

function render() {
  const W     = cols();
  const inner = W - 2;
  const lines = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  const title   = ' devman — dev process manager ';
  const hLeft   = '──';
  const hRight  = '─'.repeat(Math.max(0, inner - hLeft.length - title.length));
  lines.push('');
  lines.push(CYAN('╭' + hLeft) + B(WHITE(title)) + CYAN(hRight + '╮'));

  // ── Column headers ──────────────────────────────────────────────────────────
  const hdr = pad('  ' + 'APP', Math.floor(inner * 0.45))
            + pad('PORT', 10)
            + pad('', inner - Math.floor(inner * 0.45) - 10 - 8)
            + 'ACTION';
  lines.push(CYAN('│') + DIM(pad(hdr, inner)) + CYAN('│'));
  lines.push(CYAN('├' + hr() + '┤'));

  // ── Process rows ────────────────────────────────────────────────────────────
  if (processes.length === 0) {
    const msg = pad('  ' + GRAY('no dev processes found — start a dev server and press r'), inner);
    lines.push(CYAN('│') + msg + CYAN('│'));
  } else {
    for (let i = 0; i < processes.length; i++) {
      const [l1, l2] = drawEntry(processes[i], i === selected);
      lines.push(l1);
      lines.push(l2);
      // thin separator between entries (not after last)
      if (i < processes.length - 1) {
        lines.push(CYAN('│') + GRAY('·'.repeat(inner)) + CYAN('│'));
      }
    }
  }

  // ── Log area ────────────────────────────────────────────────────────────────
  lines.push(CYAN('├' + hr() + '┤'));
  const logLines = [...logs.slice(-3)];
  while (logLines.length < 3) logLines.unshift('');
  for (const l of logLines) {
    lines.push(CYAN('│') + ' ' + pad(l, inner - 1) + CYAN('│'));
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  lines.push(CYAN('├' + hr() + '┤'));
  const keys = DIM('↑↓') + ' nav  ' + RED('k') + ' kill  ' + GRAY('r') + ' refresh  ' + DIM('q') + ' quit';
  const ts   = GRAY('scan: ' + new Date(lastRefresh).toLocaleTimeString());
  const footerPad = inner - visLen(plain(keys).replace(/\x1b\[[^m]*m/g,'')) - visLen(plain(ts)) - 6;
  lines.push(CYAN('│') + '  ' + keys + ' '.repeat(Math.max(2, footerPad)) + ts + '  ' + CYAN('│'));
  lines.push(CYAN('╰' + hr() + '╯'));
  lines.push('');

  process.stdout.write(CLR + lines.join('\n'));
}

// ── State mutators ────────────────────────────────────────────────────────────
function addLog(msg) {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  logs.push(GRAY(`[${ts}] `) + msg);
  if (logs.length > 30) logs.shift();
}

function refresh() {
  processes = getListeningProcesses();
  lastRefresh = Date.now();
  if (selected >= processes.length) selected = Math.max(0, processes.length - 1);
  const n = processes.length;
  addLog(`scanned — found ${GREEN(String(n))} dev process${n !== 1 ? 'es' : ''}`);
  render();
}

function killSelected() {
  if (!processes.length) return;
  const p = processes[selected];
  if (killProc(p.pid)) {
    addLog(`${RED('killed')} ${B(p.name)} ${GRAY('pid:' + p.pid)} — port ${CYAN(':' + p.port)} freed`);
    processes.splice(selected, 1);
    if (selected >= processes.length) selected = Math.max(0, processes.length - 1);
  } else {
    addLog(`${YELLOW('warn')} could not kill ${B(p.name)} — try sudo`);
  }
  render();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
process.stdout.write(HIDE);
process.on('exit',   () => process.stdout.write(SHOW + '\n'));
process.on('SIGINT', () => { process.stdout.write(SHOW + '\n'); process.exit(0); });

// Re-render on terminal resize
process.stdout.on('resize', render);

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (_ch, key) => {
  if (!key) return;
  if (key.name === 'q' || (key.ctrl && key.name === 'c')) { process.stdout.write(SHOW + '\n'); process.exit(0); }
  if (key.name === 'up')   { selected = Math.max(0, selected - 1); render(); }
  if (key.name === 'down') { selected = Math.min(processes.length - 1, selected + 1); render(); }
  if (key.name === 'k')    { killSelected(); }
  if (key.name === 'r')    { addLog('refreshing…'); render(); setTimeout(refresh, 50); }
});

// Auto-refresh every 5s
setInterval(() => { processes = getListeningProcesses(); lastRefresh = Date.now(); render(); }, 5000);

addLog('starting devman…');
refresh();
