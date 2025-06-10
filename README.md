Auth0 Application Demo
======================

This project is a demonstration application showcasing user authentication (now with Authorization Code Flow) and Auth0 Management API interaction using Node.js, designed to be run and deployed with Vercel.

**Core Functionality:**

1.  **User Login**: Implements secure user login via the backend using Auth0's **Authorization Code Flow**.

2.  **Auth0 User Management**: The backend interacts with the Auth0 Management API using a Machine-to-Machine (M2M) application to perform administrative tasks on users (e.g., CRUD operations, role assignments).

**Note**: The primary focus is on the backend API endpoints (`/api/auth.js` for login, `/api/auth0-user-management.js` for admin tasks) and their interaction with Auth0. A simple frontend is included to demonstrate these backend functionalities.

Project Overview
----------------

The application consists of:

-   **Backend APIs (Vercel Serverless Functions):**

    -   `/api/auth`: Handles the exchange of an authorization code for user tokens, securely communicating with Auth0. It returns user profile information including roles.

    -   `/api/auth0-user-management`: Provides endpoints for managing Auth0 users. It uses M2M credentials to securely obtain tokens for the Auth0 Management API.

-   **Frontend (Static Files):**

    -   Basic HTML and JavaScript files (`index.html`, `login.html`, `callback.html`, `protected.html`, `admin.html`, `frontend/app.js`) to interact with the backend APIs and demonstrate login, protected content, and admin functionalities.

What's Working and How
----------------------

This section summarizes the application's features from a user/developer perspective:

-   **User Authentication (Authorization Code Flow)**: Users log in by being redirected to Auth0's Universal Login page. After successful authentication, Auth0 redirects the user back to `/callback.html`, which then sends an authorization code to your backend (`/api/auth.js`). The backend securely exchanges this code for `id_token`, `access_token`, and `refresh_token`. User roles are fetched via a custom claim (e.g., `https://myapp.example.com/roles`) in the ID token, populated by an Auth0 Action. The namespace for this claim must be configured via the `AUTH0_ROLES_NAMESPACE` environment variable.

-   **Logout**: When a user logs out, their local session is cleared, and they are redirected to Auth0's `/v2/logout` endpoint to terminate their session with Auth0. Auth0 then redirects them back to your application's login page.

-   **User Management (Admin)**: Authenticated admin users can perform CRUD operations (Create, Read, Update, Delete) on users via the "Admin" page. This is handled by backend API calls from `/api/auth0-user-management.js` to the Auth0 Management API using a Machine-to-Machine (M2M) token.

-   **Role Management (Admin)**: Admin users can assign or unassign the 'admin' role to other users from the "Admin" page. This also uses the Auth0 Management API via the backend (`/api/auth0-user-management.js`).

-   **Protected Content**: Pages like `protected.html` (for any authenticated user) and `admin.html` (for authenticated users with an 'admin' role) are only accessible based on authentication status and roles.

-   **Local UI Testing Mode**: A `LOCAL_TESTING_MODE` flag in `frontend/app.js` allows bypassing Auth0 login for easier UI development and testing of protected routes and role-based UI elements. When enabled, user data (including roles) can be simulated via `localStorage`.

Authentication Flows Explained
------------------------------

This project utilizes two distinct Auth0 authentication/authorization flows:

### 1\. User Login (Authorization Code Flow)

-   **Purpose**: To allow users to securely log in to your application. This is the recommended OAuth 2.0 flow for web applications.

-   **Credentials Used (from `.env`):**  `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_SECRET`.

-   **Flow**:

    1.  The user clicks "Login with Auth0" on your frontend (`login.html`).

    2.  Your frontend (`app.js`) constructs an authorization request URL with parameters like `client_id`, `redirect_uri`, `response_type=code`, `scope` (e.g., `openid profile email offline_access`), `audience` (if calling an API), and a `state` parameter (for CSRF protection).

    3.  The user's browser is redirected to Auth0's Universal Login page.

    4.  The user enters their credentials directly with Auth0.

    5.  Auth0 authenticates the user and, upon success, redirects the user's browser back to your configured `redirect_uri` (`callback.html`), appending an authorization `code` and the `state` parameter to the URL.

    6.  Your `callback.html` page loads `app.js`, which extracts the `code` and `state`. It validates the `state` (client-side in this demo, but ideally also server-side).

    7.  Your frontend (`app.js`) then sends this authorization `code` to your backend endpoint (`/api/auth`).

    8.  Your backend (`/api/auth.js`) makes a **server-to-server POST request** to Auth0's `/oauth/token` endpoint, exchanging the `code` for an `access_token`, `id_token`, and `refresh_token`. This exchange uses your `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` (which are securely stored on the backend).

    9.  Auth0 validates the `code` and the client credentials. If successful, it issues the tokens.

    10. Your backend processes the tokens (decodes the `id_token` to extract profile and roles) and returns relevant information to the frontend.

