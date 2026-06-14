# Auth Pages — shadcn Enhancement Requirements

**Scope**: `Login.tsx` and `Register.tsx` only. `ForgotPassword.tsx` and `ResetPassword.tsx` are out of scope.
**Type**: Enhancement — existing auth flow, backend contract, and routing are frozen. No new API fields, no new routes.
**Stack**: React 18 + Vite 5 + TypeScript (strict, no `any`). `rsc: false`. Uses `react-router-dom`, `react-hook-form` + Zod.

---

## Feature Name

Authentication Pages — Polished, Accessible shadcn/ui Implementation

---

## Components Required

### Already Installed (no install step needed)

| Component | File | Current Usage | Enhancement Role |
|---|---|---|---|
| `Button` | `@/components/ui/button` | Submit button | Keep as-is; add `aria-busy` when submitting |
| `Input` | `@/components/ui/input` | Text/email/password fields | Wrap in `FormControl`; add `aria-invalid`, `aria-describedby` |
| `Label` | `@/components/ui/label` | Field labels | Replace with `FormLabel` (re-exports Label, adds context wiring) |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `@/components/ui/card` | Page wrapper | Keep as-is |

### Needs Installing — shadcn registry (`@shadcn`)

| Component | Install Command | Purpose |
|---|---|---|
| `form` | `npx shadcn@latest add form` | Provides `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage` — wraps react-hook-form context so every field gets correct `aria-invalid` + `aria-describedby` automatically |
| `select` | `npx shadcn@latest add select` | Replaces the raw `<select>` in Register's "I am a" field with `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` — keyboard-navigable, screen-reader-announced, visually consistent |
| `alert` | `npx shadcn@latest add alert` | Replaces the ad-hoc `div` error banner with `Alert` + `AlertDescription` — adds role="alert" for live-region announcement, consistent destructive variant styling |

### No Install Needed — Implemented Inline

| Pattern | Implementation | Why Not a Separate Package |
|---|---|---|
| Password visibility toggle | A `useState<boolean>` controlling `type="password"` vs `type="text"` on the `Input`, with a `Button` variant="ghost" size="icon" overlay using a Lucide `Eye`/`EyeOff` icon | Lucide is already a transitive shadcn dependency; no new package. A wrapping `<div className="relative">` positions the button inside the input boundary. |

### Explicitly Excluded

| Component | Reason |
|---|---|
| `tooltip` | Was considered for password rules hint; excluded to keep scope minimal — the `FormDescription` sub-component of `form` covers static hint text adequately |
| `badge` | Not applicable to this feature |
| Any `@aceternity`, `@originui`, `@cult`, `@kibo`, `@reui` component | The MCP tool cannot validate them (only `@shadcn` is MCP-queryable). All required improvements are achievable with `@shadcn` primitives. |

---

## Component Hierarchy

### Login.tsx

```
<div>  {/* page shell: min-h-screen, gradient bg */}
  <Card>
    <CardHeader>
      <CardTitle>Welcome back</CardTitle>
      <CardDescription>Sign in to your QuizzerApp account</CardDescription>
    </CardHeader>

    <CardContent>
      <Form>                              {/* react-hook-form FormProvider wrapper */}
        <form onSubmit={handleSubmit}>

          {/* Email field */}
          <FormField name="email">
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="alice@example.com"
                       aria-invalid={!!errors.email}
                       aria-describedby="email-error" />
              </FormControl>
              <FormMessage id="email-error" />   {/* renders errors.email.message */}
            </FormItem>
          </FormField>

          {/* Password field */}
          <FormField name="password">
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
              <FormControl>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'}
                         placeholder="Your password"
                         aria-invalid={!!errors.password}
                         aria-describedby="password-error" />
                  <Button type="button" variant="ghost" size="icon"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={toggleShowPassword}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage id="password-error" />
            </FormItem>
          </FormField>

          {/* Form-level error banner */}
          {serverError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full"
                  disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>

        </form>
      </Form>
    </CardContent>

    <CardFooter>
      <p>Don't have an account? <Link to="/register">Create one</Link></p>
    </CardFooter>
  </Card>
</div>
```

### Register.tsx

