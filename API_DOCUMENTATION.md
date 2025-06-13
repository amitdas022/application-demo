# Project API Documentation

This document provides a comprehensive overview of all API endpoints utilized within this application. It details the purpose, authentication mechanisms, and provides illustrative sample requests and responses for both the internal backend APIs exposed by your Vercel serverless functions and the external Okta APIs that your backend interacts with. Understanding these interactions is key to comprehending the application's secure and robust functionality.

## 1. Internal Backend APIs

These are the API endpoints exposed by your Vercel serverless functions, serving as the interface between your frontend and the Okta platform.

### 1.1. `/api/config`

* **Purpose:** To provide client-side JavaScript with necessary Okta configuration parameters (e.g., Okta domain, client ID, audience) without exposing sensitive server-side secrets. This endpoint is fetched by the frontend `app.js` during initialization.

* **Authentication:** None. This is a public endpoint accessible to the frontend.

* **HTTP Method:** `GET`

* **Base URL (Local):** `http://localhost:3000`
* **Base URL (Deployed):** `https://your-app-domain.vercel.app` (replace with your actual Vercel domain)

* **Sample Request:**

    ```http
    GET /api/config
    Host: localhost:3000
    ```

* **Sample Response:**

    ```json
    {
      "oktaDomain": "dev-xxxxxxxx.okta.com",
      "oktaClientId": "xxxxxxxxxxxxxxxxx",
      "oktaAudience": "api://default"
    }
    ```

### 1.2. `/api/auth`

* **Purpose:** This is the core backend endpoint responsible for securely performing the Okta Authorization Code Flow. It receives the authorization `code` from the frontend (after Okta's redirect to `callback.html`) and exchanges it for ID, Access, and Refresh tokens directly with Okta's token endpoint. It also extracts user profile and roles from the ID token. This is the endpoint that completes the user login process from your application's perspective.

* **Authentication:** This endpoint itself is not directly authenticated by a user token from the client. It acts as a secure intermediary and uses your Okta Application's configured `client_id` and `client_secret` to authenticate its server-to-server request with Okta's token endpoint during the code exchange.

* **HTTP Method:** `POST`

* **Base URL (Local):** `http://localhost:3000`
* **Base URL (Deployed):** `https://your-app-domain.vercel.app`

* **Sample Request:**

    ```http
    POST /api/auth
    Host: localhost:3000
    Content-Type: application/json

    {
      "code": "your_authorization_code_from_okta",
      "redirect_uri": "http://localhost:3000/callback.html"
    }
    ```

* **Sample Response (Success):**

    ```json
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
        "picture": "[https://s.gravatar.com/avatar/](https://s.gravatar.com/avatar/)..."
      },
      "roles": ["user", "Admin"]
    }
    ```

* **Sample Response (Error):**

    ```json
    {
      "error": "Okta token exchange failed.",
      "details": {
        "error": "invalid_grant",
        "error_description": "The authorization code is invalid or has expired."
      }
    }
    ```

### 1.3. `/api/okta-user-management`

This endpoint handles all administrative operations related to Okta users and groups. It acts as a proxy to the Okta Management API, using a server-side Okta API Token for its calls, and includes server-side authorization based on the *end-user's* access token.

* **Authentication:**
    * **To this API (`/api/okta-user-management`):** The frontend sends the logged-in end-user's `access_token` in the `Authorization: Bearer <token>` header. The backend validates this token against Okta's `/userinfo` endpoint and checks if the user has the `'Admin'` role (from the `groups` claim) before processing the request. If the user is not authorized, a `401 Unauthorized` or `403 Forbidden` response is returned.
    * **From this API (to Okta Management API):** This backend uses a long-lived `OKTA_API_TOKEN` (SSWS token) configured in the environment variables to authenticate its requests to Okta's Management API.

* **Base URL (Local):** `http://localhost:3000`
* **Base URL (Deployed):** `https://your-app-domain.vercel.app`

---

#### 1.3.1. Create User

* **Purpose:** To create a new user account in Okta. The newly created user is automatically assigned to the `AccessBoardUsers` group, ensuring immediate application access.

* **HTTP Method:** `POST`

* **Sample Request:**

    ```http
    POST /api/okta-user-management
    Host: localhost:3000
    Content-Type: application/json
    Authorization: Bearer your_admin_access_token

    {
      "action": "createUser",
      "userData": {
        "firstName": "New",
        "lastName": "User",
        "email": "new.user@example.com",
        "password": "StrongPassword123!"
      }
    }
    ```

* **Sample Response (Success - Status 201 Created):**

    ```json
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "email": "new.user@example.com"
    }
    ```

* **Sample Response (Error - if not authenticated/authorized):**

    ```json
    {
      "error": "Forbidden: User does not have administrative privileges."
    }
    ```

#### 1.3.2. List All Users

* **Purpose:** To retrieve a list of all users from Okta.

* **HTTP Method:** `GET`

* **Query Parameters:**
    * `action=listUsers`

* **Sample Request:**

    ```http
    GET /api/okta-user-management?action=listUsers
    Host: localhost:3000
    Authorization: Bearer your_admin_access_token
    ```

* **Sample Response (Success):**

    ```json
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

* **Purpose:** To retrieve details for a specific user by their ID.

* **HTTP Method:** `GET`

* **Query Parameters:**
    * `action=getUser`
    * `userId=<Okta_User_ID>` (e.g., `00uXXXXXXXXXXXXXXX`)

* **Sample Request:**

    ```http
    GET /api/okta-user-management?action=getUser&userId=00uXXXXXXXXXXXXXXX
    Host: localhost:3000
    Authorization: Bearer your_admin_access_token
    ```

* **Sample Response (Success):**

    ```json
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "given_name": "John",
      "family_name": "Doe",
      "email": "john.doe@example.com"
    }
    ```

#### 1.3.4. Update User Details

* **Purpose:** To modify a user's profile information (e.g., first name, last name) in Okta.

* **HTTP Method:** `PUT`

* **Sample Request:**

    ```http
    PUT /api/okta-user-management
    Host: localhost:3000
    Content-Type: application/json
    Authorization: Bearer your_admin_access_token

    {
      "action": "updateUser",
      "userId": "00uXXXXXXXXXXXXXXX",
      "updates": {
        "given_name": "Jonathan",
        "family_name": "Davis"
      }
    }
    ```

* **Sample Response (Success - Status 200 OK):**

    ```json
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "given_name": "Jonathan",
      "family_name": "Davis",
      "email": "john.doe@example.com"
    }
    ```

#### 1.3.5. Assign User to Role (Group)

* **Purpose:** To assign a specific role (represented by an Okta group) to a user. Used for assigning the `'Admin'` role and for automatically assigning newly created users to `'AccessBoardUsers'`.

* **HTTP Method:** `PUT`

* **Sample Request:**

    ```http
    PUT /api/okta-user-management
    Host: localhost:3000
    Content-Type: application/json
    Authorization: Bearer your_admin_access_token

    {
      "action": "assignRoles",
      "userId": "00uXXXXXXXXXXXXXXX",
      "roles": ["Admin"] // Or ["AccessBoardUsers"]
    }
    ```

* **Sample Response (Success - Status 204 No Content):**

    ```
    (No content in response body)
    ```

#### 1.3.6. Remove User from Role (Group)

* **Purpose:** To remove a user from a specific role (represented by an Okta group). Currently used for the `'Admin'` role.

* **HTTP Method:** `PUT`

* **Sample Request:**

    ```http
    PUT /api/okta-user-management
    Host: localhost:3000
    Content-Type: application/json
    Authorization: Bearer your_admin_access_token

    {
      "action": "unassignRoles",
      "userId": "00uXXXXXXXXXXXXXXX",
      "roles": ["Admin"]
    }
    ```

* **Sample Response (Success - Status 204 No Content):**

    ```
    (No content in response body)
    ```

#### 1.3.7. List Users in a Specific Role (Group)

* **Purpose:** To list all users who are members of a specific Okta group (role). Used for the `'Admin'` role and can be used for `'AccessBoardUsers'`.

* **HTTP Method:** `GET`

* **Query Parameters:**
    * `action=listUsersInRole`
    * `roleName=<Role_Name>` (e.g., `'Admin'` or `'AccessBoardUsers'`)

* **Sample Request:**

    ```http
    GET /api/okta-user-management?action=listUsersInRole&roleName=Admin
    Host: localhost:3000
    Authorization: Bearer your_admin_access_token
    ```

* **Sample Response (Success):**

    ```json
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