### 2\. Auth0 Management API Access (Machine-to-Machine - M2M)

-   **Purpose**: To allow the backend (`/api/auth0-user-management.js`) to perform administrative actions on Auth0 users programmatically.

-   **Credentials Used (from `.env`):**  `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, `AUTH0_MANAGEMENT_AUDIENCE`.

-   **Flow**:

    1.  The `/api/auth0-user-management.js` endpoint needs to perform an action (e.g., list users, assign a role).

    2.  It makes a POST request to Auth0's `/oauth/token` endpoint with:

        -   `grant_type: 'client_credentials'`

        -   `client_id`: `AUTH0_M2M_CLIENT_ID` (from your Auth0 "Machine to Machine Application").

        -   `client_secret`: `AUTH0_M2M_CLIENT_SECRET` (from your Auth0 "Machine to Machine Application").

        -   `audience`: `AUTH0_MANAGEMENT_AUDIENCE` (which is `https://YOUR_AUTH0_DOMAIN/api/v2/`).

    3.  Auth0 validates the M2M client credentials and returns an `access_token`.

    4.  The backend service uses this `access_token` as a Bearer token in the `Authorization` header when making requests to the Auth0 Management API (e.g., `GET /api/v2/users`, `POST /api/v2/users/{id}/roles`).

Prerequisites
-------------

-   Node.js (LTS version recommended)

-   npm (or yarn)

-   An Auth0 Account

-   Vercel CLI (for local development and deployment): `npm install -g vercel`

Setup and Installation
----------------------

1.  **Clone the repository:**

    ```
    git clone https://github.com/amitdas022/application-demo.git
    cd application-demo

    ```

2.  **Install dependencies:** (Dependencies are typically installed automatically by `vercel dev` or during Vercel deployment. If you need to install them manually for any reason, navigate to the project root where `package.json` is located.)

    ```
    npm install
    # or
    # yarn install

    ```

3.  **Configure Environment Variables:** Create a `.env` file in the root of the project. This file is used by `vercel dev` for local development.

    ```
    # Auth0 Application (Regular Web Application/SPA) Credentials for Authorization Code Flow
    # Used by frontend (build-time injection) and /api/auth.js
    AUTH0_DOMAIN=YOUR_AUTH0_TENANT_DOMAIN # e.g., your-tenant.us.auth0.com
    AUTH0_CLIENT_ID=YOUR_RWA_CLIENT_ID # Client ID of your Auth0 Regular Web Application (for frontend and backend)
    AUTH0_CLIENT_SECRET=YOUR_RWA_CLIENT_SECRET # Client Secret of your Auth0 Regular Web Application (used only by backend /api/auth.js)
    AUTH0_AUDIENCE=https://YOUR_AUTH0_TENANT_DOMAIN/api/v2/ # Or your custom API audience if you have one

    # Auth0 Machine-to-Machine (M2M) Application Credentials for Management API
    # Used by /api/auth0-user-management.js
    AUTH0_M2M_CLIENT_ID=YOUR_M2M_CLIENT_ID
    AUTH0_M2M_CLIENT_SECRET=YOUR_M2M_CLIENT_SECRET
    AUTH0_MANAGEMENT_AUDIENCE=https://YOUR_AUTH0_TENANT_DOMAIN/api/v2/ # This is always the Management API audience

    # Auth0 Action Namespace for Custom Claims (e.g., roles)
    # This MUST match the namespace defined in your Auth0 Action script.
    # Example: https://myapp.example.com/ (ensure it has a trailing slash if your action uses it)
    AUTH0_ROLES_NAMESPACE=YOUR_CHOSEN_NAMESPACE_FOR_ROLES_CLAIM

    # Optional: Test user credentials for quick testing of the ROPG flow (no longer directly used by frontend login)
    # Ensure this user exists in your Auth0 database connection
    # TEST_USERNAME=your_test_user@example.com
    # TEST_PASSWORD=YourSecurePassword123!

    ```

    Replace placeholder values with your actual Auth0 credentials. See the "Setting Up Your Auth0 Dashboard" section for details on obtaining these.

Running the Application Locally
-------------------------------

This project is configured to run locally using the Vercel CLI, which simulates the Vercel deployment environment.

1.  Ensure you have Vercel CLI installed: `npm install -g vercel`

2.  Navigate to the project root directory:

    ```
    cd application-demo

    ```

3.  Start the development server:

    ```
    npx vercel dev

    ```

    Vercel CLI will start the server and typically make the application accessible at `http://localhost:3000`. The CLI output will confirm the exact port. Your API endpoints (e.g., `/api/auth`, `/api/auth0-user-management`) and frontend files will be served from this address.

Local UI Testing (Bypassing Full Auth0 Login)
---------------------------------------------

