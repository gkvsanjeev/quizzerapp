# Auth Pages — shadcn/ui Component Research

**Task**: Auth Pages Enhancement (Login.tsx + Register.tsx)
**Date**: 2026-06-14
**Registry**: `@shadcn` (default, MCP-queryable)
**Project style**: `default`, `rsc: false`, `tsx: true`, baseColor `slate`, cssVariables enabled
**Alias**: `@/components/ui`

---

## Installation

Run from the `frontend/` directory (the directory that contains `components.json`):

```bash
cd frontend
npx shadcn@latest add form select alert
```

This installs three files:
- `src/components/ui/form.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/alert.tsx`

The MCP-verified install command (registry-prefixed form) is:

```
npx shadcn@latest add @shadcn/form @shadcn/select @shadcn/alert
```

Both forms are equivalent. The `cd frontend` prefix is required because shadcn CLI reads `components.json` from cwd.

No additional npm packages are needed beyond what shadcn pulls automatically:
- `form` declares deps on `radix-ui`, `@hookform/resolvers`, `zod`, `react-hook-form` — all already present in this project.
- `select` declares deps on `radix-ui` — already present.
- `alert` has no external deps beyond Tailwind.

---

## Components to Install

### 1. `form` — react-hook-form Context Wrapper

**Registry type**: `registry:ui`
**File installed**: `src/components/ui/form.tsx`
**Deps confirmed by MCP**: `radix-ui`, `@hookform/resolvers`, `zod`, `react-hook-form`

#### What it provides

The `form` component is a thin shadcn wrapper over react-hook-form's `FormProvider`. It re-exports seven sub-components that wire ARIA attributes automatically when used together via the `render` prop pattern:

| Export | Role |
|---|---|
| `Form` | Spreads `useForm()` return value as `FormProvider` context |
| `FormField` | Takes `control`, `name`, `render` — provides `field` + `fieldState` to the render prop via `useController` |
| `FormItem` | Wrapping `<div>` that generates a unique `id` for the field context |
| `FormLabel` | Re-exports `Label`; sets `htmlFor` to the field `id` automatically; adds `text-destructive` when field has error |
| `FormControl` | Wraps the input; injects `id`, `aria-describedby`, `aria-invalid` onto the child via `Slot` (Radix) — **no manual aria attrs needed when input is inside FormControl** |
| `FormDescription` | `<p>` with muted styling; registers its own `id` into the field's `aria-describedby` chain |
| `FormMessage` | Reads `fieldState.error.message` from context; renders as `<p>` with destructive color; registers its `id` into `aria-describedby` |

#### Key props

```tsx
// Form — spread the entire useForm() return value
<Form {...form}>

// FormField — the only props you set manually
<FormField
  control={form.control}   // required: ties field to the form instance
  name="email"             // required: must match a key in your Zod schema
  render={({ field, fieldState }) => ( ... )}  // required render prop
/>

// field object (from useController) — spread onto native inputs
field.value        // current value
field.onChange     // change handler
field.onBlur       // blur handler
field.name         // field name string
field.ref          // ref for focus management

// fieldState object
fieldState.error         // FieldError | undefined — has .message
fieldState.invalid       // boolean
fieldState.isDirty       // boolean
fieldState.isTouched     // boolean
```