* **Purpose:** To deactivate and then delete a user account in Okta.

* **HTTP Method:** `DELETE`

* **Sample Request:**

    ```http
    DELETE /api/okta-user-management
    Host: localhost:3000
    Content-Type: application/json
    Authorization: Bearer your_admin_access_token

    {
      "action": "deleteUser",
      "userId": "00uXXXXXXXXXXXXXXX"
    }
    ```

* **Sample Response (Success - Status 204 No Content):**

    ```
    (No content in response body)
    ```

## 2. Okta External APIs

These are the direct Okta API endpoints that your backend serverless functions interact with. These interactions are fundamental to the authentication and user management capabilities of your application. The `YOUR_OKTA_DOMAIN` refers to the value from your `AUTH0_DOMAIN` environment variable (e.g., `dev-123456.okta.com`).

### 2.1. Okta Authorization Server - Token Endpoint

* **Endpoint:** `/oauth2/default/v1/token`
* **Purpose:** Used by your `/api/auth.js` backend to exchange the authorization `code` (received from the frontend) for `id_token`, `access_token`, and `refresh_token`. This is a critical step in the Authorization Code Flow, performed server-to-server for security.
* **Used by:** `api/auth.js`
* **Authentication (to Okta):** This API is authenticated using your Okta OIDC Application's `client_id` and `client_secret` (sent in the request body as `application/x-www-form-urlencoded`).
* **Base URL:** `https://YOUR_OKTA_DOMAIN`

