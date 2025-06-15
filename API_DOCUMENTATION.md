Project API Documentation
=========================

This document provides a comprehensive overview of all API endpoints utilized within this application. It details the purpose, authentication mechanisms, and provides illustrative sample requests and responses for both the internal backend APIs exposed by your Vercel serverless functions and the external Okta APIs that your backend interacts with. Understanding these interactions is key to comprehending the application's secure and robust functionality.

1\. Internal Backend APIs
-------------------------

These are the API endpoints exposed by your Vercel serverless functions, serving as the interface between your frontend and the Okta platform.

### 1.1. `/api/config`

-   **Purpose:** To provide client-side JavaScript with necessary Okta configuration parameters (e.g., Okta domain, client ID, audience) without exposing sensitive server-side secrets.

-   **Invocation:** This API is invoked by the frontend's `app.js` script during its initial load, specifically by the `fetchAppConfig()` function.

-   **Authentication:** None. This is a public endpoint accessible to the frontend.

-   **HTTP Method:**  `GET`

-   **Base URL (Local):**  `http://localhost:3000`

-   **Base URL (Deployed):**  `https://your-app-domain.vercel.app` (replace with your actual Vercel domain)

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X GET "http://localhost:3000/api/config"

    ```

-   **External Okta API Invoked:** None. This endpoint serves static configuration derived from environment variables.

### 1.2. `/api/auth`

-   **Purpose:** This is the core backend endpoint responsible for securely performing the Okta Authorization Code Flow. It receives the authorization `code` from the frontend (after Okta's redirect to `callback.html`) and exchanges it for ID, Access, and Refresh tokens directly with Okta's token endpoint. It also extracts user profile and roles from the ID token. This is the endpoint that completes the user login process from your application's perspective.

-   **Invocation:** This API is invoked by the frontend's `app.js` script (specifically the `exchangeCodeWithBackend()` function) after the user has successfully authenticated with Okta and been redirected back to `callback.html` with an authorization code.

-   **Authentication:** This endpoint itself is not directly authenticated by a user token from the client. It acts as a secure intermediary and uses your Okta OIDC Application's configured `client_id` and `client_secret` to authenticate its server-to-server request with Okta's token endpoint during the code exchange.

-   **HTTP Method:**  `POST`

-   **Base URL (Local):**  `http://localhost:3000`

-   **Base URL (Deployed):**  `https://your-app-domain.vercel.app`

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X POST "http://localhost:3000/api/auth"\
         -H "Content-Type: application/json"\
         -d '{
               "code": "your_authorization_code_from_okta",
               "redirect_uri": "http://localhost:3000/callback.html"
             }'

    ```

-   **External Okta API Invoked:** Okta Authorization Server - Token Endpoint (`/oauth2/default/v1/token`).

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    curl -X POST "https://YOUR_OKTA_DOMAIN/oauth2/default/v1/token"\
         -H "Content-Type: application/x-www-form-urlencoded"\
         -d "grant_type=authorization_code&client_id=YOUR_OKTA_OIDC_APP_CLIENT_ID&client_secret=YOUR_OKTA_OIDC_APP_CLIENT_SECRET&code=your_authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback.html&scope=openid%20profile%20email%20offline_access%20groups&audience=api%3A%2F%2Fdefault"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    {
      "accessToken": "ey...",
      "idToken": "ey...",
      "refreshToken": "ey...",
      "profile": {
        "id": "00u...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "picture": "https://s.gravatar.com/avatar/..."
      },
      "roles": ["user", "Admin"]
    }

    ```

-   **Sample Response (Error - Internal Backend API):**

    ```
    {
      "error": "Okta token exchange failed.",
      "details": {
        "error": "invalid_grant",
        "error_description": "The authorization code is invalid or has expired."
      }
    }

    ```

### 1.3. `/api/okta-user-management`

This endpoint handles all administrative operations related to Okta users and groups. It acts as a proxy to the Okta Management API, performing server-side authorization and then making secure M2M calls to Okta.

