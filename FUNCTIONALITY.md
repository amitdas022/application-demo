# Application Functionality Documentation

## 1. Introduction

*   Briefly describe the application: A web application with user authentication (login), a dashboard for authenticated users, and an admin panel for user and group management.
*   Mention the technology stack highlights: Frontend (HTML, CSS, JavaScript), Backend (Node.js serverless functions for Vercel), Authentication (Auth0).

## 2. Frontend Overview (`frontend/`)

*   **Directory Structure:**
    *   `frontend/`: Contains all client-side code.
    *   `frontend/assets/`: Static assets like images.
    *   `frontend/css/`: Stylesheets.
    *   HTML files at the root of `frontend/`.
*   **Core Client-Side Logic (`frontend/app.js`):**
    *   **Purpose:** Manages all client-side interactivity, UI updates, and communication with backend APIs.
    *   **Key Functions:**
        *   `login()`: Handles form submission, sends credentials to `/api/auth`, stores user data in `localStorage`, redirects.
        *   `logout()`: Clears `localStorage`, redirects to login.
        *   `checkAuthAndRedirect()`: Crucial for page load. Checks `localStorage` for `authenticatedUser`. Populates user profile info (name, email, roles, picture). Controls visibility of elements (e.g., admin links) based on roles. Redirects unauthorized users.
        *   `displayMessage()`: Utility for showing messages (success, error, info) in designated areas.
        *   `showToast()`: Displays temporary toast notifications.
        *   `showConfirmModal()`: Shows a custom confirmation dialog.
        *   Event listeners for forms (login, create user, admin role management), buttons (load users, delete user, edit user), and modal interactions.
        *   Specific logic for admin pages (`admin-group.html`, `admin-user-crud.html`) to interact with `/api/auth0-user-management` for CRUD operations and role assignments.
        *   DOM manipulation to update lists, display data, and manage UI state (e.g., loading spinners, modal visibility).
        *   `moveLandingPageElementIndependently()`: Animation for background scene elements.
    *   **Local Testing Mode:** Explain the `window.LOCAL_TESTING_MODE` flag for bypassing client-side auth checks during UI development.
*   **HTML Pages:**
    *   `index.html`: Public landing page with a welcome message and a link to the login page. Features an animated background scene.
    *   `login.html`: User login page with username (email) and password fields. Displays error messages. Features background logos and a glassy UI form.
    *   `protected.html`: User dashboard, accessible after login. Displays user profile information (name, email, roles, avatar). Shows links to the admin panel if the user has an 'admin' role.
    *   `admin.html`: Admin control panel, accessible only to users with the 'admin' role. Provides navigation to User Management and Group Management.
    *   `admin-user-crud.html`: Admin page for Creating, Reading (listing), Updating, and Deleting users. Includes forms for user creation, a list of users, and a modal for editing user details.
    *   `admin-group.html`: Admin page for managing user roles, specifically assigning/unassigning the 'admin' role to users. Lists users currently in the 'admin' role.
*   **CSS Styling (`frontend/css/`):**
    *   `variables.css`: Defines CSS custom properties for colors, fonts, spacing, border-radius, and glassmorphism parameters (e.g., `--glass-blur`, `--glass-background-alpha`).
    *   `animations.css`: Contains `@keyframes` for various animations used throughout the application (e.g., button ripples, modal transitions, toasts, loading spinners, text effects).
    *   `main.css`: The primary stylesheet.
        *   Includes basic resets, global styles, typography, and utility classes.
        *   Detailed styling for buttons, cards, forms (including input fields with icons), messages, toasts, and modals.
        *   **Glassy UI Approach:** Explain how pages like `index.html`, `login.html`, and now the admin/protected pages achieve a "glassy" effect using `background-color: rgba(...)`, `backdrop-filter: blur(...)`, and semi-transparent borders. The `welcome-scene` div provides animated background elements that are blurred by these glassy surfaces.
        *   Page-specific styles for layout and component appearance.
        *   Responsive design using media queries.

## 3. Backend API (`api/`)

