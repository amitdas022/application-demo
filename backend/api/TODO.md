# Project Setup and Running Checklist

This file outlines the remaining steps to get the Okta integration fully configured and the project running locally.

## IV. Okta Setup

Ensure your Okta environment is correctly configured.

1.  **Okta Developer Account:**
    *   [ ] Sign up for an Okta Developer Account if you haven't already.

2.  **OIDC Application (Single-Page Application - SPA):**
    *   [ ] Create a "Single-Page Application (SPA)" in your Okta dashboard.
    *   [ ] Note the **Client ID** (though not directly used by the frontend in the current backend-auth model, it's good practice for SPAs).
    *   [ ] Configure **Sign-in redirect URIs**:
        *   Add `http://localhost:3000/protected.html` (or the correct port if `vercel dev` uses a different one).
    *   [ ] Configure **Sign-out redirect URIs**:
        *   Add `http://localhost:3000/index.html` (or the correct port).
    *   [ ] Ensure **Grant types** enabled include "Authorization Code". "Refresh Token" can also be enabled if future enhancements require it. (Implicit grant is not recommended).

3.  **API Token:**
    *   [ ] In Okta, navigate to **Security > API > Tokens**.
    *   [ ] Create a new API token.
    *   [ ] Grant it the following permissions:
        *   `okta.users.manage`
        *   `okta.users.read`
        *   `okta.groups.manage`
        *   `okta.groups.read`
    *   [ ] **Securely copy this token value.** You will need it for the `OKTA_API_TOKEN` in your `backend/.env` file.

4.  **Admin Group:**
    *   [ ] Create a group in Okta (e.g., name it "AdminGroup" or similar).
    *   [ ] Note its **Group ID**. You will need this for the `ADMIN_GROUP_ID` in your `backend/.env` file.
    *   [ ] Assign any Okta users who should have administrative privileges in your application to this group.

5.  **Trusted Origins:**
    *   [ ] In Okta, navigate to **Security > API > Trusted Origins**.
    *   [ ] Click **Add Origin**.
    *   [ ] **Name:** e.g., "Local Development"
    *   [ ] **Origin URL:** `http://localhost:3000` (or the correct port if `vercel dev` uses a different one).
    *   [ ] **Type:** Check both "CORS" and "Redirect".
    *   [ ] Save the origin.

## V. Running Locally

Once the Okta setup and backend `.env` file are complete:

1.  **Install Backend Dependencies:**
    *   [ ] Navigate to the `application-demo/backend/` directory in your terminal.
    *   [ ] Run `npm install`.

2.  **Start the Development Server:**
    *   [ ] Navigate to the root `application-demo/` directory in your terminal.
    *   [ ] Run `npx vercel dev`.

3.  **Access the Application:**
    *   [ ] Open your web browser and go to `http://localhost:3000` (or the port indicated by the `vercel dev` command).

## Next Steps (After Local Setup is Working)

*   [ ] Test all authentication flows (login, logout).
*   [ ] Test regular user access to protected pages.
*   [ ] Test admin user access to admin pages and CRUD functionalities.
*   [ ] Prepare for deployment to Vercel (ensure environment variables are set in Vercel project settings).