-   **Invocation (To this API):** This API is invoked by the frontend's `app.js` script (from pages like `admin-user-crud.html` and `admin-group.html`) when an authenticated administrator initiates an action (e.g., loading users, creating a user, editing details). The end-user's `access_token` is sent in the `Authorization: Bearer <token>` header.

-   **Authentication (To this API):** The backend validates the end-user's `access_token` against Okta's `/userinfo` endpoint and checks if the user has the `'Admin'` role. If the user is not authenticated or authorized, a `401 Unauthorized` or `403 Forbidden` response is returned.

-   **Authentication (From this API to Okta Management API):** If the end-user is authorized, this backend obtains a dynamic OAuth 2.0 Access Token using the **Client Credentials Grant (Private Key JWT)** flow with an Okta API Services application. This M2M token is then used in the `Authorization: Bearer <token>` header for requests to the Okta Management API.

-   **Base URL (Local):**  `http://localhost:3000`

-   **Base URL (Deployed):**  `https://your-app-domain.vercel.app`

#### 1.3.1. Create User

-   **Purpose:** To create a new user account in Okta. The newly created user is automatically assigned to the `AccessBoardUsers` group, ensuring immediate application access.

-   **Invocation (From Frontend):** Called when an administrator submits the "Create New User" form on the `admin-user-crud.html` page.

-   **HTTP Method:**  `POST`

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X POST "http://localhost:3000/api/okta-user-management"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer your_admin_access_token"\
         -d '{
               "action": "createUser",
               "userData": {
                 "firstName": "New",
                 "lastName": "User",
                 "email": "new.user@example.com",
                 "password": "StrongPassword123!"
               }
             }'

    ```

-   **External Okta API Invoked:**

    1.  Okta Management API - Users Endpoint (`/api/v1/users`) via a `POST` request (to create the user).

    2.  Okta Management API - Groups Endpoint (`/api/v1/groups/{groupId}/users/{userId}`) via a `PUT` request (to assign the user to the `AccessBoardUsers` group).

-   **Sample cURL Request (Corresponding Okta API - from Backend - Create User):**

    ```
    # To create the user:
    curl -X POST "https://YOUR_OKTA_DOMAIN/api/v1/users?activate=true"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"\
         -d '{
               "profile": {
                 "firstName": "New",
                 "lastName": "User",
                 "email": "new.user@example.com",
                 "login": "new.user@example.com"
               },
               "credentials": {
                 "password": { "value": "StrongPassword123!" }
               }
             }'

    # To assign the user to AccessBoardUsers group (after getting their ID and group ID):
    curl -X PUT "https://YOUR_OKTA_DOMAIN/api/v1/groups/00gYYYYYYYYYYYYYYY/users/00uXXXXXXXXXXXXXXX"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "email": "new.user@example.com"
    }

    ```

#### 1.3.2. List All Users

-   **Purpose:** To retrieve a list of all users from Okta.

-   **Invocation (From Frontend):** Called when an administrator clicks "Load Users" on the `admin-user-crud.html` page.

-   **HTTP Method:**  `GET`

-   **Query Parameters:**

    -   `action=listUsers`

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X GET "http://localhost:3000/api/okta-user-management?action=listUsers"\
         -H "Authorization: Bearer your_admin_access_token"

    ```

-   **External Okta API Invoked:** Okta Management API - Users Endpoint (`/api/v1/users`) via a `GET` request.

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    curl -X GET "https://YOUR_OKTA_DOMAIN/api/v1/users"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    [
      {
        "id": "00uXXXXXXXXXXXXXXX",
        "user_id": "00uXXXXXXXXXXXXXXX",
        "given_name": "John",
        "family_name": "Doe",
        "email": "john.doe@example.com"
      },
      {
        "id": "00uYYYYYYYYYYYYYYY",
        "user_id": "00uYYYYYYYYYYYYYYY",
        "given_name": "Jane",
        "family_name": "Smith",
        "email": "jane.smith@example.com"
      }
    ]

    ```

#### 1.3.3. Get Single User

-   **Purpose:** To retrieve details for a specific user by their ID.

-   **Invocation (From Frontend):** Called when an administrator attempts to view or populate an edit form for a specific user.

-   **HTTP Method:**  `GET`

-   **Query Parameters:**

    -   `action=getUser`

    -   `userId=<Okta_User_ID>` (e.g., `00uXXXXXXXXXXXXXXX`)

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X GET "http://localhost:3000/api/okta-user-management?action=getUser&userId=00uXXXXXXXXXXXXXXX"\
         -H "Authorization: Bearer your_admin_access_token"

    ```

