# Gmail SMTP / OTP troubleshooting

## Required environment

Put these values in `.env.local` at the project root (not `.env.example`):

```env
SMTP_USER="yourgmail@gmail.com"
SMTP_PASS="your-google-app-password"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM="Roadmap <yourgmail@gmail.com>"
```

`SMTP_USER` is the Gmail account that sends the email. `SMTP_PASS` must be a Google App Password created for that same account; it is not the normal Gmail password.

The mailer automatically removes whitespace from `SMTP_PASS`, so Google's displayed `xxxx xxxx xxxx xxxx` format can be pasted directly.

After changing `.env.local`, stop and restart Next.js.

## Why 535-5.7.8 happens

`535-5.7.8 Username and Password not accepted` is returned by Gmail when SMTP authentication is rejected. Common causes are:

- `SMTP_USER` is not the actual Gmail address.
- `SMTP_PASS` is the normal Gmail password instead of a Google App Password.
- The App Password was generated for a different Google account.
- The App Password was revoked.
- The account is a Google Workspace account where App Passwords are restricted.
- The server was not restarted after changing `.env.local`.
- Credentials were placed in `.env.example`; Next.js does not load `.env.example` as runtime secrets.

## Gmail setup

1. Sign in to the same Gmail account used as `SMTP_USER`.
2. Enable Google 2-Step Verification.
3. Open https://myaccount.google.com/apppasswords
4. Create an App Password.
5. Copy the 16-character value into `SMTP_PASS`. Spaces are safe because this project removes them.
6. Restart Next.js.

Never commit `.env.local` or real SMTP credentials.
