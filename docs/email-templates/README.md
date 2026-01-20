# Vigil Email Templates

Branded email templates for Supabase Auth emails. Uses inline CSS with pure HTML eye icons - no external images that can break or get blocked.

## Templates

| Template | File | Supabase Template Name | Subject Line |
|----------|------|------------------------|--------------|
| Email Verification | `verification.html` | Confirm signup | `Verify your email - Vigil` |
| Password Reset | `password-reset.html` | Reset password | `Reset your password - Vigil` |
| Magic Link | `magic-link.html` | Magic Link | `Sign in to Vigil` |

## How to Apply in Supabase

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. For each template:
   - Select the template type (e.g., "Confirm signup")
   - Open the corresponding `.html` file and copy ALL contents
   - Paste into the **Message body** field (replace everything)
   - Update the **Subject** field (see table above)
   - Click **Save**

**Important:** You must copy the raw HTML, not the rendered view. Open the file in a text editor or view raw on GitHub.

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