-   **External Okta API Invoked:** Okta Management API - Users Endpoint (`/api/v1/users/{userId}`) via a `GET` request.

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    curl -X GET "https://YOUR_OKTA_DOMAIN/api/v1/users/00uXXXXXXXXXXXXXXX"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "given_name": "John",
      "family_name": "Doe",
      "email": "john.doe@example.com"
    }

    ```

#### 1.3.4. Update User Details

-   **Purpose:** To modify a user's profile information (e.g., first name, last name) in Okta.

-   **Invocation (From Frontend):** Called when an administrator saves changes to a user's details through the edit modal on the `admin-user-crud.html` page.

-   **HTTP Method:**  `PUT`

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X PUT "http://localhost:3000/api/okta-user-management"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer your_admin_access_token"\
         -d '{
               "action": "updateUser",
               "userId": "00uXXXXXXXXXXXXXXX",
               "updates": {
                 "given_name": "Jonathan",
                 "family_name": "Davis"
               }
             }'

    ```

-   **External Okta API Invoked:** Okta Management API - Users Endpoint (`/api/v1/users/{userId}`) via a `POST` request (Okta's API uses `POST` for user profile updates).

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    curl -X POST "https://YOUR_OKTA_DOMAIN/api/v1/users/00uXXXXXXXXXXXXXXX"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"\
         -d '{
               "profile": {
                 "firstName": "Jonathan",
                 "lastName": "Davis"
               }
             }'

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "given_name": "Jonathan",
      "family_name": "Davis",
      "email": "john.doe@example.com"
    }

    ```

#### 1.3.5. Assign User to Role (Group)

-   **Purpose:** To assign a specific role (represented by an Okta group) to a user. Used for assigning the `'Admin'` role and for automatically assigning newly created users to `'AccessBoardUsers'`.

-   **Invocation (From Frontend):** Called when an administrator clicks "Add to Admin Role" or during new user creation (for `AccessBoardUsers`).

-   **HTTP Method:**  `PUT`

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X PUT "http://localhost:3000/api/okta-user-management"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer your_admin_access_token"\
         -d '{
               "action": "assignRoles",
               "userId": "00uXXXXXXXXXXXXXXX",
               "roles": ["Admin"]
             }'

    ```

-   **External Okta API Invoked:** Okta Management API - Groups Endpoint (`/api/v1/groups/{groupId}/users/{userId}`) via a `PUT` request. (The backend first makes a GET request to `/api/v1/groups?q=<groupName>` to resolve the group name to its ID).

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    curl -X PUT "https://YOUR_OKTA_DOMAIN/api/v1/groups/00gYYYYYYYYYYYYYYY/users/00uXXXXXXXXXXXXXXX"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    (No content in response body - Status 204 No Content)

    ```

#### 1.3.6. Remove User from Role (Group)

-   **Purpose:** To remove a user from a specific role (represented by an Okta group). Currently used for the `'Admin'` role.

-   **Invocation (From Frontend):** Called when an administrator clicks "Remove from Admin Role".

-   **HTTP Method:**  `PUT`

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X PUT "http://localhost:3000/api/okta-user-management"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer your_admin_access_token"\
         -d '{
               "action": "unassignRoles",
               "userId": "00uXXXXXXXXXXXXXXX",
               "roles": ["Admin"]
             }'

    ```

