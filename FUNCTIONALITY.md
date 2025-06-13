Application Functionality Documentation
=======================================

This document provides a technical deep dive into the architecture and operational flow of the demonstration application. The application is a web-based platform with user authentication, a dashboard, and administrative panels for user and role management, leveraging Okta Customer Identity Cloud (CIC) as its Identity Provider (IdP) and deployed as serverless functions and static assets on Vercel.

1\. Architectural Overview
--------------------------

The application adheres to a modern, distributed architecture, separating concerns into distinct layers:

-   **Frontend (Client-Side):** A single-page application (SPA) style frontend built with HTML, CSS, and vanilla JavaScript. It handles user interface rendering, user interaction, initial authentication flow redirection, and client-side authorization enforcement for UI elements and navigation.

-   **Backend (Serverless Functions):** Implemented as Node.js serverless functions hosted on Vercel. These functions act as secure intermediaries for critical operations:

    -   Facilitating the OAuth 2.0 Authorization Code Flow (securely exchanging codes for tokens) with Okta CIC.

    -   Interacting with the Okta Management API for administrative user operations (CRUD, group/role assignments).

-   **Okta Customer Identity Cloud (CIC) (Identity Provider - IdP):** Serves as the central authority for user authentication, authorization, and a managed user database. It manages user identities, issues tokens (ID, Access, Refresh), and provides a robust API for user and group management. User roles are typically managed via Okta Groups.

2\. Frontend (`frontend/`)
--------------------------

The frontend is a collection of static assets that provide the user interface and orchestrate interactions with both the user and the backend services.

### 2.1. Structure and Core Technologies

-   **HTML Files:** (`index.html`, `login.html`, `callback.html`, `protected.html`, `admin.html`, `admin-user-crud.html`, `admin-group.html`) define the application's pages and their content structure.

-   **CSS Files:** (`css/main.css`, `css/variables.css`, `css/animations.css`) provide the visual styling, including a modern "glassmorphism" aesthetic, responsive design, and dynamic animations.

-   **JavaScript (`app.js`):** Contains the primary client-side logic, managing authentication flow steps, UI state, user data presentation, and communication with backend APIs.

### 2.2. Key Client-Side Logic (`frontend/app.js`)

`app.js` is the control center for client-side operations:

-   **Authentication Initiation (`login.html` & `app.js`):** User authentication is managed via Okta Customer Identity Cloud (CIC), utilizing the OAuth 2.0 Authorization Code Flow.

    -   When a user clicks the "Login with Okta" button on `login.html`, `app.js` prevents default form submission.

    -   It dynamically constructs an Okta CIC authorization URL (e.g., `https://YOUR_OKTA_DOMAIN/oauth2/default/v1/authorize?...`).

    -   Crucial OAuth 2.0 parameters are included:

        -   `response_type=code`: Requests an authorization code.

        -   `client_id=%%OKTA_CLIENT_ID%%` (fetched from `/api/config`): Identifies the client application.

        -   `redirect_uri=window.location.origin + '/callback.html'`: The exact URI where Okta CIC will redirect the user after authentication.

        -   `scope=openid%20profile%20email%20offline_access%20groups`: Requests basic OIDC claims and the `groups` claim for role information.

        -   `state`: A cryptographically random string generated and stored in `localStorage` for CSRF protection.

        -   `audience=%%OKTA_AUDIENCE%%` (fetched from `/api/config`): Specifies the API audience. This should typically be `api://default` for the Org Authorization Server.

    -   The browser is then redirected to this Okta CIC URL.

-   **Okta CIC Callback Handling (`callback.html` & `app.js`):**

    -   After user authentication, Okta CIC redirects the browser to `callback.html`.

    -   `app.js` extracts the `code` and `state` from the URL.

    -   **State Validation:** The received `state` is validated against the stored one.

    -   **Code Exchange Initiation:** If validation passes, `app.js` makes a `POST` request to your backend endpoint `/api/auth`, sending the `code`.

    -   **Session Establishment:** Upon receiving a successful response from `/api/auth` (containing `idToken`, `accessToken`, `refreshToken`, `profile`, `roles`), `app.js` stores this `authenticatedUser` object in `localStorage`. This client-side `localStorage` entry acts as the primary indicator of the user's logged-in status for the frontend.

    -   The user is then redirected to `protected.html`.

