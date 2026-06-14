# Auth Pages — Implementation Notes

**Date**: 2026-06-14
**Task**: Enhance Login.tsx + Register.tsx with shadcn Form, Select, Alert, and password toggle

---

## Install Step — What Happened

### Command run
```bash
cd frontend
npx shadcn@latest add form select alert
```

### CLI behaviour (non-interactive — no prompts required)
The CLI completed automatically with `y` piped to stdin. It installed 5 files, but due to a
`components.json` alias resolution issue the files landed in `frontend/@/components/ui/`
(a literal `@` directory) instead of `frontend/src/components/ui/`.

Root cause: shadcn CLI version used could not resolve the `@/` Vite alias from `components.json`
alone (it needs a `tsconfig.json` paths entry to map `@/*` → `src/*`). This is a known quirk
when the project's `tsconfig.json` is in the repo root but `components.json` is in `frontend/`.

### Fix applied
All 5 files were manually copied from `frontend/@/components/ui/` to
`frontend/src/components/ui/` (the correct location). The spurious `frontend/@/` directory was
then deleted. The `"use client"` directive in `form.tsx` was stripped (this is a Vite SPA, not
Next.js — the directive would be silently ignored but is incorrect here).

### Files placed in `frontend/src/components/ui/`
| File | Status |
|---|---|
| `form.tsx` | New — shadcn Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage |
| `select.tsx` | New — Radix-based Select with keyboard navigation |
| `alert.tsx` | New — role="alert" live region banner with destructive variant |
| `button.tsx` | Upgraded — added `asChild` prop (Radix Slot) + SVG sizing utilities |
| `label.tsx` | Upgraded — now uses `@radix-ui/react-label` (required by form.tsx's FormLabel) |

---

## Files Changed

| File | Type |
|---|---|
| `frontend/src/pages/auth/Login.tsx` | Enhanced in-place |
| `frontend/src/pages/auth/Register.tsx` | Enhanced in-place |
| `frontend/src/components/ui/form.tsx` | New |
| `frontend/src/components/ui/select.tsx` | New |
| `frontend/src/components/ui/alert.tsx` | New |
| `frontend/src/components/ui/button.tsx` | Upgraded (asChild + Slot) |
| `frontend/src/components/ui/label.tsx` | Upgraded (Radix LabelPrimitive) |

---

## What Changed in Login.tsx

1. Replaced `useForm` destructured `register`/`errors` pattern with `Form` + `FormField` render-prop pattern — `form.control` passed to each `FormField`.
2. Dropped manual `{errors.x && <p>}` blocks — `FormMessage` reads from context automatically.
3. Added password show/hide toggle: `useState(false)` + `Eye`/`EyeOff` Lucide icons in a ghost icon `Button` (`type="button"`). The `relative` wrapper sits *outside* `FormControl` so `FormControl` wraps the `<Input>` directly (preserves label + `aria-describedby` association — see Post-verification fixes).
4. Replaced `<div className="rounded-md bg-destructive/10 ...">` error banner with `<Alert variant="destructive" role="alert"><AlertDescription>`.
5. Renamed `error` state to `serverError`; cleared at start of each submit.
6. Added `aria-busy={isSubmitting}` to submit button.
7. Added `autoComplete="email"` and `autoComplete="current-password"` for WCAG 1.3.5.

## What Changed in Register.tsx

1. Same Form/FormField migration as Login.
2. Replaced raw `<select {...register('role')}>` with shadcn `Select` wired via `FormField` render prop (`onValueChange={field.onChange}`, `defaultValue={field.value}`).
3. Added `defaultValues: { name: '', email: '', password: '', role: 'student' }` to `useForm` so the Select pre-selects "Student" and all text inputs start controlled (see Post-verification fixes).
4. Removed `.default('student')` from the Zod schema (it was on the schema side; default is now on the form side as per react-hook-form convention).
5. Added `FormDescription` ("Must be at least 8 characters") below the password field.
6. Added password show/hide toggle (same pattern as Login — `FormControl` wraps the `<Input>` directly).
7. Same `Alert`, `serverError` rename, and `aria-busy` additions as Login.
8. Added `autoComplete` attributes: `name`, `email`, `new-password`.

---

## Backend Contract — Preserved Exactly

- Login: `POST /api/auth/login` with `{ email, password }` — unchanged
- Register: `POST /api/auth/register` with `{ name, email, password, role }` — unchanged
- Both return `{ access_token, user }` — unchanged
- Error typing: `(err as { response?: { data?: { detail?: string } } })` — unchanged

---

## TypeScript Check Result

```
npx tsc --noEmit   →  (no output, exit 0)
```

Zero type errors.

---

## Follow-ups / Known Notes

1. **components.json alias resolution** *(resolved)*: The shadcn CLI did not resolve `@/` to
   `src/` during install. Fixed by adding `baseUrl` + `paths` `compilerOptions` to
   `frontend/tsconfig.json` (the root config the CLI reads — the real type-resolution paths
   already live in `tsconfig.app.json`). Future `npx shadcn add` runs install to the right
   location. Does not affect the Vite build (which resolves aliases via `vite.config.ts`).

3. **Alert already has role="alert"**: The shadcn `alert.tsx` renders `role="alert"` on the
   root `<div>` internally. The explicit `role="alert"` in the JSX is therefore redundant but
   harmless (browsers deduplicate identical ARIA roles on the same element).

---

## Post-verification fixes (Playwright run)

Browser verification (`tests/playwright/auth-pages.spec.ts`, 7 tests, chromium) surfaced two
issues that were fixed:

1. **Uncontrolled→controlled input warning**: with the `FormField`/`Controller` pattern the
   inputs are controlled, but `defaultValues` initially only set `role`. Text fields started
   as `undefined` and became defined on first keystroke, firing a React console error. Fixed
   by giving every field an initial value: `defaultValues: { name: '', email: '', password: '', role: 'student' }`
   (Register) and `{ email: '', password: '' }` (Login).

2. **Broken password-field label association**: the initial implementation set an explicit
   `id` on the `<Input>` (`login-password` / `register-password`) with the `relative` wrapper
   *inside* `FormControl`. That override meant `FormLabel`'s `htmlFor` (the generated
   `formItemId`) no longer matched the input, breaking the label↔input link and the
   `aria-describedby` → `FormMessage` wiring; the input's accessible name fell back to the
   placeholder. Fixed by moving the `relative` wrapper *outside* `FormControl` so it wraps the
   `<Input>` directly — the generated id/aria now land on the input, restoring proper
   association. The explicit `id` and `aria-controls` were removed (the toggle's `aria-label`
   already conveys its purpose/state).

All 7 Playwright tests pass after these fixes; `npx tsc --noEmit` is clean.
