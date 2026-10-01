# InternOps design system

InternOps should feel: intelligent, precise, operational, calm, fast. Not: generic SaaS, AI-gradient, surveillance.
The product is the brand: real data, real state, honest about what is known (OBSERVED) vs. derived (INFERRED) vs. missing (UNKNOWN).

## Foundations (client/src/index.css)

**Never write a raw hex / `white/…` / `zinc-…` / `indigo-…` class in a page.** Use the tokens:

| Purpose | Tailwind class |
|---|---|
| Page canvas | `bg-bg` · wells `bg-bg-sunken` |
| Card / panel | `bg-surface` (or the `.panel` utility = surface + hairline + `rounded-lg`) · subtle fill / hover `bg-surface-2` · popovers `bg-surface-raised` |
| Borders | `border-line` (hairline) · `border-line-strong` (inputs) |
| Text | `text-ink` primary · `text-ink-2` secondary · `text-ink-3` metadata · `text-ink-4` placeholder/disabled |
| Brand accent (buttons, active nav, links) | `bg-accent text-accent-ink`, `text-accent`, `bg-accent-soft` |
| Work Mode | `text-work bg-work-soft border-work/25` · active dot uses `.work-ring` |
| Pulse / AI | `text-pulse bg-pulse-soft` |
| Status | `ok` / `warn` / `danger` / `info` each with `-soft` |

Typography classes: `.t-page` (page title), `.t-section` (panel title), `.t-label` (uppercase eyebrow), `.t-meta`, `.t-num` (mono tabular numbers — use for every timer, count, duration, time), `.t-serif` (landing display accents only).
Radius: controls `rounded-md` (8px), cards `rounded-lg` (12px), dialogs `rounded-xl`. Nothing is a pill except avatars/dots/count badges.
Shadows: `.lift` for raised cards (rare), `.pop` for popovers/dialogs. No glow, no drop shadows on cards by default.
Motion: `.anim-fade`, `.anim-fade-up`, `.anim-pop`, `.anim-stagger` (children fade in with 40ms stagger). 150–260ms, `var(--ease-out)`. Reduced-motion is handled globally.

## Kit (client/src/components/kit)

- `Page`, `PageHeader` (title/description/actions/crumbs), `Section` (panel with header), `SectionLabel`
- `StatusBadge`, `StatusIcon`, `PriorityMark`, `Pill`, `Dot`, `projectStatusTone`, `TASK_STATUS_META`
- `Avatar` (deterministic colour, `working` ring), `AvatarStack`
- `EmptyState` (icon, title, description, action), `ErrorState` (message, onRetry), `Skeleton`, `SkeletonRows`, `SkeletonBlock`, `QueryState`
- `Stat` (label/value/hint/tone/href), `ProgressBar`, `Metric`
- `Timeline`, `TimelineItem`
- `PulseMarkdown` (renders `[[task:ID|label]]` references as `RefChip` links), `RefChip`
- `Kbd`, `RelativeTime`, `ConfirmDialog`, `CopyButton`, `Segmented`, `KeyValue`, `LiveClock`
- shadcn primitives in `components/ui` are re-skinned: `Button` has variants `default | outline | secondary | ghost | destructive | work | pulse` and sizes `xs | sm | default | lg | icon | icon-sm | icon-xs`.

## Data access

- `import { api, tzOffset, streamSSE } from "@/lib/api"` — `api("POST", url, body)` returns parsed JSON and throws `ApiError` with a human message. 401s automatically sign the user out.
- TanStack Query is configured with a default `queryFn`: `useQuery({ queryKey: ["/api/tasks/mine"] })` works; the key's string parts are joined with `/`.
- Pass `tzOffsetMinutes=${tzOffset()}` to endpoints that compute "today" (`/api/overview`, `/api/me/overview`, `/api/work-sessions/summary`, `/api/worktime/overview`, `/api/signals`, `/api/pulse/*`, `/api/tasks/next-best`).
- After a mutation, invalidate every query that shows the changed data (tasks → `/api/tasks`, `/api/tasks/mine`, `/api/tasks/<id>/detail`, `/api/overview`, `/api/me/overview`, `/api/signals`, `/api/tasks/next-best`).
- `useAuth()` from `@/lib/auth` gives `{ user, signOut }`; `user.role` is `"admin" | "intern"` and is refreshed from the server.
- Toasts: `const { toast } = useToast()` from `@/hooks/use-toast`; `variant: "destructive"` for errors. Error toasts must contain the server message (`err.message`).

## Routes

`/` Home · `/tasks` · `/tasks/:id` · `/projects` · `/projects/:id` · `/people` (admin; `?tab=interns|managers|applications|alumni`) · `/people/:id` (admin) · `/work` · `/work/replay/:sessionId` · `/signals` (admin) · `/pulse` · `/messages` · `/messages/:channelId` · `/settings?section=` · `/alumni/:id/certificate` · public: `/login /signup /invite/:token /apply/:slug /forgot-password /reset-password/:token /verify-email/:token /i/:slug /download /privacy /terms /contact`.
Deep links the backend emits: `/tasks/:id`, `/projects/:id`, `/projects/:id?tab=plan`, `/projects?filter=proposals`, `/people`, `/people?tab=applications`, `/people?tab=alumni`, `/work/replay/:sessionId`.
Palette/query conventions: `/tasks?new=1` opens create, `/projects?new=1` assign, `/projects?propose=1` propose, `/people?invite=1` invite, `/work?end=1` opens the end-shift confirmation.

## Rules every screen follows

1. **Loading / empty / error / success** — every query has all four. Loading = skeletons shaped like the content, never a full-page spinner. Empty = `EmptyState` that explains what the screen is for and offers the next action. Error = `ErrorState` with retry. A failed request must never render as an "all clear" empty state.
2. **No fake UI.** No toggles that don't persist, no metrics the backend doesn't compute, no placeholder numbers, no "coming soon".
3. **Honest evidence language.** Companion activity is "observed"; task correlation is "likely"; gaps are "unknown". Never "worked on X" from activity alone.
4. **Everything links.** A task title goes to `/tasks/:id`, a person to `/people/:id` (admins) , a project to `/projects/:id`, a session to `/work/replay/:id`.
5. **Mobile is a composition, not a squeeze.** Flex rows wrap (`flex-wrap`, `min-w-0`, `truncate`), no fixed widths > 240px, tables become stacked rows under `md`, no horizontal scroll. Test at 390px.
6. **Accessibility.** Every icon-only button has `aria-label`; interactive things are `<button>`/`<a>`, never `<div onClick>`; labels have `htmlFor`; focus styles are the global ring.
7. **Density.** 13–14px body, 12px metadata, 8px/12px/16px spacing rhythm. Sections are `panel`s; pages are composed asymmetrically (primary 2/3 column + secondary 1/3) rather than card grids.
8. **Copy.** Short, specific, confident. Title case for page titles, sentence case elsewhere. No exclamation marks in product chrome.
9. **Destructive actions** use `ConfirmDialog`. Nothing permanent happens on a single click.
10. **Keep behaviour.** When porting a legacy screen, preserve every API call, permission check, and mutation. Only the presentation changes.