-   **Client-Side Authorization and Routing (`checkAuthAndRedirect()`):**

    -   This function executes on every page load.

    -   It retrieves the `authenticatedUser` object from `localStorage`.

    -   **User Information Display:** It populates user-specific UI elements (e.g., `user-profile-name`, `user-profile-email`, `user-profile-roles`, `user-profile-picture`) on pages like `protected.html`.

    -   **Role-Based UI Control:** It checks the `roles` array (derived from Okta groups included in the ID token) within `authenticatedUser` (specifically for the 'Admin' role). Based on this, it dynamically shows or hides UI components, such as the "Administrator Tools" section. RBAC is implemented by checking these user roles to grant or deny access to specific parts of the application. The logic for assigning/unassigning the 'Admin' role now correctly sends `'Admin'` (capital 'A') to the backend.

    -   **Page Protection (Client-Side):** It implements client-side route protection. If an unauthenticated user attempts to access protected pages, they are redirected to `login.html`. If an authenticated *non-admin* user attempts to access an admin page, they are redirected.

-   **Logout Functionality (`logout()`):**

    -   The `logout()` function clears `authenticatedUser` and `okta_state` from `localStorage`.

    -   It then redirects the user's browser to Okta CIC's logout endpoint (e.g., `https://YOUR_OKTA_DOMAIN/oauth2/default/v1/logout?...`), including `id_token_hint` and `post_logout_redirect_uri`. This terminates the user's session with Okta CIC.

    -   Okta CIC redirects the user back to the application's `login.html` page.

-   **UI Utility Functions:**

    -   `displayMessage()`: Displays stylized messages (success, error, info) within specific DOM elements.

    -   `showToast()`: Creates and displays transient toast notifications for user feedback.

    -   `showConfirmModal()`: Implements a custom modal dialog for user confirmations.

    -   These utilities contribute to a consistent and accessible user experience.

-   **Local Testing Mode:** A `window.LOCAL_TESTING_MODE` flag allows developers to bypass actual Okta CIC authentication for rapid UI development and testing. When enabled, `app.js` can simulate an `authenticatedUser` in `localStorage`. This mode is strictly for development.

3\. Backend (`api/`)
--------------------

The backend consists of Vercel Serverless Functions, implemented in Node.js, responsible for sensitive operations. These backend APIs serve as secure intermediaries, interacting with Okta's external APIs to perform authentication and user management tasks.

### 3.1. Internal Backend API: `/api/auth.js`

This serverless function is the **backend endpoint for completing the login process** after a user authenticates with Okta.

