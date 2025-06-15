Okta Customer Identity Cloud (CIC) Application Demo
===================================================

===================================================

This project is a demonstration application showcasing user authentication (Authorization Code Flow) and secure Okta Management API interaction using Node.js, designed to be run and deployed with Vercel.

**Core Functionality:**

1.  **User Login**: Implements secure user login via the backend using Okta CIC's **Authorization Code Flow**.

2.  **Okta User Management**: The backend securely interacts with the Okta Management API using **OAuth 2.0 Client Credentials Grant (Private Key JWT)** to perform administrative tasks on users (e.g., CRUD operations, group/role assignments). This endpoint also includes **server-side authorization** to ensure only legitimate administrators can trigger these operations.

**Note**: The primary focus is on the backend API endpoints (`/api/auth.js` for user login, `/api/okta-user-management.js` for admin tasks) and their secure interaction with the Okta platform. A simple frontend is included to demonstrate these backend functionalities.

Project Overview
----------------

The application consists of:

-   **Backend APIs (Vercel Serverless Functions):**

    -   `/api/auth`: Handles the exchange of an authorization code for user tokens, securely communicating with Okta CIC. It returns user profile information including roles (derived from Okta groups).

    -   `/api/okta-user-management`: Provides endpoints for managing Okta users and their group assignments. It uses the **OAuth 2.0 Client Credentials Grant with Private Key JWT** for secure, machine-to-machine access to the Okta Management API. This endpoint also includes **server-side validation** of the end-user's access token to enforce role-based access.

-   **Frontend (Static Files):**

    -   Basic HTML and JavaScript files (`index.html`, `login.html`, `callback.html`, `protected.html`, `admin.html`, `frontend/app.js`) to interact with the backend APIs and demonstrate login, protected content, and admin functionalities against Okta CIC.

What's Working and How
----------------------

This section summarizes the application's features from a user/developer perspective:

-   **User Authentication (Authorization Code Flow)**: Users log in by being redirected to Okta CIC's Universal Login page. After successful authentication, Okta CIC redirects the user back to `/callback.html`, which then sends an authorization code to your backend (`/api/auth.js`). The backend securely exchanges this code for `id_token`, `access_token`, and `refresh_token`. User roles are derived from Okta group memberships, which are included as a `groups` claim in the ID token. The `groups` claim is configured in Okta to be **always** included in the ID token if a user has group memberships.

-   **Logout**: When a user logs out, their local session is cleared, and they are redirected to Okta CIC's logout endpoint to terminate their session. Okta CIC then redirects them back to your application's login page.

-   **User Management (Admin)**: Authenticated admin users can perform CRUD operations (Create, Read, Update, Delete) on users via the "Admin" page. This is handled by backend API calls from `/api/okta-user-management.js` to the Okta Management API using a dynamically obtained **OAuth 2.0 Access Token (via Private Key JWT)**. **Crucially, these backend calls are protected by server-side authorization, validating the calling end-user's access token and ensuring they possess the 'Admin' role.**

    -   **New User Onboarding Automation:** When a new user is created through the application's interface, they are automatically assigned to the `AccessBoardUsers` Okta group. This ensures immediate access to the application for newly registered users, provided this group is assigned to your Okta application.

-   **Role Management (Admin)**: Admin users can assign or unassign the `'Admin'` role (which corresponds to membership in an "Admin" group in Okta) to other users from the "Admin" page. This also uses the Okta Management API via the backend (`/api/okta-user-management.js`), with **server-side authorization** applied.

-   **Protected Content**: Pages like `protected.html` (for any authenticated user) and `admin.html` (for authenticated users with an 'Admin' role/group) are only accessible based on authentication status and roles.

-   **Local UI Testing Mode**: A `LOCAL_TESTING_MODE` flag in `frontend/app.js` allows bypassing Okta CIC login for easier UI development and testing of protected routes and role-based UI elements. When enabled, user data (including roles) can be simulated via `localStorage`.

Authentication Flows Explained
------------------------------

This project utilizes Okta CIC for authentication and authorization:

### 1\. User Login (Authorization Code Flow with Okta CIC)

-   **Purpose**: To allow users to securely log in to your application using Okta CIC. This is the recommended OAuth 2.0 flow for web applications.

