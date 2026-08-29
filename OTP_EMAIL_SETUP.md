# OTP email setup

Signup now sends a 6-digit OTP through Nodemailer/Gmail. OTP hashes are stored in Redis under the user ID namespace and expire after `OTP_TTL_SECONDS` (default 10 minutes). The OTP itself is never stored in PostgreSQL.

Password changes from Settings use the same flow: request OTP -> receive email -> enter OTP + new password.

Required server environment variables:

- `REDIS_URL`
- `SMTP_USER`
- `SMTP_PASS`
- optional `SMTP_FROM`
- optional `OTP_TTL_SECONDS`

For Gmail, use a dedicated App Password rather than your normal Gmail password. Google requires 2-Step Verification for App Passwords.
