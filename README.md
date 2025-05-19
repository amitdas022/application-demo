# Application with Okta Integration

This project demonstrates a web application with a Vanilla JavaScript frontend and a Node.js backend (using Vercel Serverless Functions) that integrates with Okta for user authentication and management.

## Project Structure

```
application-demo/
├── backend/
│   ├── api/
│   │   ├── auth.js         # Handles user login authentication via Okta
│   │   └── okta-crud.js    # Handles CRUD operations for users and groups via Okta
│   ├── .env                # Local environment variables (ignored by Git)
│   └── package.json        # Backend dependencies
├── frontend/
│   ├── index.html          # Landing page
│   ├── login.html          # Login page
│   ├── protected.html      # Page for authenticated regular users
│   ├── admin.html          # Admin panel landing page
│   ├── admin-group.html    # Page for managing admin group members
│   ├── admin-user-crud.html # Page for CRUD operations on users
│   ├── style.css           # CSS styles
│   └── app.js              # Frontend JavaScript logic
├── .gitignore              # Specifies intentionally untracked files
└── vercel.json             # Vercel project configuration for local dev and deployment
```

## Local Development Setup

Follow these steps to run the project locally.

### Prerequisites

*   **Node.js and npm:** Download and install from [nodejs.org](https://nodejs.org/).
*   **Vercel CLI:** Install globally: `npm install -g vercel`
*   **Okta Developer Account:** You'll need an Okta developer account and an Okta OIDC application configured.

### 1. Backend Setup

The backend handles Okta API interactions.

1.  **Navigate to Backend Directory:**
    ```bash
    cd backend/
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Create `.env` File:**
    In the `backend/` directory, create a file named `.env`. This file will store your Okta API credentials locally. **Do not commit this file to Git.**
    Add the following content, replacing placeholders with your actual Okta details:
    ```env
    OKTA_ORG_URL=https://your_okta_domain.okta.com
    OKTA_API_TOKEN=your_actual_okta_api_token
    ADMIN_GROUP_ID=your_actual_admin_group_id
    ```
    *   `OKTA_ORG_URL`: Your Okta organization URL.
    *   `OKTA_API_TOKEN`: An Okta API token with permissions to manage users and groups.
    *   `ADMIN_GROUP_ID`: The ID of the Okta group you use for administrators.

### 2. Okta Application Configuration (for Local Development)

Your Okta OIDC application needs to be configured to allow communication from your local setup.

1.  **Sign-in and Sign-out Redirect URIs:**
    *   Go to your Okta Admin Dashboard.
    *   Navigate to **Applications > Applications** and select your application.
    *   Under the **General** tab, edit the "General Settings":
        *   **Sign-in redirect URIs:** Add your local frontend redirect URI. If `vercel dev` runs on port 3000, this will be: `http://localhost:3000/protected.html`
        *   **Sign-out redirect URIs:** Add your local frontend logout URI: `http://localhost:3000/index.html`
    *   Save the changes.

2.  **Trusted Origins (for CORS):**
    *   In your Okta Admin Dashboard, go to **Security > API**.
    *   Select the **Trusted Origins** tab.
    *   Click **Add Origin**.
    *   **Name:** e.g., "Local Development"
    *   **Origin URL:** Your local development URL (e.g., `http://localhost:3000`)
    *   **Type:** Check both "CORS" and "Redirect".
    *   Click **Save**.

### 3. Running the Entire Project Locally with Vercel

1.  **Navigate to Project Root:**
    Ensure you are in the main project directory (`application-demo/`).
    ```bash
    cd .. # If you were in the backend/ directory
    # Or directly: cd /path/to/application-demo/
    ```

2.  **Start the Vercel Development Server:**
    ```bash
    npx vercel dev
    ```
    This command will:
    *   Read the root `vercel.json` file.
    *   Serve your frontend static files from the `frontend/` directory.
    *   Run your backend serverless functions from the `backend/api/` directory.
    *   Typically, the application will be available at `http://localhost:3000`.

    Your frontend `app.js` is configured to make API calls to relative paths like `/api/auth` and `/api/okta-crud`, which `vercel dev` will correctly route to your backend functions.

## Local Testing Without Full Okta Setup (UI Testing)

The `frontend/app.js` file includes a `LOCAL_TESTING_MODE` to bypass client-side authentication checks. This is useful for quickly testing UI elements on protected pages without needing to go through the full Okta login flow every time.

1.  **Start the project locally** as described in "Running the Entire Project Locally with Vercel".
2.  **Open your application** in your web browser (e.g., `http://localhost:3000`).
3.  **Open your browser's developer console** (usually F12).
4.  **Enable Local Testing Mode:** In the console, type and run:
    ```javascript
    window.LOCAL_TESTING_MODE = true;
    ```
5.  **Navigate to Protected Pages:** You should now be able to directly access pages like `/protected.html`, `/admin.html`, etc.

### Simulating User Roles in Local Testing Mode

When `window.LOCAL_TESTING_MODE = true;`, the `app.js` file will attempt to create a default dummy user in `localStorage` if one doesn't exist.

*   **To test as a REGULAR (non-admin) user:**
    1.  Enable local testing mode: `window.LOCAL_TESTING_MODE = true;`
    2.  Ensure no admin user is simulated. If you previously simulated an admin, clear it:
        ```javascript
        localStorage.removeItem('authenticatedUser');
        ```
    3.  Refresh the page or navigate. The default dummy user created by `app.js` does *not* have admin privileges. You should be able to access `protected.html` but get redirected if you try to access admin pages.

*   **To test as an ADMIN user:**
    1.  Enable local testing mode: `window.LOCAL_TESTING_MODE = true;`
    2.  Manually set an admin user in `localStorage` via the console:
        ```javascript
        localStorage.setItem('authenticatedUser', JSON.stringify({
            id: 'test-admin-123',
            profile: {
                firstName: 'Local',
                lastName: 'Admin',
                name: 'Local Admin', // Or use firstName/lastName
                email: 'admin@example.com'
            },
            groups: ['Everyone', 'AdminGroup'] // Ensure 'AdminGroup' matches your config
        }));
        ```
    3.  Refresh the page or navigate. You should now be treated as an admin and be able to access admin pages. If you land on `protected.html`, you should be redirected to `admin.html`.

### Important Notes for Local Testing Mode:

*   **UI Only:** This mode primarily helps test UI and client-side navigation logic.
*   **Backend Calls:** Backend API calls will still be made. The `okta-crud.js` backend uses an `X-User-Id` header (populated from the `authenticatedUser` in `localStorage` by `app.js`) for its simplified authorization. This means your simulated admin/non-admin status in `localStorage` will affect what the backend allows.
*   **Security:** This `LOCAL_TESTING_MODE` and the `X-User-Id` header mechanism are **for development convenience only** and are not secure for production. Real authentication and authorization should rely on validating Okta-issued tokens on the backend.
*   **Disable for Real Testing/Deployment:** Always set `window.LOCAL_TESTING_MODE = false;` (or ensure it's undefined) and remove any manually set `localStorage` items when testing the full Okta authentication flow or deploying.

```