-   **Credentials Used (from `.env`):**  `AUTH0_DOMAIN` (now your Okta domain), `AUTH0_CLIENT_ID` (Okta OIDC app client ID), `AUTH0_CLIENT_SECRET` (Okta OIDC app client secret), `AUTH0_AUDIENCE` (Okta Authorization Server audience, typically `api://default`).

-   **Flow**:

    1.  The user clicks "Login with Okta" on your frontend (`login.html`).

    2.  Your frontend (`app.js`) constructs an authorization request URL for Okta's `/authorize` endpoint with parameters like `client_id`, `redirect_uri`, `response_type=code`, `scope` (e.g., `openid profile email offline_access groups`), `audience` (if applicable), and a `state` parameter.

    3.  The user's browser is redirected to Okta CIC's Universal Login page.

    4.  The user enters their credentials directly with Okta CIC.

    5.  Okta CIC authenticates the user and, upon success, redirects the user's browser back to your configured `redirect_uri` (`callback.html`), appending an authorization `code` and the `state` parameter.

    6.  Your `callback.html` page loads `app.js`, which extracts the `code` and `state`. It validates the `state`.

    7.  Your frontend (`app.js`) then sends this authorization `code` to your backend endpoint (`/api/auth`).

    8.  Your backend (`/api/auth.js`) makes a **server-to-server POST request** to Okta's `/oauth2/default/v1/token` endpoint (or your custom authorization server's token endpoint), exchanging the `code` for an `access_token`, `id_token`, and `refresh_token`. This exchange uses your Okta `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`. **Crucially, the request's `Content-Type` header is `application/x-www-form-urlencoded`, and the body is URL-encoded form parameters.**

    9.  Okta CIC validates the `code` and the client credentials. If successful, it issues the tokens.

    10. Your backend processes the tokens (decodes the `id_token` to extract profile and group claims for roles) and returns relevant information to the frontend.

### 2\. Okta Management API Access (OAuth 2.0 Client Credentials Grant with Private Key JWT)

-   **Purpose**: To allow the backend (`/api/okta-user-management.js`) to securely perform administrative actions on Okta users and groups programmatically, **only when requested by an authorized end-user.** This is a modern, secure method for server-to-server (machine-to-machine) authentication.

-   **Credentials Used (from `.env`):**  `AUTH0_DOMAIN` (Okta domain), `OKTA_M2M_CLIENT_ID` (Okta API Services app Client ID), `OKTA_M2M_PRIVATE_KEY` (base64 encoded private key).

-   **Flow**:

    1.  An **authenticated end-user** (e.g., an administrator logged into your frontend) makes a request to a user management function in your frontend (e.g., "Load Users", "Create User").

    2.  Your frontend (`app.js`) sends this request to your backend endpoint (`/api/okta-user-management`), including the **end-user's `access_token`** in the `Authorization: Bearer` header.

    3.  Your backend (`/api/okta-user-management.js`) receives the request. Before processing it, it performs **server-side authorization**:

        -   It extracts the `access_token` from the request header.

        -   It calls Okta's `/oauth2/default/v1/userinfo` endpoint, presenting the end-user's `access_token`.

        -   Okta's `/userinfo` endpoint validates the `access_token` and returns the end-user's claims, including their `groups` (roles).

        -   Your backend checks if the `groups` claim contains the 'Admin' role.

        -   If the token is invalid, expired, or the user is not an 'Admin', the backend immediately sends an appropriate error response (e.g., 401 Unauthorized, 403 Forbidden) to the frontend.

    4.  **If the end-user is authorized (i.e., confirmed as an 'Admin'):**

        -   Your backend then obtains a **new M2M access token** from the **Okta Org Authorization Server** (`https://YOUR_OKTA_DOMAIN/oauth2/v1/token`). This token request is authenticated using the **Private Key JWT** method:

            -   It dynamically generates a JSON Web Token (JWT), signing it with your securely stored private key (read from `OKTA_M2M_PRIVATE_KEY` environment variable). This JWT serves as the `client_assertion`.

            -   It sends this `client_assertion` and the `OKTA_M2M_CLIENT_ID` to the Org Authorization Server's token endpoint.

        -   Okta verifies the `client_assertion` using the public key you registered for your M2M application. If successful, it issues a short-lived access token with `okta.*` scopes (e.g., `okta.users.read`, `okta.users.manage`).

        -   This M2M access token is then used in the `Authorization: Bearer` header to make the actual administrative API call to the Okta Management API (e.g., `GET /api/v1/users`, `PUT /api/v1/groups/{groupId}/users/{userId}`).

        -   Okta performs the requested management operation.

        -   The backend returns the result to the frontend.

