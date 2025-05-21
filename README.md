# Auth0 Application Demo

This project is a demonstration application showcasing user authentication and Auth0 Management API interaction using Node.js, designed to be run and deployed with Vercel.

**Core Functionality:**

1.  **User Login**: Implements user login via the backend using Auth0's Resource Owner Password Grant (ROPG) flow.
2.  **Auth0 User Management**: The backend interacts with the Auth0 Management API using a Machine-to-Machine (M2M) application to perform administrative tasks on users (e.g., CRUD operations, role assignments).

**Note**: The primary focus is on the backend API endpoints (`/api/auth.js` for login, `/api/auth0-user-management.js` for admin tasks) and their interaction with Auth0. A simple frontend is included to demonstrate these backend functionalities.

## Project Overview

The application consists of:

*   **Backend APIs (Vercel Serverless Functions):**
    *   `/api/auth`: Handles user login requests. It takes user credentials (username and password), authenticates them against Auth0 using ROPG, and returns user profile information including roles.
    *   `/api/auth0-user-management`: Provides endpoints for managing Auth0 users. It uses M2M credentials to securely obtain tokens for the Auth0 Management API.
*   **Frontend (Static Files):**
    *   Basic HTML and JavaScript files (`index.html`, `protected.html`, `admin.html`, `frontend/app.js`) to interact with the backend APIs and demonstrate login, protected content, and admin functionalities.

## What's Working and How

This section summarizes the application's features from a user/developer perspective:

*   **User Authentication**: Users can log in with their email and password. The backend (`/api/auth.js`) uses Auth0's Resource Owner Password Grant (ROPG) flow to validate credentials and obtain tokens. User roles are fetched via a custom claim (e.g., `https://myapp.example.com/roles`) in the ID token, populated by an Auth0 Action. The namespace for this claim must be configured via the `AUTH0_ROLES_NAMESPACE` environment variable.
*   **User Management (Admin)**: Authenticated admin users can perform CRUD operations (Create, Read, Update, Delete) on users via the "Admin" page. This is handled by backend API calls from `/api/auth0-user-management.js` to the Auth0 Management API using a Machine-to-Machine (M2M) token.
*   **Role Management (Admin)**: Admin users can assign or unassign the 'admin' role to other users from the "Admin" page. This also uses the Auth0 Management API via the backend (`/api/auth0-user-management.js`).
*   **Protected Content**: Pages like `protected.html` (for any authenticated user) and `admin.html` (for authenticated users with an 'admin' role) are only accessible based on authentication status and roles.
*   **Local Testing Mode**: A `LOCAL_TESTING_MODE` flag in `frontend/app.js` allows bypassing Auth0 login for easier UI development and testing of protected routes and role-based UI elements. When enabled, user data (including roles) can be simulated via `localStorage`.

## Authentication Flows Explained

This project utilizes two distinct Auth0 authentication/authorization flows:

### 1. User Login (Resource Owner Password Grant - ROPG)

*   **Purpose**: To allow users to log in by directly providing their username and password to the application's backend.
*   **Credentials Used (from `.env`):** `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`.
*   **Flow**:
    1.  The user submits their email and password via the frontend.
    2.  The frontend sends these credentials to the `/api/auth` backend endpoint.
    3.  The `/api/auth` endpoint makes a POST request to Auth0's `/oauth/token` endpoint with:
        *   `grant_type: 'password'`
        *   `username`: User's email
        *   `password`: User's password
        *   `audience`: `AUTH0_AUDIENCE` (e.g., `https://YOUR_AUTH0_DOMAIN/api/v2/` or a custom API identifier for your application).
        *   `client_id`: `AUTH0_CLIENT_ID` (from your Auth0 "Regular Web Application").
        *   `client_secret`: `AUTH0_CLIENT_SECRET` (from your Auth0 "Regular Web Application").
        *   `scope`: (e.g., `openid profile email offline_access`).
    4.  Auth0 validates credentials against the **Default Directory** (Connection) configured in your Auth0 Tenant Settings.
    5.  If successful, Auth0 returns an `access_token`, `id_token`, and optionally a `refresh_token`. The `/api/auth` endpoint then processes this, potentially extracts user profile and roles (if an Action is configured in Auth0), and returns relevant information to the frontend.

    **Security Note**: ROPG is generally not recommended for new applications, especially SPAs or public clients, due to security risks. It requires a high degree of trust in the client handling the credentials. Consider Authorization Code Grant with PKCE for better security in most scenarios. This demo uses ROPG for illustrative backend-driven login.

### 2. Auth0 Management API Access (Machine-to-Machine - M2M)

