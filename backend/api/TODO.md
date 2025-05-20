# Project Setup & Auth0 Integration Checklist

This document outlines all the necessary steps to configure the application to work fully with Auth0 for authentication, user management, and role-based access control.

## I. Auth0 Tenant Configuration

1.  **Auth0 Account:**
    *   [ ] Ensure you have an active Auth0 account.

2.  **Auth0 Application (for Frontend SPA):**
    *   [ ] Create a new Application in Auth0 (typically "Single Page Application" type).
    *   [ ] Note its **Domain**, **Client ID**.
    *   [ ] If using ROPG from the backend (as in `api/auth.js`), note the **Client Secret** (ensure the application is marked as "Confidential" if a secret is used for ROPG).
    *   [ ] Configure **Allowed Callback URLs**: Add `http://localhost:3000/protected.html` (adjust port if `vercel dev` uses a different one).
    *   [ ] Configure **Allowed Logout URLs**: Add `http://localhost:3000/index.html`.
    *   [ ] Configure **Allowed Web Origins**: Add `http://localhost:3000`.
    *   [ ] **Grant Types**:
        *   Enable "Password" (for the ROPG flow in `api/auth.js`).
        *   Enable "Authorization Code" (standard for SPAs, good for future flexibility).
        *   Enable "Refresh Token" (if you plan to implement refresh token rotation).

3.  **Auth0 API (for Application Backend):**
    *   [ ] Create a new API in Auth0 (e.g., "My Application API").
    *   [ ] Note its **Identifier (Audience)**. This will be `AUTH0_AUDIENCE` in `backend/.env` used by the ROPG flow in `api/auth.js`.
    *   [ ] Define any custom scopes if needed (e.g., `read:users`, `manage:profile`).

4.  **Auth0 Machine-to-Machine (M2M) Application (for Backend Management Tasks):**
    *   [ ] Create a new Application in Auth0 of type "Machine to Machine".
    *   [ ] Authorize this M2M application to use the **Auth0 Management API**.
    *   [ ] Grant the following **Permissions (Scopes)** to this M2M application for the Management API:
        *   `read:users`
        *   `create:users`
        *   `update:users` (includes `PATCH` for user profiles)
        *   `delete:users`
        *   `read:roles`
        *   `update:roles` (for assigning/removing roles from users)
    *   [ ] Note the **Client ID** and **Client Secret** for this M2M application. These will be `AUTH0_M2M_CLIENT_ID` and `AUTH0_M2M_CLIENT_SECRET` in `backend/.env`.
    *   The `AUTH0_MANAGEMENT_AUDIENCE` will be `https://YOUR_AUTH0_DOMAIN/api/v2/`.

5.  **Auth0 Roles:**
    *   [ ] In Auth0, navigate to **User Management > Roles**.
    *   [ ] Create an "admin" role (or your desired admin role name).
    *   [ ] Create a "user" role (or your desired default user role name).
    *   [ ] (Optional) Define permissions for these roles if you plan to use fine-grained permissions.

6.  **Auth0 Rule or Action (to Add Roles to Token/Userinfo):**
    *   [ ] Create an Auth0 Rule (legacy) or Action (recommended) to add the user's assigned roles to a custom claim (e.g., `https://your-app-namespace/roles`) in the ID Token and Access Token. This allows your backend (`api/auth.js`) to retrieve roles and send them to the frontend.
    *   Example Action script snippet:
        ```javascript
        // Action: Add roles to ID Token
        exports.onExecutePostLogin = async (event, api) => {
          const namespace = 'https://your-app-namespace.com/'; // Replace with your namespace
          if (event.authorization) {
            api.idToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
            api.accessToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
          }
        };
        ```
    *   Ensure the namespace used in the custom claim matches what `api/auth.js` expects when extracting roles.

## II. Backend Setup (`application-demo/backend/`)