-   **External Okta API Invoked:** Okta Management API - Groups Endpoint (`/api/v1/groups/{groupId}/users/{userId}`) via a `DELETE` request. (The backend first makes a GET request to `/api/v1/groups?q=<groupName>` to resolve the group name to its ID).

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    curl -X DELETE "https://YOUR_OKTA_DOMAIN/api/v1/groups/00gYYYYYYYYYYYYYYY/users/00uXXXXXXXXXXXXXXX"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    (No content in response body - Status 204 No Content)

    ```

#### 1.3.7. List Users in a Specific Role (Group)

-   **Purpose:** To list all users who are members of a specific Okta group (role). Used for the `'Admin'` role and can be used for `'AccessBoardUsers'`.

-   **Invocation (From Frontend):** Called when an administrator clicks "Load Admin Users".

-   **HTTP Method:**  `GET`

-   **Query Parameters:**

    -   `action=listUsersInRole`

    -   `roleName=<Role_Name>` (e.g., `'Admin'` or `'AccessBoardUsers'`)

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X GET "http://localhost:3000/api/okta-user-management?action=listUsersInRole&roleName=Admin"\
         -H "Authorization: Bearer your_admin_access_token"

    ```

-   **External Okta API Invoked:** Okta Management API - Groups Endpoint (`/api/v1/groups?q=<groupName>`) for finding the group ID, and then (`/api/v1/groups/{groupId}/users`) via a `GET` request to list members of that group.

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    # To find the group ID (first call):
    curl -X GET "https://YOUR_OKTA_DOMAIN/api/v1/groups?q=Admin"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    # Then, to list users in that group:
    curl -X GET "https://YOUR_OKTA_DOMAIN/api/v1/groups/00gYYYYYYYYYYYYYYY/users"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    [
      {
        "id": "00uXXXXXXXXXXXXXXX",
        "user_id": "00uXXXXXXXXXXXXXXX",
        "name": "John Doe",
        "email": "john.doe@example.com"
      }
    ]

    ```

#### 1.3.8. Delete User

-   **Purpose:** To deactivate and then delete a user account in Okta.

-   **Invocation (From Frontend):** Called when an administrator confirms the deletion of a user from the User Management page.

-   **HTTP Method:**  `DELETE`

-   **Sample cURL Request (Internal Backend API):**

    ```
    curl -X DELETE "http://localhost:3000/api/okta-user-management"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer your_admin_access_token"\
         -d '{
               "action": "deleteUser",
               "userId": "00uXXXXXXXXXXXXXXX"
             }'

    ```

-   **External Okta API Invoked:**

    1.  Okta Management API - Users Lifecycle Endpoint (`/api/v1/users/{userId}/lifecycle/deactivate`) via a `POST` request (to set the user to a DEPROVISIONED state).

    2.  Okta Management API - Users Endpoint (`/api/v1/users/{userId}`) via a `DELETE` request (for permanent deletion).

-   **Sample cURL Request (Corresponding Okta API - from Backend):**

    ```
    # To deactivate (optional, but good practice before delete):
    curl -X POST "https://YOUR_OKTA_DOMAIN/api/v1/users/00uXXXXXXXXXXXXXXX/lifecycle/deactivate"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    # To delete:
    curl -X DELETE "https://YOUR_OKTA_DOMAIN/api/v1/users/00uXXXXXXXXXXXXXXX"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

-   **Sample Response (Success - Internal Backend API):**

    ```
    (No content in response body - Status 204 No Content)

    ```

2\. Okta External APIs
----------------------

These are the direct Okta API endpoints that your backend serverless functions interact with. These interactions are fundamental to the authentication and user management capabilities of your application. The `YOUR_OKTA_DOMAIN` refers to the value from your `AUTH0_DOMAIN` environment variable (e.g., `dev-123456.okta.com`).

### 2.1. Okta Authorization Server - Token Endpoint (for User Login)

-   **Endpoint:**  `/oauth2/default/v1/token`

