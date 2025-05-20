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
        *   **Note on Role Assignment via API:** The `/api/auth0-user-management.js` endpoint includes a placeholder for an `assignRoles` action. However, this functionality is currently not fully implemented, as it requires mapping descriptive role names (e.g., "admin") to their corresponding Auth0 Role IDs (e.g., `rol_xxxxxxxxxxxxxxx`). For now, assigning roles to users should be done manually through the Auth0 dashboard as described in the "Manually Assigning Roles to Users in Auth0" section.
*   **Frontend (Static Files):**
    *   Basic HTML and JavaScript files (`index.html`, `protected.html`, `admin.html`, `frontend/app.js`) to interact with the backend APIs and demonstrate login, protected content, and admin functionalities.

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
    5.  If successful, Auth0 returns an `access_token`, `id_token`, and optionally a `refresh_token`. The `/api/auth` endpoint then processes this, potentially extracts the user profile and custom claims (like roles, if an Auth0 Action is configured to add them), and returns relevant information to the frontend.

    **Security Note**: ROPG is generally not recommended for new applications, especially SPAs or public clients, due to security risks. It requires a high degree of trust in the client handling the credentials. Consider Authorization Code Grant with PKCE for better security in most scenarios. This demo uses ROPG for illustrative backend-driven login where the backend is a confidential client.

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

    # Optional: Test user credentials for quick testing of the ROPG flow
    # Ensure this user exists in your Auth0 database connection
    TEST_USERNAME=your_test_user@example.com
    TEST_PASSWORD=YourSecurePassword123!
    ```
    Replace placeholder values with your actual Auth0 credentials. See the "Setting Up Auth0 for the First Time / Porting from Another Tenant" section for details on obtaining these.

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
*   **Backend Interaction:** API calls to `/api/auth0-user-management` will still occur. The backend uses its M2M token for authentication to the Auth0 Management API. **Crucially, the authorization of the *frontend user's action* on the backend (`/api/auth0-user-management.js`) currently has a "TODO" note in the code. Proper authorization would typically involve the frontend sending its Auth0 access token, which the backend would validate and check for necessary roles/permissions (custom claims). In local testing mode, this backend authorization check is bypassed or not fully implemented.**
*   **Security:** `LOCAL_TESTING_MODE` is for development convenience **only** and is not secure. It should never be enabled in production or committed with `true` as its default state.
*   **Disable for Full Testing/Deployment:** Always ensure `window.LOCAL_TESTING_MODE = false;` (or that it's undefined) and clear `localStorage` when testing the complete Auth0 authentication flow or before deploying.

## Setting Up Auth0 for the First Time / Porting from Another Tenant

To set up this project with your Auth0 account (either new or existing), follow these steps:

### I. Auth0 Tenant Configuration (via Auth0 Dashboard):

1.  **Access your Auth0 Dashboard.**

2.  **Create a "Regular Web Application" (for User Login via ROPG):**
    *   Navigate to "Applications" > "Applications" in the Auth0 dashboard and click "Create Application".
    *   Choose "Regular Web Applications". Name: e.g., "My App ROPG Login".
    *   **Settings Tab:**
        *   Note down `Domain`, `Client ID`, `Client Secret`. These will be used in your `.env` file.
        *   Grant Types: Ensure "Password" (Resource Owner Password Credentials) is enabled. This is crucial for the ROPG flow where the backend directly exchanges user credentials for tokens.
        *   (Optional but Recommended for SPAs if not using ROPG from backend): Enable "Authorization Code" and "Refresh Token".
    *   **Connections Tab:** Enable your desired database connection (e.g., "Username-Password-Authentication"). This is where your users' credentials will be stored and validated.
    *   **Note**: This application is used by your backend (`/api/auth.js`) to authenticate users.

3.  **Create a "Machine-to-Machine Application" (for Management API Access):**
    *   Navigate to "Applications" > "Applications" and click "Create Application".
    *   Choose "Machine to Machine Applications". Name: e.g., "My App Management API Access".
    *   Authorize for: "Auth0 Management API".
    *   Grant Scopes (Permissions): Select necessary scopes for user management. For this demo, you'll likely need: `read:users`, `create:users`, `update:users`, `delete:users`, `read:roles`, `update:roles` (for assigning roles to users), and `read:users_app_metadata`.
    *   **Settings Tab:** Note down `Client ID`, `Client Secret`. These will be used in your `.env` file for M2M authentication.
    *   **Note**: This M2M application is used by your backend (`/api/auth0-user-management.js`) to interact with the Auth0 Management API programmatically (e.g., to list users or, in a future enhancement, assign roles).

4.  **(Optional but Recommended) Create a Custom Auth0 API (to act as Audience for ROPG):**
    *   User access tokens obtained via ROPG need an "audience". While you *can* use the Auth0 Management API audience (`https://YOUR_AUTH0_DOMAIN/api/v2/`) for `AUTH0_AUDIENCE` in your `.env`, it's often better practice to create a separate custom API to represent your own application. This allows for more fine-grained control over token scopes and permissions specific to your app, rather than directly issuing Management API tokens to end-users.
    *   Navigate to "Applications" > "APIs" and click "Create API".
    *   Name: e.g., "My Application API".
    *   Identifier (Audience): e.g., `https://api.myapp.com` (this must be a URI, but doesn't have to be a publicly resolvable URL). This identifier would then be used as `AUTH0_AUDIENCE` in your `.env`.
    *   Signing Algorithm: RS256 is standard.
    *   Leave "RBAC Settings" and other options at their defaults for now unless you have specific needs.

5.  **Configure Roles:**
    *   Navigate to "User Management" > "Roles" in your Auth0 dashboard.
    *   Click the "+ Create Role" button.
    *   For "Name", enter the desired role name (e.g., `admin`, `user`). These names are case-sensitive and should precisely match what your application code and Auth0 Actions expect.
    *   For "Description", provide a brief explanation of the role (e.g., "Administrator role with full access", "Standard user role with basic privileges").
    *   Permissions can be added to roles here if you plan to use Auth0's core Role-Based Access Control (RBAC) features for more granular control within your APIs (i.e., associating specific permissions like `read:reports` with a role). However, for this specific demo application, the role names themselves (e.g., 'admin') are the primary identifiers added as a custom claim to the token by the Auth0 Action, and the backend API primarily checks for the presence of these role names.
    *   **Important**: Consistency in role naming is crucial. The names you define here must exactly match the role names your application logic (e.g., in `/api/auth0-user-management.js` for admin checks, or in your Auth0 Action code) expects. For example, if your code checks for an 'admin' role, the role created in Auth0 must also be named 'admin' (case-sensitive).

6.  **Create an Auth0 Action (to Add Roles to Tokens):**
    *   This Auth0 Action is crucial for adding user roles as a custom claim to the ID and Access Tokens. The backend (`/api/auth.js`) will then parse this custom claim to identify the user's roles.
    *   Navigate to "Actions" in the Auth0 dashboard sidebar, then select "Library". Click on the "Build Custom" card.
        *   Set "Name" to something descriptive (e.g., "Add Roles to Tokens").
        *   Set "Trigger" to "Login / Post Login". This means the Action runs after a user successfully authenticates.
        *   Set "Runtime" to the recommended Node.js version (e.g., Node 18 as of late 2023, or whatever Auth0 defaults to).
        *   Copy and paste the provided JavaScript code into the editor.
    *   Code:
        ```javascript
        // Auth0 Action: Add roles as a custom claim to ID Token and Access Token
        exports.onExecutePostLogin = async (event, api) => {
          const namespace = 'https://application-demo.com/claims/'; // Use a unique, persistent namespace
          if (event.authorization && event.authorization.roles) {
            api.idToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
            api.accessToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
          }
        };
        ```
    *   Click "Deploy" to save and activate the Action.
    *   After deploying, you must add this Action to the "Login" flow. Go to "Actions" > "Flows" from the sidebar. Select the "Login" flow.
    *   On the right side, there's an "Add Action" area. Drag your newly created custom Action (e.g., "Add Roles to Tokens") from the "Custom" tab into the Login flow. Ensure it's placed between "Start" and "Complete".
    *   Click "Apply" to save the changes to the Login Flow.
    *   The `/api/auth.js` file will then need to look for this custom claim (e.g., `decodedAccessToken[namespace + 'roles']`) after token validation to get the user's roles.
    *   **Important**: The `namespace` (e.g., `https://application-demo.com/claims/`) used in this Action code is a URI that creates a unique identifier for your custom claims. It *must* exactly match the namespace your backend API (`api/auth.js`) uses to retrieve the roles from the token. If you change it in one place, you must change it in the other. It doesn't need to be a publicly accessible URL.

### Manually Assigning Roles to Users in Auth0

After creating roles (e.g., `admin`, `user`) and configuring the Auth0 Action to add these roles as custom claims to tokens, you need to assign these roles to your users. This is typically done manually via the Auth0 Dashboard, especially during initial setup or for specific user promotions/demotions.

1.  In your Auth0 Dashboard, navigate to "User Management" > "Users".
2.  Find and click on the user to whom you want to assign roles. This will open the user's profile details.
3.  Scroll down to the "Roles" tab within the user's profile page (or it might be a dedicated "Roles" section/button depending on the Auth0 UI version).
4.  Click on "Assign Roles" (or a similarly named button like "+ Add Role").
5.  A dialog will appear listing the available roles you created (e.g., `admin`, `user`). Select the desired role(s) for this user.
6.  Click "Assign" (or "Confirm" / "Save") to apply the roles to the user.

**Explanatory Note**: This manual assignment is crucial. For example, for a user to have administrative privileges in this application, they must be explicitly assigned the `admin` role in the Auth0 dashboard. The application then reads this role (which the Auth0 Action added as a custom claim to the token) upon login to determine the user's access level.

**Optional Verification**: You can verify role assignment by checking the "Roles" tab for the user in the Auth0 dashboard. After logging in as that user in your application, you can also inspect the decoded Access Token (e.g., using a tool like jwt.io or by logging it in the backend) to see if the custom claim with roles is present. The application should then grant permissions as expected (e.g., access to admin pages if the `admin` role was assigned and present in the token).

7.  **Set Default Directory for ROPG:**
    *   Go to Tenant Settings (click tenant name in top right) => API Authorization Settings.
    *   Default Directory: Select your primary user database connection (e.g., "Username-Password-Authentication"). Save.

8.  **Configure Application URLs (for the RWA used in ROPG):**
    *   In your "Regular Web Application" settings in Auth0:
        *   Allowed Callback URLs: Add `http://localhost:3000` (or your Vercel deployment URL). While ROPG doesn't use callbacks in the same way as redirect-based flows, it's good practice if you ever add other flows.
        *   Allowed Logout URLs: Add `http://localhost:3000`.
        *   Allowed Web Origins: Add `http://localhost:3000`.

### II. Project Environment Configuration:

1.  **Update `.env` file:**
    Populate your local `.env` file with all the credentials and identifiers obtained from your new Auth0 setup (Domain, Client IDs, Client Secrets, Audiences).

2.  **Update Test Credentials (Optional):**
    If using `TEST_USERNAME` and `TEST_PASSWORD` in `.env`, ensure this user exists in your Auth0 database connection and has the roles you expect for testing.

After these changes, restart your local development server (`npx vercel dev`).

## Deployment to Vercel

1.  **Configure Environment Variables in Vercel:**
    *   Go to your Vercel project settings => Environment Variables.
    *   Add all the environment variables defined in your local `.env` file (e.g., `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, etc.) as environment variables in Vercel. Ensure they are set for the appropriate environments (Production, Preview, Development).
    *   **Do NOT include `TEST_USERNAME` or `TEST_PASSWORD` as production environment variables.** These are for local testing convenience only.

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

---

*This README provides guidance based on the project structure and typical Auth0 configurations. Adapt specific Auth0 settings (like the exact namespace in Actions or precise API audiences) to your particular implementation details and security requirements.*

```