1.  **`.env` File:**
    *   [ ] Create or update `backend/.env` with all the Auth0 credentials noted above:
        *   `AUTH0_DOMAIN`
        *   `AUTH0_CLIENT_ID` (for SPA)
        *   `AUTH0_CLIENT_SECRET` (for SPA, if confidential & using ROPG from backend)
        *   `AUTH0_AUDIENCE` (for SPA login flow)
        *   `AUTH0_M2M_CLIENT_ID`
        *   `AUTH0_M2M_CLIENT_SECRET`
        *   `AUTH0_MANAGEMENT_AUDIENCE`
        *   (Optional) `TEST_USERNAME`, `TEST_PASSWORD`

2.  **Dependencies (`package.json`):**
    *   [ ] Ensure `dotenv` and `node-fetch` (v2.x.x for CommonJS) are listed as dependencies.
    *   [ ] Remove `@okta/okta-sdk-nodejs` if it's no longer used.
    *   [ ] Run `npm install` in the `backend/` directory.

3.  **API Files:**
    *   [ ] Verify `backend/api/auth.js` is correctly implemented to use Auth0 ROPG and fetch/return user profile and roles.
    *   [ ] Verify `backend/api/auth0-user-management.js` is correctly implemented to use the M2M token and Auth0 Management API for user CRUD and role assignments.
        *   [ ] **Crucial Security TODO in `auth0-user-management.js`**: Implement proper authorization. Currently, it assumes any call is from an admin. It should validate an Access Token from the frontend user and check if that user has admin roles before performing management actions.

## III. Frontend Setup (`application-demo/frontend/`)

1.  **`app.js` Review:**
    *   [ ] Ensure `app.js` correctly calls `/api/auth` for login.
    *   [ ] Ensure it stores the user object (with `id`, `profile`, `roles`) from `/api/auth` into `localStorage`.
    *   [ ] Verify the `isAdmin` check uses the `roles` array from `localStorage` (e.g., `authenticatedUser.roles.includes('admin')`).
    *   [ ] Ensure CRUD operations in `admin-user-crud.html` section call `/api/auth0-user-management` with the correct actions and payloads (using Auth0 user IDs - `sub`).
    *   [ ] Ensure "Assign Admin Role" functionality in `admin-group.html` section calls `/api/auth0-user-management` with `action: 'assignRoles'`, the target Auth0 User ID, and the role(s) to assign.

## IV. Running and Testing Locally

1.  **Start Development Server:**
    *   [ ] Navigate to the project root (`application-demo/`).
    *   [ ] Run `npx vercel dev`.
    *   [ ] Access the application at `http://localhost:3000` (or the specified port).

2.  **Test Scenarios:**
    *   [ ] **Login/Logout:** Test with valid and invalid Auth0 credentials.
    *   [ ] **Regular User Access:** Log in as a non-admin user. Verify access to `protected.html` and redirection from admin pages.
    *   [ ] **Admin User Access:** Log in as an admin user (ensure this user has the 'admin' role in Auth0). Verify access to `admin.html` and admin functionalities.
    *   [ ] **User CRUD:** Test creating, listing, editing (profile), and deleting users via the admin UI.
    *   [ ] **Role Assignment:** Test assigning/removing the 'admin' role to users via the admin UI.
    *   [ ] **Local Testing Mode:**
        *   [ ] Test `window.LOCAL_TESTING_MODE = true;` to bypass login for UI checks.
        *   [ ] Test simulating regular and admin users by manually setting `localStorage.getItem('authenticatedUser')`.

## V. Deployment to Vercel

1.  **Environment Variables:**
    *   [ ] Configure all necessary Auth0 environment variables (from your local `.env` file) in your Vercel project settings.
2.  **Deploy:**
    *   [ ] Deploy the project using the Vercel CLI (`vercel --prod`) or via Git integration.
3.  **Post-Deployment Testing:**
    *   [ ] Thoroughly test all functionalities on the deployed Vercel URL.

This checklist should cover all the critical aspects of making your application fully functional with Auth0.
```