-   **Purpose:** Used by your `/api/auth.js` backend to exchange the authorization `code` (received from the frontend) for `id_token`, `access_token`, and `refresh_token`. This is a critical step in the Authorization Code Flow, performed server-to-server for security.

-   **Used by:**  `api/auth.js`

-   **Authentication (to Okta):** This API is authenticated using your Okta OIDC Application's `client_id` and `client_secret` (sent in the request body as `application/x-www-form-urlencoded`).

-   **Base URL:**  `https://YOUR_OKTA_DOMAIN`

-   **Sample cURL Request (Direct to Okta API):**

    ```
    curl -X POST "https://YOUR_OKTA_DOMAIN/oauth2/default/v1/token"\
         -H "Content-Type: application/x-www-form-urlencoded"\
         -d "grant_type=authorization_code&client_id=YOUR_OKTA_OIDC_APP_CLIENT_ID&client_secret=YOUR_OKTA_OIDC_APP_CLIENT_SECRET&code=your_authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback.html&scope=openid%20profile%20email%20offline_access%20groups&audience=api%3A%2F%2Fdefault"

    ```

-   **Sample Response (Success from Okta):**

    ```
    {
      "access_token": "ey...",
      "expires_in": 3600,
      "token_type": "Bearer",
      "scope": "openid profile email offline_access groups",
      "id_token": "ey...",
      "refresh_token": "ey..."
    }

    ```

### 2.2. Okta Authorization Server - Userinfo Endpoint

-   **Endpoint:**  `/oauth2/default/v1/userinfo`

-   **Purpose:** Used by your `api/okta-user-management.js` backend to validate the end-user's access token (received from the frontend) and retrieve their current claims, including their assigned `groups` (roles). This is central to the server-side authorization check for administrative actions, ensuring that only authenticated and authorized administrators can perform sensitive operations.

-   **Used by:**  `api/okta-user-management.js` (`authenticateUser` function)

-   **Authentication (to Okta):** Authenticated using the end-user's `access_token` in the `Authorization: Bearer <token>` header.

-   **Base URL:**  `https://YOUR_OKTA_DOMAIN`

-   **Sample cURL Request (Direct to Okta API):**

    ```
    curl -X GET "https://YOUR_OKTA_DOMAIN/oauth2/default/v1/userinfo"\
         -H "Authorization: Bearer your_end_user_access_token"

    ```

-   **Sample Response (Success from Okta):**

    ```
    {
      "sub": "00uXXXXXXXXXXXXXXX",
      "name": "John Doe",
      "given_name": "John",
      "family_name": "Doe",
      "email": "john.doe@example.com",
      "picture": "https://s.gravatar.com/avatar/...",
      "groups": ["Everyone", "Users", "Admin"]
    }

    ```

### 2.3. Okta Org Authorization Server - Token Endpoint (for M2M API Access)

-   **Endpoint:**  `/oauth2/v1/token`

-   **Purpose:** Used by your `api/okta-user-management.js` backend to obtain a secure M2M Access Token (with `okta.*` scopes) via the Client Credentials Grant. This endpoint is specifically for the Okta Org Authorization Server, which issues tokens for accessing Okta's own Management API.

-   **Used by:**  `api/okta-user-management.js` (`getM2MAccessToken` function)

-   **Authentication (to Okta):** Authenticated using the **Private Key JWT** method. This involves sending your M2M application's `client_id`, `client_assertion_type` (fixed value `urn:ietf:params:oauth:client-assertion-type:jwt-bearer`), and a `client_assertion` (a JWT signed with your application's private key) in the request body.

-   **Base URL:**  `https://YOUR_OKTA_DOMAIN`

-   **Sample cURL Request (Direct to Okta API):**

    ```
    curl -X POST "https://YOUR_OKTA_DOMAIN/oauth2/v1/token"\
         -H "Content-Type: application/x-www-form-urlencoded"\
         -d "grant_type=client_credentials&client_id=YOUR_OKTA_M2M_APP_CLIENT_ID&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&client_assertion=YOUR_SIGNED_CLIENT_ASSERTION_JWT&scope=okta.users.manage%20okta.groups.manage%20okta.users.read%20okta.groups.read"

    ```