* **Sample Request (from `api/auth.js` to Okta):**

    ```http
    POST https://YOUR_OKTA_DOMAIN/oauth2/default/v1/token
    Content-Type: application/x-www-form-urlencoded

    grant_type=authorization_code&
    client_id=YOUR_OKTA_OIDC_APP_CLIENT_ID&
    client_secret=YOUR_OKTA_OIDC_APP_CLIENT_SECRET&
    code=your_authorization_code&
    redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback.html&
    scope=openid%20profile%20email%20offline_access%20groups&
    audience=api%3A%2F%2Fdefault
    ```

* **Sample Response (Success from Okta):**

    ```json
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

* **Endpoint:** `/oauth2/default/v1/userinfo`
* **Purpose:** Used by your `api/okta-user-management.js` backend to validate the end-user's access token (received from the frontend) and retrieve their current claims, including their assigned `groups` (roles). This is central to the server-side authorization check for administrative actions, ensuring that only authenticated and authorized administrators can perform sensitive operations.
* **Used by:** `api/okta-user-management.js` (`authenticateUser` function)
* **Authentication (to Okta):** Authenticated using the end-user's `access_token` in the `Authorization: Bearer <token>` header.
* **Base URL:** `https://YOUR_OKTA_DOMAIN`

* **Sample Request (from `api/okta-user-management.js` to Okta):**

    ```http
    GET https://YOUR_OKTA_DOMAIN/oauth2/default/v1/userinfo
    Host: YOUR_OKTA_DOMAIN
    Authorization: Bearer your_end_user_access_token
    ```

* **Sample Response (Success from Okta):**

    ```json
    {
      "sub": "00uXXXXXXXXXXXXXXX",
      "name": "John Doe",
      "given_name": "John",
      "family_name": "Doe",
      "email": "john.doe@example.com",
      "picture": "[https://s.gravatar.com/avatar/](https://s.gravatar.com/avatar/)...",
      "groups": ["Everyone", "Users", "Admin"]
    }
    ```

### 2.3. Okta Management API - Users Endpoint

* **Endpoint:** `/api/v1/users` (and specific user paths like `/api/v1/users/{userId}`)
* **Purpose:** Used by your `api/okta-user-management.js` to perform CRUD operations (create, list, get, update, deactivate, delete) on individual user accounts directly within your Okta organization.
* **Used by:** `api/okta-user-management.js`
* **Authentication (to Okta):** Authenticated using your `OKTA_API_TOKEN` (SSWS token) in the `Authorization: SSWS <token>` header. This token must have the necessary permissions in your Okta organization.
* **Base URL:** `https://YOUR_OKTA_DOMAIN`

* **Sample Request (from `api/okta-user-management.js` to Okta - Create User):**

    ```http
    POST https://YOUR_OKTA_DOMAIN/api/v1/users?activate=true
    Host: YOUR_OKTA_DOMAIN
    Content-Type: application/json
    Authorization: SSWS YOUR_OKTA_API_TOKEN

    {
      "profile": {
        "firstName": "New",
        "lastName": "User",
        "email": "new.user@example.com",
        "login": "new.user@example.com"
      },
      "credentials": {
        "password": { "value": "StrongPassword123!" }
      }
    }
    ```

* **Sample Response (Success from Okta - Create User):**

    ```json
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

### 2.4. Okta Management API - Groups Endpoint

* **Endpoint:** `/api/v1/groups` (and specific group paths like `/api/v1/groups/{groupId}/users/{userId}`)
* **Purpose:** Used by your `api/okta-user-management.js` to manage user memberships within Okta groups. This is how roles are assigned and unassigned (e.g., adding a user to the 'Admin' group, or adding a new user to the `AccessBoardUsers` group).
* **Used by:** `api/okta-user-management.js` (`getGroupIdByName`, `assignRoles`, `unassignRoles` actions)
* **Authentication (to Okta):** Authenticated using your `OKTA_API_TOKEN` (SSWS token) in the `Authorization: SSWS <token>` header. This token must have the necessary permissions to manage groups and their members.
* **Base URL:** `https://YOUR_OKTA_DOMAIN`

* **Sample Request (from `api/okta-user-management.js` to Okta - Add user to group):**

    ```http
    PUT https://YOUR_OKTA_DOMAIN/api/v1/groups/00gYYYYYYYYYYYYYYY/users/00uXXXXXXXXXXXXXXX
    Host: YOUR_OKTA_DOMAIN
    Authorization: SSWS YOUR_OKTA_API_TOKEN
    Content-Length: 0
    ```
    (Note: For adding/removing a user from a group, often a PUT/DELETE request to the specific user-in-group endpoint does not require a request body, hence `Content-Length: 0` is implied).

* **Sample Response (Success from Okta - Status 204 No Content):**

    ```
    (No content in response body)
    ```

---

## Conclusion

This API documentation provides a detailed reference for all the communication points within and outside the application. By understanding these API calls, their purposes, and their authentication mechanisms, developers can better debug, extend, and maintain the application's functionality. Remember to always replace placeholder values like `YOUR_OKTA_DOMAIN`, `YOUR_OKTA_OIDC_APP_CLIENT_ID`, `YOUR_OKTA_OIDC_APP_CLIENT_SECRET`, and `YOUR_OKTA_API_TOKEN` with your actual Okta configuration details when setting up the environment.