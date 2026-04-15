const fs = require('fs');

let code = fs.readFileSync('printing-press-app (1).jsx', 'utf8');

// Inject framer-motion import
code = 'import { motion, AnimatePresence } from "framer-motion";\n' + code;

// 1. CSS Injection: Deep Shadows, Blurred Glassmorphism
const OLD_ROOT = ":root{--bg:#f0f2f8;--surface:#fff;--surface2:#f7f8fc;--border:#e4e8f0;--accent:#4f67ff;--accent2:#7c3aed;--accent-soft:#eef0ff;--success:#10b981;--warning:#f59e0b;--danger:#ef4444;--text:#1a1d2e;--text2:#6b7280;--text3:#9ca3af;--shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.06);--shadow-lg:0 8px 32px rgba(0,0,0,.10);--radius:14px;--radius-sm:8px;--sw:240px;--font:'Sora',sans-serif;--mono:'JetBrains Mono',monospace;--t:.2s cubic-bezier(.4,0,.2,1)}";
const NEW_ROOT = ":root{--bg:#f0f2ff;--surface:rgba(255, 255, 255, 0.6);--surface2:rgba(255, 255, 255, 0.4);--border:rgba(255, 255, 255, 0.6);--accent:#4f67ff;--accent2:#7c3aed;--accent-soft:rgba(238, 240, 255, 0.7);--success:#10b981;--warning:#f59e0b;--danger:#ef4444;--text:#1a1d2e;--text2:#6b7280;--text3:#9ca3af;--shadow:0 10px 30px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02);--shadow-lg:0 25px 50px -12px rgba(79,103,255,0.15);--radius:16px;--radius-sm:10px;--sw:260px;--font:'Sora',sans-serif;--mono:'JetBrains Mono',monospace;--t:.4s cubic-bezier(.25,1,.5,1)}";
code = code.replace(OLD_ROOT, NEW_ROOT);

const OLD_DARK = ".dark{--bg:#0e101a;--surface:#161827;--surface2:#1e2035;--border:#2a2d45;--text:#f0f2ff;--text2:#9ca3af;--text3:#6b7280;--accent-soft:#1e204a;--shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.3);--shadow-lg:0 8px 32px rgba(0,0,0,.4)}";
const NEW_DARK = ".dark{--bg:#07080e;--surface:rgba(22, 24, 39, 0.4);--surface2:rgba(30, 32, 53, 0.3);--border:rgba(255, 255, 255, 0.05);--text:#ffffff;--text2:#a1a8c2;--text3:#6b7280;--accent-soft:rgba(30, 32, 74, 0.5);--shadow:0 10px 30px rgba(0,0,0,0.3);--shadow-lg:0 25px 50px -12px rgba(79,103,255,0.25)}";
code = code.replace(OLD_DARK, NEW_DARK);

// Add backdrop filter globally to elements using surface background
const glassStyle = `\n.card, .sidebar, .topbar, .modal, .stat-card, input, select, textarea { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--border); }
.app-layout { background: radial-gradient(circle at top left, rgba(79, 103, 255, 0.08) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.08) 0%, transparent 40%); }
.btn { backdrop-filter: blur(10px); }
.card { background: linear-gradient(135deg, var(--surface), rgba(255,255,255,0.1)); }
`;
code = code.replace("/* Settings */", glassStyle + "\n/* Settings */");

// 2. Wrap the pages inside AnimatePresence safely!
// Find exactly: <div className="page">{pages[page] || null}</div>
const oldPageRender = '<div className="page">{pages[page] || null}</div>';
const newPageRender = 
  '<div className="page">' +
    '<AnimatePresence mode="wait">' +
      '<motion.div ' +
        'key={page} ' +
        'initial={{ opacity: 0, y: 15, filter: "blur(4px)" }} ' +
        'animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} ' +
        'exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} ' +
        'transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}>' +
        '{pages[page] || null}' +
      '</motion.div>' +
    '</AnimatePresence>' +
  '</div>';
code = code.replace(oldPageRender, newPageRender);

if (!fs.existsSync('src')) fs.mkdirSync('src');
fs.writeFileSync('src/App.jsx', code);
console.log("Successfully patched App.jsx with safe precise replacements!");
