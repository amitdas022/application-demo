# Application Demo with Auth0 Integration

This project demonstrates a web application built with Vanilla JavaScript for the frontend and a Node.js backend (using Vercel Serverless Functions). It integrates with Auth0 for user authentication and user management functionalities.

## Project Structure

```
application-demo/
├── backend/
│   ├── api/
│   │   ├── auth.js                     # Handles user login authentication via Auth0
│   │   └── auth0-user-management.js    # Handles CRUD for users & roles via Auth0 Management API
│   ├── .env                # Local environment variables (Git ignored)
│   └── package.json        # Backend Node.js dependencies
├── frontend/
│   ├── index.html          # Public landing page
│   ├── login.html          # User login page
│   ├── protected.html      # Page accessible by any authenticated regular user
│   ├── admin.html          # Admin panel landing page
│   ├── admin-group.html    # Page for managing user roles (e.g., assigning admin role)
│   ├── admin-user-crud.html # Page for Create, Read, Update, Delete (CRUD) operations on users
│   ├── style.css           # Main CSS styles
│   └── app.js              # Core frontend JavaScript logic
├── .gitignore              # Specifies intentionally untracked files for Git
└── vercel.json             # Vercel project configuration for local development and deployment
```

## Local Development Setup

Follow these steps to set up and run the project on your local machine.

### Prerequisites

*   **Node.js and npm:** Ensure you have Node.js (which includes npm) installed. Download from [nodejs.org](https://nodejs.org/).
*   **Vercel CLI:** Install globally using npm: `npm install -g vercel`
*   **Auth0 Account:** You will need an active Auth0 account.

### 1. Backend Configuration

1.  **Navigate to Backend Directory:**
    ```bash
    cd backend/
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Create `.env` File:**
    In the `backend/` directory, create a new file named `.env`. This file will store your Auth0 application and API credentials for local development. **This file should not be committed to your Git repository.**

    Populate `.env` with the following, replacing placeholder values with your actual Auth0 details:
    ```env
    AUTH0_DOMAIN=your-auth0-tenant.us.auth0.com
    AUTH0_CLIENT_ID=your_spa_application_client_id
    AUTH0_CLIENT_SECRET=your_spa_application_client_secret_if_confidential
    AUTH0_AUDIENCE=your_api_identifier_for_spa_login_flow # e.g., https://api.yourapp.com
    TEST_USERNAME=testuser@example.com # Optional: for easy testing
    TEST_PASSWORD=yourSecurePassword1! # Optional: for easy testing
    AUTH0_M2M_CLIENT_ID=your_m2m_application_client_id
    AUTH0_M2M_CLIENT_SECRET=your_m2m_application_client_secret
    AUTH0_MANAGEMENT_AUDIENCE=https://your-auth0-tenant.us.auth0.com/api/v2/
    ```
    *   Obtain these values from your Auth0 Dashboard by setting up:
        *   An Auth0 Application (e.g., SPA type) for user login.
        *   An Auth0 API that your application will call.
        *   An Auth0 Machine-to-Machine (M2M) Application authorized to use the Auth0 Management API.

### 2. Auth0 Tenant Configuration

Ensure your Auth0 tenant is configured correctly for this application:

1.  **Application Settings (for your SPA):**
    *   **Allowed Callback URLs:** Add `http://localhost:3000/protected.html` (or the port `vercel dev` uses).
    *   **Allowed Logout URLs:** Add `http://localhost:3000/index.html`.
    *   **Allowed Web Origins:** Add `http://localhost:3000`.
    *   **Grant Types:** Ensure "Password" is enabled if using the ROPG flow from the backend for login (as currently implemented in `api/auth.js`). "Authorization Code" should also be enabled for standard SPA flows.

2.  **Roles and Permissions:**
    *   Define necessary roles (e.g., "admin") in Auth0 under **User Management > Roles**.
    *   Assign these roles to your test users.
    *   Implement a Rule or Action in Auth0 to add user roles to a custom claim (e.g., `https://your-app-namespace/roles`) in the ID token and/or access token. The backend (`api/auth.js`) expects to find roles here to return to the frontend.

3.  **Management API Access (for your M2M Application):**
    *   Verify that your M2M application is authorized for the "Auth0 Management API".
    *   Ensure it has the required scopes/permissions (e.g., `read:users`, `create:users`, `update:users`, `delete:users`, `read:roles`, `update:roles`).

### 3. Running the Project Locally

1.  **Navigate to Project Root:**
    Open your terminal and navigate to the main `application-demo/` directory.
    ```bash
    # Example: cd /path/to/your/application-demo/
    ```

2.  **Start the Vercel Development Server:**
    ```bash
    npx vercel dev
    ```
    This command utilizes the root `vercel.json` to:
    *   Serve static files from the `frontend/` directory.
    *   Run serverless functions from the `backend/api/` directory.
    *   The application will typically be accessible at `http://localhost:3000`.

    The frontend (`app.js`) is configured to make API calls to relative paths (e.g., `/api/auth`, `/api/auth0-user-management`), which `vercel dev` will route to your backend functions.

## Local UI Testing (Bypassing Full Auth0 Login)

For easier UI development of protected pages, `frontend/app.js` includes a `LOCAL_TESTING_MODE`.

1.  **Start the project locally** (as described above).
2.  **Open the application** in your browser (e.g., `http://localhost:3000`).
3.  **Open the browser's developer console** (usually F12).
4.  **Enable Local Testing Mode:** In the console, execute:
    ```javascript
    window.LOCAL_TESTING_MODE = true;
    ```
5.  You can now navigate directly to protected pages (e.g., `/protected.html`, `/admin.html`).

### Simulating User Roles in Local Testing Mode

When `LOCAL_TESTING_MODE` is true, `app.js` creates a default non-admin dummy user in `localStorage`.

*   **To test as a REGULAR (non-admin) user:**
    1.  Set `window.LOCAL_TESTING_MODE = true;`
    2.  Clear any existing simulated user: `localStorage.removeItem('authenticatedUser');`
    3.  Refresh or navigate. You should access `protected.html` but be redirected from admin pages.

*   **To test as an ADMIN user:**
    1.  Set `window.LOCAL_TESTING_MODE = true;`
    2.  Manually create an admin user in `localStorage` via the console:
        ```javascript
        localStorage.setItem('authenticatedUser', JSON.stringify({
            id: 'test-admin-123', // Auth0 user ID (sub)
            profile: {
                firstName: 'Local', lastName: 'Admin', name: 'Local Admin',
                email: 'admin@example.com'
            },
            roles: ['user', 'admin'] // Ensure 'admin' role is present
        }));
        ```
    3.  Refresh or navigate. You should be able to access admin pages.

### Important Notes for Local Testing Mode:

*   **UI Focus:** This mode is primarily for testing UI and client-side navigation.
*   **Backend Interaction:** API calls to `/api/auth0-user-management` will still occur. The backend uses an M2M token for its own authentication to the Auth0 Management API. Authorization of the *frontend user's action* on the backend currently has a `TODO` and would typically involve validating an Auth0 access token sent from the frontend.
*   **Security:** `LOCAL_TESTING_MODE` is **for development convenience only** and is not secure for production.
*   **Disable for Full Testing/Deployment:** Always ensure `window.LOCAL_TESTING_MODE = false;` (or it's undefined) and clear `localStorage` when testing the complete Auth0 authentication flow or before deployment.

## Deployment

This project is structured for easy deployment to Vercel. Ensure your Auth0 environment variables (from `.env`) are configured as Environment Variables in your Vercel project settings.

```