Prerequisites
-------------

-   Node.js (LTS version recommended, v18.x or higher)

-   npm (or yarn)

-   An Okta CIC Account (or a free Okta Developer Account which includes CIC features)

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
    # Okta OIDC Application Credentials for Authorization Code Flow (User Login)
    # Used by frontend (via /api/config) and /api/auth.js
    AUTH0_DOMAIN=YOUR_OKTA_DOMAIN # e.g., dev-123456.okta.com (Do not include https://)
    AUTH0_CLIENT_ID=YOUR_OKTA_OIDC_APP_CLIENT_ID
    AUTH0_CLIENT_SECRET=YOUR_OKTA_OIDC_APP_CLIENT_SECRET # Used only by backend /api/auth.js
    AUTH0_AUDIENCE=api://default # Typically 'api://default' for the Org Authorization Server.

    # Okta API Services Application Credentials for Management API (M2M)
    # Used by /api/okta-user-management.js for private_key_jwt authentication
    OKTA_M2M_CLIENT_ID=YOUR_OKTA_M2M_APP_CLIENT_ID
    OKTA_M2M_PRIVATE_KEY=YOUR_BASE64_ENCODED_M2M_PRIVATE_KEY # Full content of your privatekey.pem, base64 encoded, on a single line

    ```

    Replace placeholder values with your actual Okta credentials. See the "Setting Up Your Okta CIC Environment" section for details.

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

    Vercel CLI will start the server and typically make the application accessible at `http://localhost:3000`. The CLI output will confirm the exact port. Your API endpoints (e.g., `/api/auth`, `/api/okta-user-management`) and frontend files will be served from this address.

Local UI Testing (Bypassing Full Okta CIC Login)
------------------------------------------------

For easier UI development and testing of protected pages without repeatedly going through the full Okta CIC login, `frontend/app.js` includes a `LOCAL_TESTING_MODE`.

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
            id: 'local-admin-user-okta-id', // Dummy Okta user ID
            profile: {
                firstName: 'Local', lastName: 'Admin', name: 'Local Admin',
                email: 'admin@local.example.com', picture: 'path/to/default-avatar.png'
            },
            roles: ['user', 'Admin'] // Crucially, include 'Admin' group/role (Okta group name)
        }));

        ```

    3.  Refresh the page or navigate. You should now be able to access `admin.html` and its functionalities.

### Important Notes for Local Testing Mode:

-   **UI Focus:** This mode is primarily for testing UI elements, client-side logic, and navigation flow.

-   **Backend Interaction:** API calls to `/api/okta-user-management` will still occur. The backend uses its securely configured M2M credentials for authentication to the Okta Management API.

-   **Security:**  `LOCAL_TESTING_MODE` is for development convenience **only** and is not secure. It should never be enabled in production or committed with `true` as its default state.

-   **Disable for Full Testing/Deployment:** Always ensure `window.LOCAL_TESTING_MODE = false;` (or that it's undefined) and clear `localStorage` when testing the complete Okta CIC authentication flow or before deploying.

Setting Up Your Okta CIC Environment
------------------------------------

To set up this project with Okta Customer Identity Cloud, follow these steps:

### I. Okta CIC Configuration:

1.  **Access your Okta Admin Dashboard.** (If you don't have one, you can sign up for a free Okta Developer account).

2.  **Create an OIDC Web Application (for User Login):**

    -   Navigate to **Applications > Applications**.

    -   Click **Create App Integration**.

    -   Select **OIDC - OpenID Connect** as the sign-in method.

    -   Select **Web Application** as the Application type. Click **Next**.

    -   **App integration name:** e.g., "My Vercel App".

    -   **Grant type:** Ensure **Authorization Code** is checked. **Refresh Token** should also be checked for session persistence.

    -   **Sign-in redirect URIs:** Add `http://localhost:3000/callback.html` (for local development) and your production callback URL (e.g., `https://your-app-domain.vercel.app/callback.html`).

    -   **Sign-out redirect URIs:** Add `http://localhost:3000/index.html` (for local development) and your production login page URL (e.g., `https://your-app-domain.vercel.app/index.html`).

    -   **Assignments:** Assign to specific users or groups as needed, or allow "Everyone".

    -   Save the application.

    -   On the application's General tab, note down the **Client ID** and **Client secret**. Your **Okta domain** (e.g., `dev-123456.okta.com`) is visible in the URL or top-right corner of the dashboard. These correspond to `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_DOMAIN` in your `.env` file.

    -   **Audience (`AUTH0_AUDIENCE`):** This typically defaults to `api://default` for the Org Authorization Server. If using a custom authorization server, use its audience. **Ensure this is `api://default` and NOT your Client ID.**

