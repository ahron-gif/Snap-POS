# Snap POS Email Templates

This directory contains the branded email template for all system emails sent by Snap POS.

## Files

| File | Description |
|------|-------------|
| `snap-email-template.html` | The main HTML email template with Snap POS branding |
| `Snap_Point_of_Sale_-_Email_Template_Documentation.pdf` | Detailed documentation on template variables and usage |

## Usage

This template should be used by the backend email service for all outgoing system emails, including:

- User invitations
- Password reset emails
- Order confirmations
- System notifications

## Template Variables

The HTML template uses placeholder variables that should be replaced by the backend before sending:

| Variable | Description |
|----------|-------------|
| `{{SUBJECT}}` | Email subject line (also used in preheader) |
| `{{HEADING}}` | Main heading text in the email body |
| `{{BODY_CONTENT}}` | The main HTML content of the email |
| `{{CTA_URL}}` | Call-to-action button URL |
| `{{CTA_TEXT}}` | Call-to-action button text |
| `{{FOOTER_TEXT}}` | Optional footer text override |
| `{{CURRENT_YEAR}}` | Current year for copyright notice |

## Integration Notes

- The template is responsive and tested across major email clients (Gmail, Outlook, Apple Mail)
- All styles are inline for maximum email client compatibility
- The Snap POS logo is referenced via URL; ensure the logo URL is accessible
- The template supports both light backgrounds and dark mode email clients
- For the .NET backend, use a templating engine (e.g., Razor, Scriban) to replace variables before sending via SMTP/SendGrid
