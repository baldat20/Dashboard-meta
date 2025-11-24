# Metas Dashboard - Vercel Basic
This is a simple project to run on Vercel using Google Sheets as data source.
- API: `/api/login` (GET) expects `usuario` and `senha` query params
- Frontend: `public/index.html`

## Setup
1. Create a Google Service Account, enable Sheets API, download JSON.
2. Share your Google Sheet with the service account email.
3. On Vercel set environment variables:
   - GOOGLE_CLIENT_EMAIL
   - GOOGLE_PRIVATE_KEY (use \n sequences or paste with real newlines)
   - SHEET_ID
4. Deploy on Vercel (or run `vercel dev` locally).

NOTE: The example HTML references an image path placeholder.

The uploaded image available in this environment is at:
/mnt/data/A_screenshot_of_a_web_application_interface_displa.png
You can either copy that file into the project's public/ folder before deploying, or replace the placeholder in public/index.html.