*   **Purpose**: To allow the backend (`/api/auth0-user-management.js`) to perform administrative actions on Auth0 users programmatically.
*   **Credentials Used (from `.env`):** `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, `AUTH0_MANAGEMENT_AUDIENCE`.
*   **Flow**:
    1.  The `/api/auth0-user-management.js` endpoint needs to perform an action (e.g., list users, assign a role).
    2.  It makes a POST request to Auth0's `/oauth/token` endpoint with:
        *   `grant_type: 'client_credentials'`
        *   `client_id`: `AUTH0_M2M_CLIENT_ID` (from your Auth0 "Machine to Machine Application").
        *   `client_secret`: `AUTH0_M2M_CLIENT_SECRET` (from your Auth0 "Machine to Machine Application").
        *   `audience`: `AUTH0_MANAGEMENT_AUDIENCE` (which is `https://YOUR_AUTH0_DOMAIN/api/v2/`).
    3.  Auth0 validates the M2M client credentials and returns an `access_token`.
    4.  The backend service uses this `access_token` as a Bearer token in the `Authorization` header when making requests to the Auth0 Management API (e.g., `GET /api/v2/users`, `POST /api/v2/users/{id}/roles`).

## Prerequisites

*   Node.js (LTS version recommended)
*   npm (or yarn)
*   An Auth0 Account
*   Vercel CLI (for local development and deployment): `npm install -g vercel`

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/amitdas022/application-demo.git
    cd application-demo
    ```

2.  **Install dependencies:**
    (Dependencies are typically installed automatically by `vercel dev` or during Vercel deployment. If you need to install them manually for any reason, navigate to the project root where `package.json` is located.)
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project. This file is used by `vercel dev` for local development.
    ```properties
    # Auth0 Application (Regular Web Application) Credentials for ROPG Login Flow
    # Used by /api/auth.js
    AUTH0_DOMAIN=YOUR_AUTH0_TENANT_DOMAIN # e.g., your-tenant.us.auth0.com
    AUTH0_CLIENT_ID=YOUR_RWA_CLIENT_ID
    AUTH0_CLIENT_SECRET=YOUR_RWA_CLIENT_SECRET
    AUTH0_AUDIENCE=https://YOUR_AUTH0_TENANT_DOMAIN/api/v2/ # Or your custom API audience for user tokens

    # Auth0 Machine-to-Machine (M2M) Application Credentials for Management API
    # Used by /api/auth0-user-management.js
    AUTH0_M2M_CLIENT_ID=YOUR_M2M_CLIENT_ID
    AUTH0_M2M_CLIENT_SECRET=YOUR_M2M_CLIENT_SECRET
    AUTH0_MANAGEMENT_AUDIENCE=https://YOUR_AUTH0_TENANT_DOMAIN/api/v2/ # This is always the Management API audience

    # Auth0 Action Namespace for Custom Claims (e.g., roles)
    # This MUST match the namespace defined in your Auth0 Action script.
    # Example: https://myapp.example.com/ (ensure it has a trailing slash if your action uses it)
    AUTH0_ROLES_NAMESPACE=YOUR_CHOSEN_NAMESPACE_FOR_ROLES_CLAIM

    # Optional: Test user credentials for quick testing of the ROPG flow
    # Ensure this user exists in your Auth0 database connection
    TEST_USERNAME=your_test_user@example.com
    TEST_PASSWORD=YourSecurePassword123!
    ```
    Replace placeholder values with your actual Auth0 credentials. See the "Setting Up Your Auth0 Dashboard" section for details on obtaining these.

## Running the Application Locally

This project is configured to run locally using the Vercel CLI, which simulates the Vercel deployment environment.

1.  Ensure you have Vercel CLI installed: `npm install -g vercel`
2.  Navigate to the project root directory:
    ```bash
    cd application-demo
    ```
3.  Start the development server:
    ```bash
    npx vercel dev
    ```
    Vercel CLI will start the server and typically make the application accessible at `http://localhost:3000`. The CLI output will confirm the exact port. Your API endpoints (e.g., `/api/auth`, `/api/auth0-user-management`) and frontend files will be served from this address.

## Local UI Testing (Bypassing Full Auth0 Login)

For easier UI development and testing of protected pages without repeatedly going through the full Auth0 login, `frontend/app.js` includes a `LOCAL_TESTING_MODE`.

1.  **Start the project locally** using `npx vercel dev` as described above.
2.  **Open the application** in your browser (e.g., `http://localhost:3000`).
3.  **Open the browser's developer console** (usually by pressing F12).

### Enable Local Testing Mode:
In the console, execute:
```javascript
window.LOCAL_TESTING_MODE = true;
```
You can now navigate directly to protected pages (e.g., `/protected.html`, `/admin.html`) without logging in.