For easier UI development and testing of protected pages without repeatedly going through the full Auth0 login, `frontend/app.js` includes a `LOCAL_TESTING_MODE`.

1.  **Start the project locally** using `npx vercel dev` as described above.

2.  **Open the application** in your browser (e.g., `http://localhost:3000`).

3.  **Open the browser's developer console** (usually by pressing F12).

### Enable Local Testing Mode:

In the console, execute:

```
window.LOCAL_TESTING_MODE = true;

```

You can now navigate directly to protected pages (e.g., `/protected.html`, `/admin.html`) without logging in.

### Simulating User Roles in Local Testing Mode:

When `LOCAL_TESTING_MODE` is `true`, `frontend/app.js` creates a default non-admin dummy user in `localStorage` if no user is found. You can customize this for testing different roles:

-   **To test as a REGULAR (non-admin) user:**

    1.  Ensure `window.LOCAL_TESTING_MODE = true;` is set in the console.

    2.  Clear any existing simulated user: `localStorage.removeItem('authenticatedUser');`

    3.  Refresh the page or navigate. The `app.js` script will create a default user without admin rights. You should be able to access `protected.html` but be redirected from `admin.html`.

-   **To test as an ADMIN user:**

    1.  Ensure `window.LOCAL_TESTING_MODE = true;` is set in the console.

    2.  Manually create an admin user in `localStorage` via the console:

        ```
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

-   **UI Focus:** This mode is primarily for testing UI elements, client-side logic, and navigation flow.

-   **Backend Interaction:** API calls to `/api/auth0-user-management` will still occur. The backend uses its M2M token for authentication to the Auth0 Management API. **Crucially, the authorization of the** ***frontend user's action***** on the backend (`/api/auth0-user-management.js`) currently does not explicitly validate the *****user's***** access token for permissions. It relies on the client-side `checkAuthAndRedirect` for UI gatekeeping.** For production, you should add server-side validation of the user's access token and its associated roles/permissions to these management endpoints.

-   **Security:**  `LOCAL_TESTING_MODE` is for development convenience **only** and is not secure. It should never be enabled in production or committed with `true` as its default state.

-   **Disable for Full Testing/Deployment:** Always ensure `window.LOCAL_TESTING_MODE = false;` (or that it's undefined) and clear `localStorage` when testing the complete Auth0 authentication flow or before deploying.

Setting Up Your Auth0 Dashboard
-------------------------------

To set up this project with a new or different Auth0 account, or for initial setup, follow these steps to configure your Auth0 dashboard correctly. This includes creating the necessary applications, APIs, roles, and actions.

### I. Auth0 Tenant Configuration:

1.  **Access your Auth0 Dashboard.**

2.  **Create a "Regular Web Application" (for User Login via Authorization Code Flow):**

    -   Go to Applications => Applications => Create Application.

    -   Choose "Regular Web Applications". Name: e.g., "My App Auth Code Login".

    -   **Settings Tab:**

        -   Note down `Domain`, `Client ID`, `Client Secret`.

        -   **Grant Types**: Ensure **"Authorization Code"** and **"Refresh Token"** are enabled. (Disable "Password" grant type, as it's no longer used).

        -   **Allowed Callback URLs**: Add `http://localhost:3000/callback.html` (for local development) and your production callback URL (e.g., `https://your-app.com/callback.html`). This is where Auth0 will redirect after successful login.

        -   **Allowed Logout URLs**: Add `http://localhost:3000/login.html` (for local development) and your production login page URL (e.g., `https://your-app.com/login.html`). This is where Auth0 will redirect after successful logout.

        -   Allowed Web Origins: Add `http://localhost:3000` (for local development) and your production app's origin (e.g., `https://your-app.com`).

    -   **Connections Tab:** Enable your desired database connection (e.g., "Username-Password-Authentication").

    -   **Go to Dashboard Settings Menu (IMPORTANT)** Dashboard => Settings => API Authorization Settings => Default Directory => Username-Password-Authentication(or the name of the DB you are using) => Save

3.  **Create a "Machine-to-Machine Application" (for Management API Access):**

    -   Go to Applications => Applications => Create Application.

    -   Choose "Machine to Machine Applications". Name: e.g., "My App Management API Access".

    -   Authorize for: "Auth0 Management API".

    -   Grant Scopes (Permissions): Select necessary scopes like `read:users`, `create:users`, `update:users`, `delete:users`, `read:roles`, `update:roles` (for assigning roles).

    -   Choose the option Client Secret(Basic) option under Authentication Method.

    -   **Settings Tab:** Note down `Client ID`, `Client Secret`.

