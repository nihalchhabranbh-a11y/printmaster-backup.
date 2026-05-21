# UI/UX Roadmap — Premium look & smooth experience

Plan for tomorrow’s improvements: premium look, shortcuts, and polished interactions.

---

## 1. Invoice & billing (done today)

- **Overlap / visibility**: Top bar and invoice header use explicit text colors so nothing is white-on-white. Invoice table header uses a darker blue (`#2d3a9f`) and `print-color-adjust: exact` so it prints correctly.
- **Multi-item billing**: Create Bill form has multiple line items (Add row / remove row). Invoices (modal and public view) show all lines. Old single-line bills still work.

**DB**: If you use multi-item bills, run `bills_items_migration.sql` in Supabase (adds `items` jsonb column).

---

## 2. Premium look & white theme

- **Light-first theme**: Default to a clean white/light gray base with soft shadows.
- **Shadows**: Use layered shadows (e.g. `--shadow`, `--shadow-lg`) for cards and modals so the UI feels “premium” and depthful.
- **Borders**: Subtle borders and rounded corners (`--radius`, `--radius-sm`) for a modern, clean look.
- **Typography**: Keep Sora for UI; ensure hierarchy (weight/size) is clear for headings vs body.

---

## 3. Keyboard shortcuts & arrow keys

- **Global shortcuts**:
  - `Esc` — close modal / cancel.
  - `?` or `Ctrl+/` — show shortcuts help (optional overlay).
- **Navigation**:
  - Arrow keys (e.g. `←` / `→`) to move between sidebar pages or between list items where it makes sense.
  - `Enter` to open selected item (e.g. first bill in list, first task).
- **Billing / forms**:
  - In Create Bill, Tab between line items; optional `Ctrl+Enter` to submit.
- **Focus**: Visible focus ring (`:focus-visible`) for all interactive elements for keyboard users.

---

## 4. UI/UX micro-interactions

- **Click feedback**: Buttons and icon buttons get a small scale or shadow change on click (e.g. `transform: scale(0.98)` on `:active`).
- **Hover**: Cards and list rows have a clear hover state (e.g. slight lift, stronger shadow).
- **Icons**: On click, optional small “pop” or bounce (e.g. CSS `transform` + short transition).
- **Modals**: Open with a short slide-up + fade; close with reverse or fade only.
- **Toasts**: Slide-in from the side and auto-dismiss with a short progress or timer.

---

## 5. Performance & smoothness

- **Transitions**: Use a single timing (e.g. `--t: .2s cubic-bezier(.4,0,.2,1)`) for layout/opacity so the app feels consistent.
- **Lists**: For long lists (bills, tasks), consider virtualisation or pagination to keep scrolling smooth.
- **Avoid layout thrash**: When adding/removing line items or rows, keep DOM updates minimal (e.g. keys on list items).

---

## 6. Responsive & cursor

- **Touch / pointer**: Use `cursor: pointer` on all clickable elements; ensure tap targets are at least ~44px where possible.
- **Breakpoints**: Sidebar collapses to overlay on small screens; tables get horizontal scroll or card layout on narrow viewports.
- **Focus and hover**: Ensure hover states don’t break on touch (e.g. use `@media (hover: hover)` if needed).

---

## 7. Suggested implementation order

1. **Theme & shadows**: Tweak `:root` and `.dark` in the CSS block in `App.jsx` (or move to `index.css`) for white theme and premium shadows.
2. **Shortcuts**: Add a `useEffect` that listens for `keydown` (Escape, arrows, Enter) and dispatches to close modal, change page, or submit.
3. **Micro-interactions**: Add `.btn:active`, `.card:hover`, and modal enter/leave classes with the existing `--t` transition.
4. **Focus**: Add `:focus-visible` styles and ensure tab order is logical in modals and forms.

---

## 8. Files to touch

- **`App.jsx`**: Inline CSS string (theme, buttons, cards, modals), keyboard listener, optional shortcuts overlay.
- **`index.css`**: Global focus and any shared animation keyframes if you move styles out of `App.jsx`.

You can tackle these in small steps (e.g. theme first, then shortcuts, then micro-interactions) and test after each step.