### Simulating User Roles in Local Testing Mode:
When `LOCAL_TESTING_MODE` is `true`, `frontend/app.js` creates a default non-admin dummy user in `localStorage` if no user is found. You can customize this for testing different roles:

*   **To test as a REGULAR (non-admin) user:**
    1.  Ensure `window.LOCAL_TESTING_MODE = true;` is set in the console.
    2.  Clear any existing simulated user: `localStorage.removeItem('authenticatedUser');`
    3.  Refresh the page or navigate. The `app.js` script will create a default user without admin rights. You should be able to access `protected.html` but be redirected from `admin.html`.

*   **To test as an ADMIN user:**
    1.  Ensure `window.LOCAL_TESTING_MODE = true;` is set in the console.
    2.  Manually create an admin user in `localStorage` via the console:
        ```javascript
        localStorage.setItem('authenticatedUser', JSON.stringify({
            id: 'local-admin-user-sub', // Dummy Auth0 user ID (sub)
            profile: {
                firstName: 'Local', lastName: 'Admin', name: 'Local Admin',
                email: 'admin@local.example.com', picture: 'path/to/default-avatar.png'
            },
            roles: ['user', 'admin'] // Crucially, include 'admin' role
        }));
        ```
    3.  Refresh the page or navigate. You should now be able to access `admin.html` and its functionalities.