```
<div>  {/* page shell: min-h-screen, gradient bg */}
  <Card>
    <CardHeader>
      <CardTitle>Create an account</CardTitle>
      <CardDescription>Join QuizzerApp to start practising</CardDescription>
    </CardHeader>

    <CardContent>
      <Form>
        <form onSubmit={handleSubmit}>

          {/* Name field */}
          <FormField name="name">
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Alice Sharma"
                       aria-invalid={!!errors.name}
                       aria-describedby="name-error" />
              </FormControl>
              <FormMessage id="name-error" />
            </FormItem>
          </FormField>

          {/* Email field */}
          <FormField name="email">
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="alice@example.com"
                       aria-invalid={!!errors.email}
                       aria-describedby="email-error" />
              </FormControl>
              <FormMessage id="email-error" />
            </FormItem>
          </FormField>

          {/* Password field with toggle */}
          <FormField name="password">
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'}
                         placeholder="Min 8 characters"
                         aria-invalid={!!errors.password}
                         aria-describedby="password-desc password-error" />
                  <Button type="button" variant="ghost" size="icon"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={toggleShowPassword}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </FormControl>
              <FormDescription id="password-desc">Must be at least 8 characters</FormDescription>
              <FormMessage id="password-error" />
            </FormItem>
          </FormField>

          {/* Role field — replaces raw <select> */}
          <FormField name="role">
            <FormItem>
              <FormLabel>I am a</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger aria-describedby="role-error">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage id="role-error" />
            </FormItem>
          </FormField>

          {/* Form-level error banner */}
          {serverError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full"
                  disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>

        </form>
      </Form>
    </CardContent>

    <CardFooter>
      <p>Already have an account? <Link to="/login">Sign in</Link></p>
    </CardFooter>
  </Card>
</div>
```

---

## Implementation Notes

### react-hook-form Integration with shadcn Form

The `form` component is a thin wrapper over react-hook-form's `FormProvider`. The integration pattern is:

```tsx
const form = useForm<FormValues>({ resolver: zodResolver(schema) })
// ...
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

The `render` prop pattern gives access to `field` (spread onto the native input) and the context-wired `FormMessage` which reads from `formState.errors` automatically — `FormMessage` replaces the manual `{errors.email && <p>...}` pattern currently used.

### Select + react-hook-form

The shadcn `Select` is not a native HTML element, so it cannot be wired with `{...register('role')}`. It must use the `FormField` render prop with `field.onChange` and `field.value` passed explicitly to `Select`'s `onValueChange` and `defaultValue` props. This is the standard shadcn pattern for controlled non-native components.

```tsx
<FormField
  control={form.control}
  name="role"
  render={({ field }) => (
    <FormItem>
      <FormLabel>I am a</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="student">Student</SelectItem>
          <SelectItem value="teacher">Teacher</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

The Zod schema default of `'student'` means `defaultValue` will be pre-populated from `useForm` defaults — pass `defaultValues: { role: 'student' }` explicitly to `useForm` so the Select renders the pre-selected value on mount.

### Password Toggle State

Both pages need an independent `showPassword` state. Keep it local to each page component via `useState<boolean>(false)`. Do not lift to Zustand — it is purely ephemeral UI state with no cross-component dependency.

```tsx
const [showPassword, setShowPassword] = useState(false)
const toggleShowPassword = () => setShowPassword((prev) => !prev)
```

The toggle `Button` must be `type="button"` to prevent accidental form submission.

### Server Error State

Rename the existing `error` state variable to `serverError` across both files to distinguish it clearly from the field-level `formState.errors`. The `Alert` component's `variant="destructive"` provides the correct red styling without manual className construction.

### Loading State

The existing `isSubmitting` from `formState` is sufficient. Add `aria-busy={isSubmitting}` to the submit `Button` to communicate the loading state to assistive technologies without changing the visible behavior.

---

## Data Flow Patterns

```
User input
  → react-hook-form field (via FormField render prop + field spread)
  → Zod schema validation on submit (zodResolver)
  → onSubmit handler
      → setServerError('')           (clear previous server error)
      → authApi.login / authApi.register
          success → setAccessToken(data.access_token)
                  → setUser(data.user)          [Zustand authStore]
                  → navigate('/dashboard')      [react-router-dom]
          error   → setServerError(err.response?.data?.detail ?? fallback)
                  → Alert renders with role="alert" (live region announces to SR)

Field-level errors:
  Zod schema → formState.errors → FormMessage reads via useFormContext()
  → renders as <p> with id matching aria-describedby on the Input
```

The backend contract is unchanged:
- Login: `POST /api/auth/login` with `{ email, password }`
- Register: `POST /api/auth/register` with `{ name, email, password, role }`
- Both return `{ access_token, user }`

---

## Accessibility Requirements

### WCAG 2.1 AA Targets

| Criterion | Requirement | Implementation |
|---|---|---|
| 1.3.1 Info and Relationships | Labels programmatically associated with inputs | `FormLabel` sets `htmlFor` to match input `id` automatically via shadcn Form context |
| 1.3.5 Identify Input Purpose | Input `autocomplete` attributes | Add `autoComplete="email"`, `autoComplete="current-password"` (Login), `autoComplete="new-password"` (Register), `autoComplete="name"` |
| 3.3.1 Error Identification | Errors identified in text, not color alone | `FormMessage` renders text beside each field; `Alert` renders text at form level |
| 3.3.2 Labels or Instructions | All inputs have visible labels | `FormLabel` is visible (not sr-only) for all fields |
| 3.3.3 Error Suggestion | Error messages suggest correction | Zod messages already descriptive ("Enter a valid email", "Password must be at least 8 characters") |
| 4.1.3 Status Messages | Server errors announced to SR without focus | `Alert` with `role="alert"` creates a live region; screen readers announce on DOM insertion |
| 2.1.1 Keyboard | All controls operable by keyboard | shadcn `Select` is keyboard-navigable (arrow keys, Enter, Escape); `Button` for eye toggle is a native button |
| 1.4.3 Contrast | Text meets 4.5:1 ratio | shadcn default slate theme satisfies this for all text tokens |

### Specific aria Attributes to Add

```tsx
// Input: connect to FormMessage via describedby
<Input
  aria-invalid={!!fieldState.error}   // FormField provides fieldState
  aria-describedby="field-name-error" // matches FormMessage id
  autoComplete="..."
/>

// Submit button
<Button aria-busy={isSubmitting} disabled={isSubmitting}>

// Password toggle button
<Button
  type="button"
  aria-label={showPassword ? 'Hide password' : 'Show password'}
  aria-controls="password"            // matches Input id
/>

// Server error alert
<Alert role="alert" variant="destructive">  // role="alert" = assertive live region
```

Note: `FormMessage` in the shadcn `form` component already assigns an `id` derived from the field name and sets `aria-describedby` on the `FormControl` child automatically when you use the `render` prop pattern. Manually setting `aria-describedby` is only needed if the Input is used outside `FormControl`.

### Focus Management

No focus redirect is needed on error — the browser's native form validation scroll behavior plus the inline `FormMessage` rendering adjacent to each field is sufficient. Do not call `.focus()` programmatically; it would disrupt the natural reading order.

---

## Validation Rules

### Login — Zod Schema (no changes to contract)

```ts
const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
```

### Register — Zod Schema (no changes to contract)

```ts
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'teacher']),
})

// useForm default values (required for Select pre-population)
const form = useForm<FormValues>({
  resolver: zodResolver(registerSchema),
  defaultValues: { role: 'student' },
})
```

### Error Display Priority

1. Field-level (Zod): shown inline below each field via `FormMessage`, triggered on submit (mode: `'onSubmit'`, revalidation mode: `'onChange'` after first submit — this is react-hook-form's default and should be kept)
2. Form-level (server): shown in `Alert` above the submit button, cleared at the start of each submission attempt
3. Never show both a field error and a server error for the same field simultaneously — the server error `Alert` is for non-field errors (e.g. "Email already registered", "Invalid credentials") that have no single field to attach to

### Validation Mode Recommendation

Keep the current implicit defaults: `mode: 'onSubmit'` (validate on submit only, not on every keystroke). This reduces noise for new users who have not yet had a chance to fill in the field. After a failed submission, react-hook-form switches automatically to `'onChange'` revalidation so errors clear as the user corrects them.

---

## Installation Summary

Run from the `frontend/` directory:

```bash
npx shadcn@latest add form select alert
```

This installs three files:
- `frontend/src/components/ui/form.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/alert.tsx`

No other package installations are needed. Lucide icons (`Eye`, `EyeOff`) are already available as a transitive dependency of the existing shadcn components.

---

## Out of Scope

- `ForgotPassword.tsx` and `ResetPassword.tsx` — deferred to a separate requirements pass
- Social/OAuth login buttons — not part of the backend contract
- "Remember me" checkbox — not part of the backend contract
- Animated transitions between Login and Register — not required for WCAG compliance or polish goals
- Any component from `@aceternity`, `@originui`, `@cult`, `@kibo`, `@reui` — these registries are not MCP-queryable; all required improvements are achievable with `@shadcn` primitives