3.  **Create an API Services Application (for M2M API Access):**

    -   This application will be used by your backend serverless function to securely access the Okta Management API using Client Credentials (Private Key JWT).

    -   Navigate to **Applications > Applications**.

    -   Click **Create App Integration**.

    -   Select **API Services** as the sign-in method. Click **Next**.

    -   **App integration name:** e.g., "My Vercel App M2M API".

    -   Click **Save**.

    -   On the application's **General** tab, note down the **Client ID**. This corresponds to `OKTA_M2M_CLIENT_ID` in your `.env` file.

    -   **Configure Client Authentication (Private Key JWT):**

        -   Scroll down to the **Client Authentication** section and click **Edit**.

        -   Change the **Client authentication method** to **Private Key JWT**.

        -   Click **Generate new key pair**.

        -   **CRUCIAL STEP: Immediately copy the displayed Private Key.** This is your only chance to save it. Paste it into a file named `privatekey.pem` in a `keys/` directory in your project root (e.g., `your-project/keys/privatekey.pem`). This is the key that will be base64 encoded and used as `OKTA_M2M_PRIVATE_KEY`.

        -   The Public Key will be automatically added to your application.

        -   Click **Done** or **Save** for the Client authentication settings.

    -   **Grant Okta API Scopes:**

        -   Go to the **Okta API Scopes** tab for this new API Services application.

        -   Click **Grant** for the following scopes. These permissions allow your application to perform actions on Okta users and groups:

            -   `okta.users.manage`

            -   `okta.groups.manage`

            -   `okta.users.read`

            -   `okta.groups.read`

### II. Role-Based Access Control (RBAC) with Okta Groups

This application uses Okta groups to manage user roles, specifically the "Admin" role, and also for basic application access.

1.  **Create the 'Admin' Group in Okta:**

    -   Log in to your Okta Admin Dashboard.

    -   Navigate to **Directory > Groups**.

    -   Click **Add Group**.

    -   **Name:**  `Admin` (This name is case-sensitive and used by the application).

    -   **Group description (Optional):** e.g., "Administrators for My Vercel App".

    -   Click **Save Group**.

2.  **Create 'AccessBoardUsers' Group (or your chosen default access group) in Okta:**

    -   Log in to your Okta Admin Dashboard.

    -   Navigate to **Directory > Groups**.

    -   Click **Add Group**.

    -   **Name:**  `AccessBoardUsers` (This name is case-sensitive and used by the application for automated assignments).

    -   **Group description (Optional):** e.g., "Default access group for My Vercel App".

    -   Click **Save Group**.

    -   **Crucially, assign this `AccessBoardUsers` group to your Okta OIDC Web Application** (the one created in step I.2) under **Applications > Applications > Your OIDC Web Application Name > Assignments**. This step ensures that any user assigned to this group gains access to your application.

3.  **Assign Users to the 'Admin' Group:**

    -   Find the "Admin" group in the list and click on its name.

    -   Click **Assign people**.

    -   Select the users who should have administrative privileges and assign them to the group. **Ensure the user you are testing with is a member of this group.**

4.  **Assign Admin Role to the M2M Application:**

    -   This is a critical step to grant your API Services application the actual organizational permissions to manage users and groups in Okta.

    -   Navigate to **Applications > Applications**.

    -   Select your "My Vercel App M2M API" (the API Services app created in step I.3).

    -   Go to the **Admin Roles** tab.

    -   Click **Grant role**.

    -   For **Role**, select **Organization Administrator**. (This role provides comprehensive permissions for all user and group management operations).

    -   For **Resource**, select **All resources**.

    -   Click **Save Changes**.