#### Canonical react-hook-form + Zod pattern (Vite/React, no RSC)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form, FormField, FormItem, FormLabel,
  FormControl, FormDescription, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    // mode defaults to 'onSubmit'; revalidation switches to 'onChange' after first submit
  })

  const onSubmit = async (values: LoginValues) => {
    // call API here
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                {/* FormControl injects id, aria-invalid, aria-describedby automatically */}
                <Input
                  type="email"
                  placeholder="alice@example.com"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />  {/* renders field error text; hidden when no error */}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full"
                disabled={form.formState.isSubmitting}
                aria-busy={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </Form>
  )
}
```

**Important**: Do NOT add `"use client"` — this is Vite, not Next.js.

#### aria wiring — automatic vs manual

When an `<Input>` sits inside `<FormControl>`, shadcn injects all ARIA via Radix `Slot`:
- `id` — set to the field context id
- `aria-describedby` — accumulates ids from `FormDescription` and `FormMessage`
- `aria-invalid` — set to `"true"` when `fieldState.error` exists

You do NOT need to set `aria-invalid` or `aria-describedby` manually on the `Input` when it is inside `FormControl`. Adding them manually will duplicate the attributes. The requirements doc pre-dates this clarification — omit the manual aria props shown in the component hierarchy when using `FormControl`.

The exception: if you wrap the `Input` in a custom `<div>` (e.g. for the password toggle), `FormControl` injects onto the `<div>`, not the `Input`. In that case, `asChild` on `FormControl` is needed OR you manually forward `id`/`aria-*` from `fieldState` onto the `Input`. See the password toggle section below.

---

### 2. `select` — Radix-based Accessible Select

**Registry type**: `registry:ui`
**File installed**: `src/components/ui/select.tsx`
**Deps confirmed by MCP**: `radix-ui`

#### What it provides

A fully keyboard-navigable select built on Radix UI Select primitive. Not a native `<select>` — cannot be registered with `{...register()}`. Must use `FormField` render prop.

| Export | Role |
|---|---|
| `Select` | Root controlled/uncontrolled wrapper |
| `SelectTrigger` | The visible button that opens the dropdown |
| `SelectValue` | Displays the current selection or placeholder |
| `SelectContent` | Dropdown panel (uses Radix Portal, renders in document.body) |
| `SelectGroup` | Optional grouping container |
| `SelectLabel` | Non-selectable group label |
| `SelectItem` | Individual option |
| `SelectSeparator` | Visual divider between groups |

#### Key props

```tsx
// Select root
<Select
  value={string}                  // controlled value
  defaultValue={string}           // uncontrolled initial value
  onValueChange={(val) => void}   // fired when selection changes — use field.onChange
  open={boolean}                  // controlled open state (optional)
  onOpenChange={(open) => void}   // (optional)
  disabled={boolean}
  name={string}                   // renders a hidden <input> for native form compat
>

// SelectTrigger
<SelectTrigger
  className={string}
  aria-label={string}             // use when SelectValue placeholder isn't descriptive enough
>

// SelectItem
<SelectItem
  value={string}   // required; this is what onValueChange receives
  disabled={boolean}
>
  Label text