-   **Sample Response (Success from Okta):**

    ```
    {
      "access_token": "ey...",
      "expires_in": 3600,
      "token_type": "Bearer",
      "scope": "okta.users.manage okta.groups.manage okta.users.read okta.groups.read"
    }

    ```

### 2.4. Okta Management API - Users Endpoint

-   **Endpoint:**  `/api/v1/users` (and specific user paths like `/api/v1/users/{userId}`)

-   **Purpose:** Used by your `api/okta-user-management.js` to perform CRUD operations (create, list, get, update, deactivate, delete) on individual user accounts directly within your Okta organization.

-   **Used by:**  `api/okta-user-management.js`

-   **Authentication (to Okta):** Authenticated using the M2M Access Token (obtained via Private Key JWT) in the `Authorization: Bearer <token>` header. This token must contain the necessary `okta.users.*` scopes.

-   **Base URL:**  `https://YOUR_OKTA_DOMAIN`

-   **Sample cURL Request (Direct to Okta API - Create User):**

    ```
    curl -X POST "https://YOUR_OKTA_DOMAIN/api/v1/users?activate=true"\
         -H "Content-Type: application/json"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"\
         -d '{
               "profile": {
                 "firstName": "New",
                 "lastName": "User",
                 "email": "new.user@example.com",
                 "login": "new.user@example.com"
               },
               "credentials": {
                 "password": { "value": "StrongPassword123!" }
               }
             }'

    ```

-   **Sample Response (Success from Okta - Create User):**

    ```
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "status": "ACTIVE",
      "profile": {
        "firstName": "New",
        "lastName": "User",
        "email": "new.user@example.com",
        "login": "new.user@example.com"
      },
      "_links": { ... }
    }

    ```

### 2.5. Okta Management API - Groups Endpoint

-   **Endpoint:**  `/api/v1/groups` (and specific group paths like `/api/v1/groups/{groupId}/users/{userId}`)

-   **Purpose:** Used by your `api/okta-user-management.js` to manage user memberships within Okta groups. This is how roles are assigned and unassigned (e.g., adding a user to the 'Admin' group, or adding a new user to the `AccessBoardUsers` group).

-   **Used by:**  `api/okta-user-management.js` (`getGroupIdByName`, `assignRoles`, `unassignRoles` actions)

-   **Authentication (to Okta):** Authenticated using the M2M Access Token (obtained via Private Key JWT) in the `Authorization: Bearer <token>` header. This token must contain the necessary `okta.groups.*` scopes.

-   **Base URL:**  `https://YOUR_OKTA_DOMAIN`

-   **Sample cURL Request (Direct to Okta API - Add user to group):**

    ```
    curl -X PUT "https://YOUR_OKTA_DOMAIN/api/v1/groups/00gYYYYYYYYYYYYYYY/users/00uXXXXXXXXXXXXXXX"\
         -H "Authorization: Bearer YOUR_M2M_ACCESS_TOKEN"

    ```

    (Note: For adding/removing a user from a group, often a PUT/DELETE request to the specific user-in-group endpoint does not require a request body, hence `Content-Length: 0` is implied).

-   **Sample Response (Success from Okta - Status 204 No Content):**

    ```
    (No content in response body)

    ```

Conclusion
----------

This API documentation provides a detailed reference for all the communication points within and outside the application. By understanding these API calls, their purposes, and their authentication mechanisms, developers can better debug, extend, and maintain the application's functionality. Remember to always replace placeholder values like `YOUR_OKTA_DOMAIN`, `YOUR_OKTA_OIDC_APP_CLIENT_ID`, `YOUR_OKTA_OIDC_APP_CLIENT_SECRET`, `YOUR_OKTA_M2M_APP_CLIENT_ID`, `YOUR_SIGNED_CLIENT_ASSERTION_JWT`, and `YOUR_M2M_ACCESS_TOKEN` with your actual Okta configuration details when setting up the environment.