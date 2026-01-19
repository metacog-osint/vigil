# Vigil Email Templates

Branded email templates for Supabase Auth emails.

## Templates

| Template | File | Supabase Template Name |
|----------|------|------------------------|
| Email Verification | `verification.html` | Confirm signup |
| Password Reset | `password-reset.html` | Reset password |
| Magic Link | `magic-link.html` | Magic Link |

## How to Apply in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Email Templates**
3. For each template:
   - Select the template type (e.g., "Confirm signup")
   - Copy the HTML from the corresponding file
   - Paste into the **Message body** field
   - Update the **Subject** field:
     - Confirm signup: `Verify your email - Vigil`
     - Reset password: `Reset your password - Vigil`
     - Magic Link: `Sign in to Vigil`
   - Click **Save**

## Template Variables

These templates use Supabase's template variables:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | The action link (verify, reset, sign in) |
| `{{ .Email }}` | User's email address |
| `{{ .SiteURL }}` | Your site URL |

## Design Notes

- **Background**: Dark cyber theme (#0a0a0f)
- **Accent Color**: Cyan (#00d4ff) - matches Vigil's `cyber-accent`
- **Card Background**: #111118 with #1f2937 border
- **Responsive**: Works on mobile and desktop email clients
- **Accessibility**: Proper contrast ratios and semantic structure

## Preview

To preview templates locally, open the HTML files in a browser.