</SelectItem>
```

#### Standalone usage (select-demo pattern)

```tsx
import {
  Select, SelectContent, SelectGroup,
  SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'

<Select>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select a fruit" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Fruits</SelectLabel>
      <SelectItem value="apple">Apple</SelectItem>
      <SelectItem value="banana">Banana</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

#### react-hook-form + Zod wiring via FormField render prop

This is the trickiest integration. `Select` cannot use `{...register('role')}` because it is not a native element. The render prop pattern is the only correct approach:

```tsx
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'teacher']),
})
type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'student' },  // pre-populates Select on mount
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* ... other fields ... */}

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>I am a</FormLabel>
              {/*
                Select sits OUTSIDE FormControl but INSIDE FormItem.
                FormControl wraps SelectTrigger only, so shadcn can inject
                aria-invalid and aria-describedby onto the trigger element.
              */}
              <Select
                onValueChange={field.onChange}      // wire change
                defaultValue={field.value}          // wire initial value
              >
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
      </form>
    </Form>
  )
}
```

**Why `defaultValue` not `value`**: Using `value={field.value}` makes the Select fully controlled and requires you to handle every state transition. `defaultValue={field.value}` initialises from the form's `defaultValues` and then lets Radix manage the open/close state internally while still calling `onValueChange` on selection. The shadcn docs and the requirements spec both use `defaultValue` for this reason.

**Why Select is outside FormControl**: `FormControl` uses Radix `Slot` to clone its direct child and inject ARIA props. If `Select` is the child, Slot would try to inject onto the Radix Select root which does not render a DOM element. Wrapping `SelectTrigger` inside `FormControl` puts the aria attributes on the visible trigger button — the correct target.

---

### 3. `alert` — Status Banner with Live Region

**Registry type**: `registry:ui`
**File installed**: `src/components/ui/alert.tsx`
**Deps confirmed by MCP**: none (pure Tailwind + class-variance-authority)

#### What it provides

| Export | Role |
|---|---|
| `Alert` | Root container; accepts `variant` prop; renders as `<div role="alert">` by default |
| `AlertTitle` | Bold heading inside the alert |
| `AlertDescription` | Body text; can contain `<p>`, `<ul>`, etc. |

#### Key props

```tsx
<Alert
  variant="default" | "destructive"  // default: "default"
  // Alert already renders role="alert" in its className/slot
  // Adding role="alert" explicitly is harmless but redundant for the default variant
>
```

The `variant="destructive"` applies red border + text-destructive tokens. This replaces any manually constructed `className="border-red-500 text-red-600 ..."` patterns.

#### Usage (from alert-demo)

```tsx
import { AlertCircleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Default (informational)
<Alert>
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>Your changes have been saved.</AlertDescription>
</Alert>

// Destructive (server error banner)
<Alert variant="destructive">
  <AlertCircleIcon />
  <AlertTitle>Unable to process your payment.</AlertTitle>
  <AlertDescription>
    Please verify your billing information and try again.
  </AlertDescription>
</Alert>
```

#### Usage in auth pages (server error pattern, no icon needed)

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert'

// Renders only when serverError is non-empty
{serverError && (
  <Alert variant="destructive" role="alert">
    <AlertDescription>{serverError}</AlertDescription>
  </Alert>
)}
```

The `role="alert"` attribute on the `Alert` element creates a live region — screen readers announce the content automatically when it appears in the DOM without requiring focus movement. Clearing `serverError` at the start of each submission attempt prevents stale announcements.

**Note**: `AlertTitle` is optional. For the auth error banner (a single sentence like "Invalid credentials"), `AlertDescription` alone is sufficient.

---

## Reference: Already-Installed Primitives

These are documented for reference only — no install step needed.

### `button`
**Dep**: `radix-ui`

```tsx
import { Button } from '@/components/ui/button'

<Button
  variant="default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size="default" | "sm" | "lg" | "icon"
  type="button" | "submit" | "reset"  // ALWAYS set type="button" on non-submit buttons
  disabled={boolean}
  aria-busy={boolean}   // add to submit button during isSubmitting
  asChild={boolean}     // renders as child element (e.g. <Link>)
>
```

Key for auth pages:
- Submit button: `type="submit"`, `disabled={isSubmitting}`, `aria-busy={isSubmitting}`
- Password toggle button: `type="button"` (mandatory — prevents form submission), `variant="ghost"`, `size="icon"`, `aria-label`

### `input`
**Dep**: none

```tsx
import { Input } from '@/components/ui/input'

<Input
  type="text" | "email" | "password"
  placeholder={string}
  autoComplete={string}   // "email", "current-password", "new-password", "name"
  {...field}              // spread from FormField render prop
/>
```

When wrapped in `FormControl`, `id`/`aria-invalid`/`aria-describedby` are injected automatically. Do not duplicate them.

### `label`
**Dep**: `radix-ui`

In the enhanced form, `Label` is fully replaced by `FormLabel` (which re-exports it with added form context). Do not import `Label` directly in the auth pages.

### `card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`
**Dep**: none

No changes needed. Card acts as the page-level visual container. Import pattern:

```tsx
import {
  Card, CardHeader, CardTitle, CardDescription,
  CardContent, CardFooter,
} from '@/components/ui/card'
```

---

## Password Visibility Toggle — Inline Pattern

No new package. Lucide (`Eye`, `EyeOff`) is already available as a transitive shadcn dependency.

```tsx
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Inside the component:
const [showPassword, setShowPassword] = useState(false)

// Inside FormField render prop for password:
render={({ field }) => (
  <FormItem>
    <FormLabel>Password</FormLabel>
    <FormControl>
      {/*
        FormControl wraps the div, not the Input directly.
        This means aria-invalid / aria-describedby land on the div.
        To ensure they reach the Input, forward fieldState attrs manually:
      */}
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder="Min 8 characters"
          autoComplete="new-password"
          id="password"
          {...field}
        />
        <Button
          type="button"               // critical: prevents form submission
          variant="ghost"
          size="icon"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-controls="password"   // matches the Input id above
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </Button>
      </div>
    </FormControl>
    <FormDescription id="password-desc">
      Must be at least 8 characters
    </FormDescription>
    <FormMessage />
  </FormItem>
)}
```

Keep `showPassword` state local to each page component via `useState<boolean>(false)`. Do not lift to Zustand — purely ephemeral UI state.

---

## Full Integration Snippet: Register Form (Select + Form + Alert)

This is the trickiest page because it combines all three new components. Condensed but copy-pasteable:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import {
  Form, FormField, FormItem, FormLabel, FormControl,
  FormDescription, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card, CardHeader, CardTitle, CardDescription,
  CardContent, CardFooter,
} from '@/components/ui/card'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'teacher']),
})
type RegisterValues = z.infer<typeof registerSchema>

export function Register() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'student' },  // pre-selects "Student" in the Select
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: RegisterValues) => {
    setServerError('')
    try {
      // const data = await authApi.register(values)
      // setAccessToken(data.access_token)
      // setUser(data.user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setServerError(message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Join QuizzerApp to start practising</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Alice Sharma"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="alice@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password with toggle */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 8 characters"
                          autoComplete="new-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-controls="register-password"
                          onClick={() => setShowPassword((p) => !p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>Must be at least 8 characters</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Role — render prop wiring for non-native Select */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>I am a</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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

              {/* Server error banner */}
              {serverError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>

            </form>
          </Form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
```

---

## Accessibility Notes

### What shadcn Form handles automatically

When the `render` prop pattern is used with `FormControl` wrapping a direct input child:
- `id` is generated from the field context and set on the input
- `aria-describedby` accumulates ids from `FormDescription` + `FormMessage`
- `aria-invalid="true"` is set on the input when `fieldState.error` exists
- `FormLabel` sets `htmlFor` to match the generated `id`

Do NOT manually set `aria-invalid` or `aria-describedby` inside `FormControl` — they will be duplicated and may confuse assistive technologies.

### role="alert" on Alert

The `Alert` component renders a `<div>`. Adding `role="alert"` makes it an ARIA live region with `aria-live="assertive"`. Screen readers announce the content immediately on DOM insertion without requiring focus movement. This satisfies WCAG 2.1 AA criterion 4.1.3 (Status Messages).

Clear `serverError` at the start of each submission (`setServerError('')`) so the DOM node is removed and re-inserted on the next failure — this re-triggers the announcement.

### Select keyboard behavior (from Radix)

- `Tab` / `Shift+Tab` — focuses the trigger
- `Space` / `Enter` / `ArrowDown` — opens the dropdown
- `ArrowUp` / `ArrowDown` — navigates options
- `Enter` / `Space` — selects focused option
- `Escape` — closes without selecting
- Type-ahead search is built in

### autoComplete attributes

| Field | `autoComplete` value |
|---|---|
| Name (Register) | `"name"` |
| Email | `"email"` |
| Password (Login) | `"current-password"` |
| Password (Register) | `"new-password"` |

These satisfy WCAG 1.3.5 (Identify Input Purpose) and enable browser autofill.

### Password toggle button

Must be `type="button"` — omitting `type` defaults to `type="submit"` inside a `<form>`, which would submit the form on click. The `aria-label` must dynamically update (`'Show password'` / `'Hide password'`) so the current action is announced, not the current state.

---

## Dependency Graph

```
form.tsx
  └── react-hook-form (useController, useFormContext, FormProvider)
  └── @hookform/resolvers/zod
  └── zod
  └── @radix-ui/react-slot (for FormControl's Slot)
  └── label.tsx (FormLabel re-exports Label)

select.tsx
  └── @radix-ui/react-select

alert.tsx
  └── class-variance-authority (cva)
  └── (no radix dep — pure HTML div)
```

All Radix packages arrive as part of shadcn's install. No separate `npm install` is needed.

---

## Known Gotchas

1. **`defaultValue` vs `value` on Select**: Use `defaultValue={field.value}` initialised from `useForm({ defaultValues })`. Using `value={field.value}` without a controlled close/open handler can leave the Select stuck open or unresponsive after selection.

2. **Select position outside FormControl**: `Select` root wraps `FormControl > SelectTrigger`. `SelectContent` must be a sibling of `FormControl` (inside `Select`), not inside `FormControl`. The portal rendering of `SelectContent` requires it to be a child of the `Select` root, not inside `Slot`.

3. **"use client" directive**: This project is Vite SPA (`rsc: false`). Never add `"use client"` to any component file — it is a Next.js App Router directive and will cause a syntax error or be silently ignored in Vite. The registry examples show it but all those examples are from the `new-york-v4` Next.js registry; the `@shadcn` default registry files do not include it.

4. **FormControl + div wrapper (password toggle)**: When `FormControl` wraps a `<div>` instead of a direct input, Radix `Slot` injects aria attributes onto the `<div>`. The inner `Input` will not receive `aria-invalid` automatically. Explicitly set `id` on the `Input` and match `aria-controls` on the toggle button to that id.

5. **Validation mode**: The default `useForm` mode is `'onSubmit'`. Do not override it. After first submission failure, react-hook-form automatically switches to `'onChange'` revalidation so errors clear as the user corrects them.