### Important Notes for Local Testing Mode:
*   **UI Focus:** This mode is primarily for testing UI elements, client-side logic, and navigation flow.
*   **Backend Interaction:** API calls to `/api/auth0-user-management` will still occur. The backend uses its M2M token for authentication to the Auth0 Management API. **Crucially, the authorization of the *frontend user's action* on the backend (`/api/auth0-user-management.js`) currently has a TODO and would typically involve validating an Auth0 access token sent from the frontend and checking its roles/permissions. In local testing mode, this backend authorization check is bypassed or not fully implemented.**
*   **Security:** `LOCAL_TESTING_MODE` is for development convenience **only** and is not secure. It should never be enabled in production or committed with `true` as its default state.
*   **Disable for Full Testing/Deployment:** Always ensure `window.LOCAL_TESTING_MODE = false;` (or that it's undefined) and clear `localStorage` when testing the complete Auth0 authentication flow or before deploying.

## Setting Up Your Auth0 Dashboard

To set up this project with a new or different Auth0 account, or for initial setup, follow these steps to configure your Auth0 dashboard correctly. This includes creating the necessary applications, APIs, roles, and actions.

### I. Auth0 Tenant Configuration:

1.  **Access your Auth0 Dashboard.**

2.  **Create a "Regular Web Application" (for User Login via ROPG):**
    *   Go to Applications => Applications => Create Application.
    *   Choose "Regular Web Applications". Name: e.g., "My App ROPG Login".
    *   **Settings Tab:**
        *   Note down `Domain`, `Client ID`, `Client Secret`.
        *   Grant Types: Ensure "Password" (Resource Owner Password Credentials) is enabled.
        *   (Optional but Recommended for SPAs if not using ROPG from backend): Enable "Authorization Code" and "Refresh Token".
    *   **Connections Tab:** Enable your desired database connection (e.g., "Username-Password-Authentication").

3.  **Create a "Machine-to-Machine Application" (for Management API Access):**
    *   Go to Applications => Applications => Create Application.
    *   Choose "Machine to Machine Applications". Name: e.g., "My App Management API Access".
    *   Authorize for: "Auth0 Management API".
    *   Grant Scopes (Permissions): Select necessary scopes like `read:users`, `create:users`, `update:users`, `delete:users`, `read:roles`, `update:roles` (for assigning roles).
    *   **Settings Tab:** Note down `Client ID`, `Client Secret`.

4.  **(Optional but Recommended) Create an Auth0 API (for ROPG Audience):**
    *   If you don't want user access tokens from ROPG to target the Auth0 Management API directly (as in the current `.env` example `AUTH0_AUDIENCE=https://.../api/v2/`), create a custom API.
    *   Go to Applications => APIs => Create API. Name: e.g., "My Application API". Identifier (Audience): e.g., `https://api.myapp.com`. This identifier would then be used as `AUTH0_AUDIENCE` in your `.env`.

5.  **Configure Roles:**
    *   Go to User Management => Roles.
    *   Create roles like "admin" and "user".

6.  **Create an Auth0 Action (to Add Roles to Tokens):**
    *   This is crucial for the backend (`/api/auth`) to receive user roles upon login.
    *   Go to Actions => Library => Build Custom.
    *   Name: e.g., "Add Roles to Token". Trigger: "Login / Post Login".
    *   Code:
        ```javascript
        // Action: Add roles to ID Token and Access Token
        exports.onExecutePostLogin = async (event, api) => {
          const namespace = process.env.AUTH0_ROLES_NAMESPACE; // Use the namespace from environment variables
          if (event.authorization) {
            api.idToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
            api.accessToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
          }
        };
        ```
    *   **Important**: For the Action script above, you must configure an Action secret (e.g., name it `AUTH0_ROLES_NAMESPACE`) with the value of your chosen namespace (e.g., `https://myapp.example.com/`). This namespace value must also be set as the `AUTH0_ROLES_NAMESPACE` environment variable in your `.env` file and Vercel deployment.
    *   Deploy the Action. Then, go to Actions => Flows => Login. Drag your custom Action into the flow.
    *   The `/api/auth.js` file will look for this custom claim using the `AUTH0_ROLES_NAMESPACE` (e.g., `decodedAccessToken[process.env.AUTH0_ROLES_NAMESPACE + 'roles']`).

7.  **Set Default Directory for ROPG:**
    *   Go to Tenant Settings (click tenant name in top right) => API Authorization Settings.
    *   Default Directory: Select your primary user database connection (e.g., "Username-Password-Authentication"). Save.

8.  **Configure Application URLs (for the RWA used in ROPG):**
    *   In your "Regular Web Application" settings in Auth0:
        *   Allowed Callback URLs: Add `http://localhost:3000` (or your Vercel deployment URL). While ROPG doesn't use callbacks in the same way as redirect-based flows, it's good practice if you ever add other flows.
        *   Allowed Logout URLs: Add `http://localhost:3000`.
        *   Allowed Web Origins: Add `http://localhost:3000`.

### II. Project Configuration:

1.  **Update `.env` file:**
    Populate your local `.env` file with all the credentials and identifiers obtained from your new Auth0 setup (Domain, Client IDs, Client Secrets, Audiences).

2.  **Update Test Credentials (Optional):**
    If using `TEST_USERNAME` and `TEST_PASSWORD` in `.env`, ensure this user exists in your Auth0 database connection and has the roles you expect for testing.

After these changes, restart your local development server (`npx vercel dev`).

## Deployment to Vercel

1.  **Configure Environment Variables in Vercel:**
    *   Go to your Vercel project settings => Environment Variables.
    *   Add all the environment variables defined in your local `.env` file (e.g., `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, etc.) as environment variables in Vercel. Ensure they are set for the appropriate environments (Production, Preview, Development).
    *   **Do NOT include `TEST_USERNAME` or `TEST_PASSWORD` as production environment variables.**

2.  **Deploy:**
    *   **Via Vercel CLI:**
        ```bash
        vercel --prod
        ```
    *   **Via Git Integration:** If your GitHub repository is connected to Vercel, pushing to your main branch (or configured production branch) will typically trigger an automatic deployment.

3.  **Post-Deployment Testing:**
    *   Thoroughly test all functionalities on the deployed Vercel URL, ensuring the complete Auth0 login flow works and admin features are secured.

## Key Environment Variables (for `.env` and Vercel)

*   `AUTH0_DOMAIN`: Your Auth0 tenant domain (e.g., `your-tenant.us.auth0.com`).
*   `AUTH0_CLIENT_ID`: Client ID for the Auth0 Regular Web Application used for ROPG by `/api/auth.js`.
*   `AUTH0_CLIENT_SECRET`: Client Secret for the Auth0 Regular Web Application.
*   `AUTH0_AUDIENCE`: The audience for the access tokens obtained via ROPG. This could be your custom API identifier or the Auth0 Management API (`https://YOUR_AUTH0_DOMAIN/api/v2/`).
*   `AUTH0_M2M_CLIENT_ID`: Client ID for the Auth0 M2M Application used by `/api/auth0-user-management.js`.
*   `AUTH0_M2M_CLIENT_SECRET`: Client Secret for the Auth0 M2M Application.
*   `AUTH0_MANAGEMENT_AUDIENCE`: The audience for the Auth0 Management API (always `https://YOUR_AUTH0_DOMAIN/api/v2/`).
*   `AUTH0_ROLES_NAMESPACE`: The namespace URL used in your Auth0 Action to add custom claims (like roles) to tokens. This value in `.env` (and Vercel environment variables) MUST exactly match the namespace string used in the Action script and configured as an Action secret.

---

*This README provides guidance based on the project structure and typical Auth0 configurations. Adapt specific Auth0 settings (like namespaces in Actions or exact API audiences) to your precise implementation details.*