# Authentication Button Fix

## Root cause
The shared `Button` component intentionally defaults to `type=button`. The login, signup, and reset forms used `<Button>` without overriding the type, so clicking the primary action did not submit the form.

## Fix
- Login: `Button type="submit"`
- Signup: `Button type="submit"`
- Reset password: `Button type="submit"`
- Logout requests now explicitly include credentials and use a deterministic redirect in both the app bar and sidebar.

This preserves the shared button component behavior for non-form actions while making form submission explicit and reliable.