5.  **Configure Okta Authorization Server Scopes (for default authorization server):** Your application requests several scopes (`openid`, `profile`, `email`, `offline_access`, `groups`) from the *default* authorization server during user login.

    -   In the Okta Admin Dashboard, navigate to **Security > API**.

    -   Under the **Authorization Servers** tab, select your authorization server (typically `default`).

    -   Go to the **Scopes** tab.

    -   Verify or **Add Scope** for:

        -   `openid` (usually default)

        -   `profile` (usually default)

        -   `email` (usually default)

        -   `offline_access`

        -   `groups`

    -   For `offline_access` and `groups`, you might need to explicitly add them. For example, for `groups` scope:

        -   **Name:**  `groups`

        -   **Display name:**  `Groups`

        -   **Description:**  `User group memberships`

        -   Leave **Default scope** unchecked.

        -   Click **Create**.

    -   **Important Note:** You **do not** need to define `okta.users.*` or `okta.groups.*` scopes on your `default` Authorization Server. These are built-in Okta API scopes provided by the Org Authorization Server.

6.  **Configure Okta to Include Group Claims in ID Tokens:** This step ensures that the `groups` claim, containing the user's group memberships, is included in the ID token issued during user login.

    -   In the Okta Admin Dashboard, navigate to **Security > API**.

    -   Under the **Authorization Servers** tab, select your authorization server (typically named `default`).

    -   Go to the **Claims** tab.

    -   Click **Add Claim** (or edit your existing `groups` claim if you already started one).

    -   **Name:**  `groups` (This is the name the application expects).

    -   **Include in token type:** Select `ID Token`.

    -   **Value type:**  `Groups`.

    -   **Filter:** Choose `Matches regex` and enter `.*` in the text field (this includes all groups the user is a member of).

    -   **Include in:** Select `Any scope`.

    -   **Always include in token:** Toggle this to **`ON`**.

    -   Click **Create** (or **Save** if editing).

    The application's backend (`/api/auth.js`) extracts these group names from the `groups` claim in the ID token to determine if a user is an admin. The `/api/okta-user-management.js` also uses these group names (like "Admin" and "AccessBoardUsers") when managing role assignments and automated user provisioning via the UI.

### III. Project Configuration:

1.  **Update `.env` file:** Populate your local `.env` file with all the credentials and identifiers obtained from your Okta setup (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `OKTA_M2M_CLIENT_ID`, `OKTA_M2M_PRIVATE_KEY`, and `AUTH0_AUDIENCE`).

After these changes, restart your local development server (`npx vercel dev`).

Deployment to Vercel
--------------------

1.  **Configure Environment Variables in Vercel:**

    -   Go to your Vercel project settings => Environment Variables.

    -   Add all the environment variables defined in your local `.env` file (e.g., `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `OKTA_M2M_CLIENT_ID`, `OKTA_M2M_PRIVATE_KEY`, `AUTH0_AUDIENCE`) as environment variables in Vercel. Ensure they are set for the appropriate environments (Production, Preview, Development).

    -   For `OKTA_M2M_PRIVATE_KEY`, remember to paste the **base64 encoded single-line string** of your private key.

2.  **Deploy:**

    -   **Via Vercel CLI:**

        ```
        vercel --prod

        ```

    -   **Via Git Integration:** If your GitHub repository is connected to Vercel, pushing to your main branch (or configured production branch) will typically trigger an automatic deployment.

3.  **Post-Deployment Testing:**

    -   Thoroughly test all functionalities on the deployed Vercel URL, ensuring the complete Okta CIC login flow works and admin features are secured. Verify logout functionality.

Key Environment Variables (for `.env` and Vercel)
-------------------------------------------------

-   `AUTH0_DOMAIN`: Your Okta domain (e.g., `dev-123456.okta.com`). This is used by `/api/auth.js` and `/api/okta-user-management.js`, and for frontend configuration via `/api/config`.

-   `AUTH0_CLIENT_ID`: Client ID for your Okta OIDC Web Application. Used by `/api/auth.js` and for frontend configuration.

-   `AUTH0_CLIENT_SECRET`: Client Secret for your Okta OIDC Web Application. **Used only by `api/auth.js` backend.**

-   `AUTH0_AUDIENCE`: The audience for your Okta Authorization Server (e.g., `api://default` or a custom one). **Crucially, ensure this is `api://default` and NOT your Client ID.** Used by `/api/auth.js` and for frontend configuration.

-   `OKTA_M2M_CLIENT_ID`: Client ID for your Okta API Services Application. Used by `/api/okta-user-management.js` for M2M authentication.

-   `OKTA_M2M_PRIVATE_KEY`: The base64 encoded content of the private key associated with your Okta API Services Application. Used by `/api/okta-user-management.js` for `private_key_jwt` authentication.