# Gemini receipt assistant

## Activate locally

1. Get a key from https://aistudio.google.com/apikey.
2. Put it in GEMINI_API_KEY in the project's .env file.
3. Restart the Node API server so it reloads .env. If running npm run dev, stop and rerun it. A server started in the background also needs restarting.
4. Open a sample motorcycle, switch to Mekanik, and click Catat servis.
5. The assistant shows a configured status. Paste a short receipt or choose a JPG/PNG/WebP image.
6. Consent to sending the source to Google Gemini and click Baca nota dengan Gemini.
7. Review the proposed values. Check the review box and apply the draft. Complete missing fields and submit normally.

Do not share the key in chat, screenshots or commits. .env is ignored by Git. Never name the key VITE_GEMINI_API_KEY: VITE_ variables are public browser configuration.

GEMINI_MODEL defaults to gemini-3.5-flash, verified with live synthetic text and photo requests on 24 September 2026. It can be changed to a supported text/image model available to your account. Model access and quota must be verified with a live call after changing configuration.

## Inputs and output

The assistant accepts one JPG/PNG/WebP image up to 5 MB and/or pasted text up to 6,000 characters. PDF is not supported.

The server requests structured JSON with date, odometer, complaint, action, parts and warnings. It validates returned types and sizes, clears invalid dates/numeric values, and leaves unknown fields empty. The AI is instructed to treat receipt content as data rather than instructions and to exclude personal identifiers. This instruction is not a guarantee of perfect extraction or redaction; always review the draft.

Only nonempty fields are applied after explicit owner review. No signature, metadata upload or blockchain transaction occurs merely from reading a receipt. The owner then reviews and saves directly from the same page and wallet. There is no mechanic submission or second-wallet approval in version 2.

## Data handling

- Browser sends source content only after consent.
- Server sends it to Google's Gemini API with the key in a server-side header.
- The application does not write raw receipts, source text, model responses or keys to disk/logs.
- Do not enable request-body logging in a reverse proxy or hosting platform.
- Google processes the submitted data under its applicable API terms; do not assume the provider stores nothing.
- The browser holds the selected source in memory while the form is open.
- Submitted service fields become public through the existing workflow.
- Hide customer identities, contact details, plates and frame/engine numbers before uploading.

## Cost and access limits

Default AI access is restricted to loopback connections/hostnames/origins. AI_ALLOW_REMOTE remains false.

The adapter allows at most five requests per IP per minute, two simultaneous model requests and AI_DAILY_LIMIT requests per UTC day (default 50, maximum configurable value 1000). Failed upstream requests also consume the local request budget. Counters are in memory and reset when the server restarts.

These limits are a local-demo guard, not production authentication or a billing guarantee. Before enabling remote access, add user authentication, durable quotas, Google project-level controls and edge rate limits. Restrict the public host/reverse-proxy configuration; CORS is not authentication.

Cancelling in the browser stops waiting for the result; a Gemini request already accepted by the server/provider may still finish and count against quota.

## Tests and current status

Unit/API and browser tests use clearly separate mocked provider responses. They test missing key, consent, MIME/size restrictions, upstream errors, sanitized error messages, structured parsing, request budgets, review-before-apply and preserving manual fields.

Live synthetic text and photo extraction succeeded with gemini-3.5-flash, including applying the photo draft to the service form through the browser. This limited smoke test does not measure accuracy on arbitrary receipts. No user receipt was sent in this diagnostic. Key configuration can be checked through the status endpoint without exposing its value. The app does not substitute fabricated AI output when unconfigured.

## Troubleshooting verified on 24 September 2026

- gemini-3.8-flash returned HTTP 503 for a small synthetic text request.
- gemini-2.5-flash returned HTTP 404 despite appearing in the model listing.
- gemini-3.5-flash returned HTTP 200 for both synthetic text and a synthetic receipt photo.
- The local GEMINI_MODEL configuration and default were changed to gemini-3.5-flash, then the API was restarted.
- The UI now distinguishes a configured key from a successful connection, and server errors distinguish 503 temporary unavailability and 404 model access.
- Six AI server tests, three AI browser scenarios and the production build passed.

Google describes HTTP 503 as temporary overload or unavailability: https://ai.google.dev/gemini-api/docs/generate-content/api-errors

References:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/gemini-api/docs/api-key