4.  **(Optional but Recommended) Create an Auth0 API (for `AUTH0_AUDIENCE`):**

    -   If you want user access tokens to target a specific API of yours, create a custom API.

    -   Go to Applications => APIs => Create API. Name: e.g., "My Application API". Identifier (Audience): e.g., `https://api.myapp.com`. This identifier would then be used as `AUTH0_AUDIENCE` in your `.env`. If you omit this, `AUTH0_AUDIENCE` can be left empty in your frontend's `app.js` and in `api/auth.js` for now, or it will default to the Auth0 Management API if specified in the backend's environment variables.

5.  **Configure Roles:**

    -   Go to User Management => Roles.

    -   Create roles like "admin" and "user".

6.  **Create an Auth0 Action (to Add Roles to Tokens):**

    -   This is crucial for the backend (`/api/auth`) to receive user roles upon login.

    -   Go to Actions => Library => Build Custom.

    -   Name: e.g., "Add Roles to Token". Trigger: "Login / Post Login".

    -   Code:

        ```
        // Action: Add roles to ID Token and Access Token
        exports.onExecutePostLogin = async (event, api) => {
          const namespace = event.secrets.AUTH0_ROLES_NAMESPACE; // Use the namespace from Action secret
          if (event.authorization) {
            api.idToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
            api.accessToken.setCustomClaim(`${namespace}roles`, event.authorization.roles);
          }
        };

        ```

    -   **Important**: For the Action script above, you must configure an Action secret (e.g., name it `AUTH0_ROLES_NAMESPACE`) with the value of your chosen namespace (e.g., `https://myapp.example.com/`). This namespace value must also be set as the `AUTH0_ROLES_NAMESPACE` environment variable in your `.env` file and Vercel deployment.

    -   Deploy the Action. Then, go to Actions => Triggers => Post Login. Drag your custom Action into the flow.

7.  **Check Default Directory for Login Application:**

    -   Go to Authentication => Database => Username-Password-Authentication => Applications

    -   Check if your "Regular Web Application" is enabled for this DB connection.

### II. Project Configuration:

1.  **Update `.env` file:** Populate your local `.env` file with all the credentials and identifiers obtained from your new Auth0 setup (Domain, Client IDs, Client Secrets, Audiences).

2.  **Update Test Credentials (Optional):** If using `TEST_USERNAME` and `TEST_PASSWORD` in `.env`, ensure this user exists in your Auth0 database connection and has the roles you expect for testing.

After these changes, restart your local development server (`npx vercel dev`).

Deployment to Vercel
--------------------

1.  **Configure Environment Variables in Vercel:**

    -   Go to your Vercel project settings => Environment Variables.

    -   Add all the environment variables defined in your local `.env` file (e.g., `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, etc.) as environment variables in Vercel. Ensure they are set for the appropriate environments (Production, Preview, Development).

    -   **Crucially**, the `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `AUTH0_AUDIENCE` values injected into the frontend `app.js` need to be present as environment variables in your Vercel project settings.

    -   **Do NOT include `TEST_USERNAME` or `TEST_PASSWORD` as production environment variables.**

2.  **Deploy:**

    -   **Via Vercel CLI:**

        ```
        vercel --prod

        ```

    -   **Via Git Integration:** If your GitHub repository is connected to Vercel, pushing to your main branch (or configured production branch) will typically trigger an automatic deployment.

3.  **Post-Deployment Testing:**

    -   Thoroughly test all functionalities on the deployed Vercel URL, ensuring the complete Auth0 login flow works and admin features are secured. Verify logout functionality.

Key Environment Variables (for `.env` and Vercel)
-------------------------------------------------

-   `AUTH0_DOMAIN`: Your Auth0 tenant domain (e.g., `your-tenant.us.auth0.com`).

-   `AUTH0_CLIENT_ID`: Client ID for the Auth0 Regular Web Application/SPA used by frontend for redirect and by `/api/auth.js` for code exchange.

-   `AUTH0_CLIENT_SECRET`: Client Secret for the Auth0 Regular Web Application/SPA. **Used only by `api/auth.js` backend, never exposed on frontend.**

-   `AUTH0_AUDIENCE`: The audience for the access tokens obtained via Authorization Code Flow. This could be your custom API identifier or the Auth0 Management API (`https://YOUR_AUTH0_DOMAIN/api/v2/`).

-   `AUTH0_M2M_CLIENT_ID`: Client ID for the Auth0 M2M Application used by `/api/auth0-user-management.js`.

-   `AUTH0_M2M_CLIENT_SECRET`: Client Secret for the Auth0 M2M Application.

-   `AUTH0_MANAGEMENT_AUDIENCE`: The audience for the Auth0 Management API (always `https://YOUR_AUTH0_DOMAIN/api/v2/`).

-   `AUTH0_ROLES_NAMESPACE`: The namespace URL used in your Auth0 Action to add custom claims (like roles) to tokens. This value in `.env` (and Vercel environment variables) MUST exactly match the namespace string used in the Action script and configured as an Action secret.