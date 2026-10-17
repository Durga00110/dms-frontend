# Document Management System Frontend

A React and TypeScript single-page application for OTP sign-in, document upload, and document search. The app is built with Vite and uses React Router for navigation and TanStack Query for asynchronous API calls.

## Features

- OTP-based sign-in using a mobile number.
- Protected application routes with a shared navigation layout.
- Document upload with file selection, category, date, remarks, tags, and client-side validation.
- Document search by category, subcategory, tags, and date range.
- Server-side search pagination with selectable page sizes.
- PDF and image previews, individual file downloads, and a ZIP download of all matching search results.
- Admin user-creation form with client-side validation.

## Requirements

- Node.js and npm.
- Access to the backend API used by the application.

## Getting started

Install dependencies and start the Vite development server:

```bash
npm ci
npm run dev
```

Set the backend base URL in a local environment file named `.env.local` in this project directory:

```env
VITE_API_BASE_URL=<backend-api-base-url>
```

The configured base URL is used to build the authentication, tag, search, and upload endpoint URLs. Restart the development server after changing environment variables. Do not commit credentials or private deployment URLs.

## Application routes

| Path | Access | Page |
| --- | --- | --- |
| `/` | Public | OTP login |
| `/search` | Requires a stored token | Search and manage documents |
| `/upload` | Requires a stored token | Upload a document |
| `/admin` | Requires a stored token | Create-user form |

Unknown paths display the not-found page. The protected-route check looks for a `token` value in browser `localStorage`; successful OTP verification stores the token there, and logout removes it. This is a client-side route guard, so the backend must still enforce authorization for protected API operations.

## Document search flow

The search page in [`DocumentSearch.tsx`](./src/features/documents/DocumentSearch.tsx) runs an initial unfiltered search when it mounts. The form sends the selected category, subcategory, tags, and date range to the search API. Dates are converted from the browser's `YYYY-MM-DD` format to `DD-MM-YYYY`.

Search requests include a zero-based `start` offset and a `length` page size. Page navigation and page-size changes repeat the active search with the appropriate offset. The total number of matching records comes from `recordsFiltered` in the API response. Available page sizes are 10, 25, 50, and 100.

Tag suggestions are loaded as the user types, with a 300 ms debounce. Selected tags can be added with Enter or a comma, removed using their chip buttons, or removed from the end of the list with Backspace when the input is empty.

Selecting **Download All** retrieves every page matching the active search (in batches of 100) and passes the file URLs to a Web Worker. The worker fetches the files and builds `documents.zip` using `fflate`; progress and worker errors are shown on the page, and ZIP creation can be cancelled. This operation downloads all documents matching the current filters, not just the visible page.

## Backend API expectations

All endpoints below are relative to `VITE_API_BASE_URL`.

| Method and endpoint | Used for | Request/response details |
| --- | --- | --- |
| `POST /generateOTP` | Request a one-time code | Sends `{ "mobile_number": "..." }`. |
| `POST /validateOTP` | Verify the code and sign in | Sends `mobile_number` and `otp`; successful response data should include `token` or `accessToken`. |
| `POST /documentTags` | Tag autocomplete | Sends `{ "term": "..." }`; expects a response with `status` and `data` items containing `label`. |
| `POST /searchDocumentEntry` | Search and paginate documents | Sends category, date, tag, and pagination fields. Expects `data`, `recordsTotal`, and `recordsFiltered`. The token is sent in the request headers. |
| `POST /saveDocumentEntry` | Upload a document | Sends multipart form data with a `file` part and a JSON `data` part containing document metadata. |

The search request payload includes `major_head`, `minor_head`, `from_date`, `to_date`, `tags`, `uploaded_by`, `start`, `length`, `filterId`, and `search.value`. Search responses are mapped into the UI document model by [`documentSearch.utils.ts`](./src/utils/documentSearch.utils.ts).

## Project structure

```text
src/
  components/    Shared layout, route guard, error boundary, and fallback pages
  features/
    auth/        OTP login page
    documents/   Document search, results, preview, and pagination
    upload/      Document upload form
  hooks/         Search, tag-suggestion, and ZIP-download hooks
  services/      HTTP/API clients
  types/         Shared TypeScript types
  utils/         Search mapping and download helpers
  validations/   Login, upload, and create-user validation rules
  workers/       Background ZIP creation worker
```

The application entry point is [`src/main.tsx`](./src/main.tsx). Route composition is in [`src/App.tsx`](./src/App.tsx), and the document search API contract is defined in [`documentSearchService.ts`](./src/services/documentSearchService.ts).

## Current implementation notes

- Search and upload are connected to the backend API. The category and subcategory options currently come from frontend constants rather than API lookups.
- The search result rows currently display a bookmark icon in the Tags column instead of rendering each document's tag text.
- The admin user-creation form validates input and displays a success message locally; it is not currently connected to a create-user API.
- Individual file downloads use browser `fetch`; the file host must permit the request (including cross-origin requests where applicable).

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite development server. |
| `npm run build` | Run TypeScript project builds and create the production bundle. |
| `npm run preview` | Serve the production build locally for preview. |
| `npm run lint` | Run Oxlint. |