*   **Purpose:** Hosts serverless functions (for Vercel deployment) that handle business logic, particularly authentication and interaction with the Auth0 Management API.
*   **Authentication Endpoint (`api/auth.js`):**
    *   **Functionality:** Authenticates users against Auth0.
    *   **Process (Resource Owner Password Grant - ROPG):**
        1.  Receives `username` (email) and `password` via a POST request.
        2.  Makes a POST request to the Auth0 `/oauth/token` endpoint with grant_type 'password', client credentials, audience, and scope ('openid profile email offline_access').
        3.  If successful, Auth0 returns `access_token`, `id_token`, and `refresh_token`.
    *   **Token Handling:**
        *   `id_token`: Decoded (but not fully verified on the backend, as it's directly from Auth0) to extract user profile information (sub, name, email, picture) and custom claims for roles (e.g., `AUTH0_ROLES_NAMESPACE + 'roles'`).
        *   `access_token`: Used to call secured APIs (though this app primarily uses it as proof of auth).
        *   `refresh_token`: Can be used to get new access tokens (not explicitly implemented in the current client-side flow).
    *   **Response:** Returns tokens, user profile, and roles to the client.
    *   **Environment Variables:**
        *   `AUTH0_DOMAIN`: Your Auth0 tenant domain.
        *   `AUTH0_CLIENT_ID`: Client ID of the Auth0 application (Regular Web App or similar, configured for ROPG).
        *   `AUTH0_CLIENT_SECRET`: Client Secret for the Auth0 application.
        *   `AUTH0_AUDIENCE`: Identifier of the API the tokens are intended for (e.g., Auth0 Management API or a custom API).
        *   `AUTH0_ROLES_NAMESPACE`: Namespace used for custom claims (like roles) in Auth0 Actions/Rules.
*   **User Management Endpoint (`api/auth0-user-management.js`):**
    *   **Functionality:** Provides an interface for managing users in Auth0.
    *   **Auth0 Management API Interaction:**
        *   Uses a Machine-to-Machine (M2M) token to authenticate requests to the Auth0 Management API.
        *   **Token Caching:** Fetches an M2M token using `client_credentials` grant and caches it (with an expiry time) to avoid redundant requests.
    *   **Supported Actions (via query parameters or request body):**
        *   `createUser` (POST): Creates a new user in Auth0 (default connection: 'Username-Password-Authentication'). Requires email, password; can include first/last names.
        *   `listUsers` (GET): Retrieves a list of all users.
        *   `getUser` (GET): Retrieves a specific user by their Auth0 user ID (`sub`).
        *   `listUsersInRole` (GET): Lists users assigned to a specific role (e.g., 'admin'). Involves looking up the Role ID by its name first.
        *   `updateUser` (PUT/PATCH): Updates user attributes (e.g., `given_name`, `family_name`). Uses PATCH method for Auth0.
        *   `assignRoles` (PUT/POST): Assigns specified roles to a user. Requires Role IDs. Example primarily handles 'admin' role by looking up its ID.
        *   `unassignRoles` (PUT/DELETE): Removes specified roles from a user. Requires Role IDs.
        *   `deleteUser` (DELETE): Deletes a user from Auth0 by their user ID.
    *   **Environment Variables:**
        *   `AUTH0_DOMAIN`: Your Auth0 tenant domain.
        *   `AUTH0_M2M_CLIENT_ID`: Client ID of the M2M application authorized for the Auth0 Management API.
        *   `AUTH0_M2M_CLIENT_SECRET`: Client Secret of the M2M application.
        *   `AUTH0_MANAGEMENT_AUDIENCE`: Audience for the Auth0 Management API (usually `https://YOUR_DOMAIN/api/v2/`).

## 4. Authentication Flow (End-to-End)

1.  **Login:**
    *   User enters credentials on `frontend/login.html`.
    *   `app.js` captures the submission, calls its `login()` function.
    *   `login()` function POSTs credentials to `/api/auth`.
    *   `/api/auth` uses ROPG flow with Auth0 to get tokens and user info.
    *   `/api/auth` returns tokens, profile, and roles to `app.js`.
    *   `app.js` stores the received object (containing tokens, profile, roles) as JSON in `localStorage.authenticatedUser`.
    *   User is redirected to `frontend/protected.html`.
2.  **Session Management & Page Access:**
    *   On every page load, `app.js`'s `checkAuthAndRedirect()` function runs.
    *   It checks for `localStorage.authenticatedUser`.
    *   If found:
        *   User is considered authenticated.
        *   UI is updated (profile info, admin links based on roles).
        *   If on `login.html`, redirected to `protected.html`.
        *   If trying to access an admin page without 'admin' role, redirected to `protected.html` with an error toast.
    *   If not found:
        *   User is considered unauthenticated.
        *   If on a protected page (e.g., `protected.html`, admin pages), redirected to `login.html`.
3.  **Logout:**
    *   User clicks the "Logout" button.
    *   `app.js`'s `logout()` function is called.
    *   `localStorage.authenticatedUser` is removed.
    *   User is redirected to `frontend/login.html`.
    *   (Note: True session invalidation on Auth0 side, like token revocation, is not explicitly implemented in this client-driven logout).

## 5. Deployment

*   The application includes a `vercel.json` file, indicating it's configured for deployment on the Vercel platform.
*   The `api/` directory structure is typical for Vercel serverless functions.
*   Environment variables required by the backend API functions need to be configured in the Vercel project settings.