-   **Request Handling:** It listens for `POST` requests from the frontend, containing the `code` parameter (received from Okta's redirect) and the `redirect_uri`.

-   **Interaction with Okta API:**

    -   **Purpose:** To securely exchange the authorization `code` for OAuth 2.0 tokens (Access Token, ID Token, Refresh Token).

    -   **How it communicates:**  `api/auth.js` makes a **server-to-server POST request** to the **Okta Authorization Server - Token Endpoint** (`https://YOUR_OKTA_DOMAIN/oauth2/default/v1/token`).

    -   **Authentication to Okta:** This request is authenticated using your Okta OIDC Application's `client_id` and `client_secret`, which are kept secure on the backend and sent as `application/x-www-form-urlencoded` in the request body.

    -   **When Used:** This interaction happens immediately after the frontend (`callback.html`) receives the authorization code from Okta's initial redirect, preventing the exposure of sensitive client secrets in the browser.

-   **Token Processing:**

    -   Upon a successful response from Okta, `api/auth.js` receives the tokens.

    -   It decodes the `id_token` to extract standard OIDC claims (e.g., `sub`, `email`, `given_name`, `family_name`) and specifically the `groups` claim for role information.

    -   **Role Extraction:** User roles (e.g., `'Admin'`) are extracted from the `groups` claim. Okta is configured to include this claim based on the user's group memberships and the "Always include in token" setting for the `groups` claim in the Authorization Server.

-   **Response to Frontend:** Processed user `profile` information, `roles`, and the received tokens are returned to the frontend.

-   **Logging:** Includes logs for incoming requests, token exchange details, and constructed user information.

### 3.2. Internal Backend API: `/api/okta-user-management.js`

This serverless function provides the administrative interface to interact with Okta CIC's Management API. It enables CRUD operations on users and manages group memberships (roles) in Okta.

-   **Authentication (to this Backend API):**

    -   The frontend sends the logged-in end-user's `access_token` in the `Authorization: Bearer <token>` header to this endpoint.

    -   **Interaction with Okta API for Authorization:**  `api/okta-user-management.js` uses the **Okta Authorization Server - Userinfo Endpoint** (`https://YOUR_OKTA_DOMAIN/oauth2/default/v1/userinfo`) to validate this access token and retrieve the end-user's claims, including their assigned `groups` (roles). This server-side validation is crucial for ensuring that only authenticated users with the `'Admin'` role can perform administrative actions.

-   **Authentication (from Backend to Okta Management API):** If the end-user is authorized (i.e., verified as an 'Admin'), the backend proceeds to call various Okta Management APIs using a long-lived `OKTA_API_TOKEN` (SSWS token), which is securely configured in the environment variables.

-   **Okta Management API Interactions:** The `api/okta-user-management.js` endpoint dispatches requests to the following Okta Management APIs based on the `action` parameter received from the frontend:

    -   **Action: `createUser`**

        -   **Corresponds to Okta API:** Okta Management API - Users Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/users`) via a `POST` request.

        -   **Purpose:** To create a new user account in Okta.

        -   **When Used:** When an administrator submits the "Create New User" form on the `admin-user-crud.html` page.

        -   **Additional Step:** Immediately after successful user creation, the backend *also* makes a `PUT` request to the **Okta Management API - Groups Endpoint** (`https://YOUR_OKTA_DOMAIN/api/v1/groups/{groupId}/users/{userId}`). This automatically assigns the newly created user to the `AccessBoardUsers` Okta group (which grants them immediate access to the application).

    -   **Action: `listUsers`**

        -   **Corresponds to Okta API:** Okta Management API - Users Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/users`) via a `GET` request.

        -   **Purpose:** To retrieve a list of all users within your Okta organization.

        -   **When Used:** When an administrator clicks "Load Users" on the `admin-user-crud.html` page.

    -   **Action: `getUser`**

        -   **Corresponds to Okta API:** Okta Management API - Users Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/users/{userId}`) via a `GET` request.

        -   **Purpose:** To fetch detailed profile information about a specific user by their Okta User ID.

        -   **When Used:** When an administrator attempts to view or populate an edit form for a specific user.

    -   **Action: `updateUser`**

        -   **Corresponds to Okta API:** Okta Management API - Users Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/users/{userId}`) via a `POST` request (Okta's API uses POST for user profile updates).

        -   **Purpose:** To modify a user's profile attributes (e.g., first name, last name) in Okta.

        -   **When Used:** When an administrator saves changes to a user's details through the edit modal on the `admin-user-crud.html` page.

    -   **Actions: `assignRoles` and `unassignRoles`**

        -   **Corresponds to Okta API:** Okta Management API - Groups Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/groups/{groupId}/users/{userId}`) via a `PUT` request (for assignment) or a `DELETE` request (for unassignment).

        -   **Purpose:** To add or remove a user from a specific Okta group, which directly corresponds to assigning or unassigning an application role (e.g., `'Admin'`).

        -   **When Used:** When an administrator clicks "Add to Admin Role" or "Remove from Admin Role" on the `admin-group.html` page. The backend first uses a `GET` request to `/api/v1/groups?q=<groupName>` to resolve the group name to its ID.

    -   **Action: `listUsersInRole`**

        -   **Corresponds to Okta API:** Okta Management API - Groups Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/groups?q=<groupName>`) for finding the group ID, and then (`https://YOUR_OKTA_DOMAIN/api/v1/groups/{groupId}/users`) via a `GET` request to list members of that group.

        -   **Purpose:** To retrieve a list of all users who are members of a specific Okta group (role), such as the `'Admin'` group.

        -   **When Used:** When an administrator clicks "Load Admin Users" on the `admin-group.html` page.

    -   **Action: `deleteUser`**

        -   **Corresponds to Okta API:** Okta Management API - Users Lifecycle Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/users/{userId}/lifecycle/deactivate`) via a `POST` request (to set the user to a DEPROVISIONED state), followed by the Okta Management API - Users Endpoint (`https://YOUR_OKTA_DOMAIN/api/v1/users/{userId}`) via a `DELETE` request (for permanent deletion).

        -   **Purpose:** To deactivate and then permanently delete a user account from Okta.

        -   **When Used:** When an administrator confirms the deletion of a user from the User Management page.

This detailed breakdown clarifies the technical flow and interdependencies within your application, highlighting how different components and Okta CIC services work together to provide authentication, authorization, and user management capabilities.