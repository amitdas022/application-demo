Project API Documentation
=========================

This document outlines the various API endpoints used within the project, detailing their purpose, authentication methods, and providing sample requests and responses.

1\. `/api/config`
-----------------

-   **Purpose:** To provide client-side JavaScript with necessary Okta configuration parameters (e.g., Okta domain, client ID, audience) without exposing sensitive server-side secrets. This endpoint is fetched by the frontend `app.js` during initialization.

-   **Authentication:** None. This is a public endpoint accessible to the frontend.

-   **HTTP Method:**  `GET`

-   **Sample Request:**

    ```
    GET /api/config
    Host: localhost:3000

    ```

-   **Sample Response:**

    ```
    {
      "oktaDomain": "dev-xxxxxxxx.okta.com",
      "oktaClientId": "xxxxxxxxxxxxxxxxx",
      "oktaAudience": "api://default"
    }

    ```

2\. `/api/auth`
---------------

-   **Purpose:** This is the backend endpoint responsible for securely performing the Okta Authorization Code Flow. It exchanges the authorization code received from the frontend (via `callback.html`) for ID, Access, and Refresh tokens from Okta's token endpoint. It also extracts user profile and roles from the ID token.

-   **Authentication:** This endpoint is not authenticated itself, but it *uses* the client credentials (`client_id`, `client_secret`) to authenticate with Okta's token endpoint. The request from the frontend includes the `code` and `redirect_uri`.

-   **HTTP Method:**  `POST`

-   **Sample Request:**

    ```
    POST /api/auth
    Host: localhost:3000
    Content-Type: application/json

    {
      "code": "your_authorization_code_from_okta",
      "redirect_uri": "http://localhost:3000/callback.html"
    }

    ```

-   **Sample Response (Success):**

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

-   **Sample Response (Error):**

    ```
    {
      "error": "Okta token exchange failed.",
      "details": {
        "error": "invalid_grant",
        "error_description": "The authorization code is invalid or has expired."
      }
    }

    ```

3\. `/api/okta-user-management`
-------------------------------

This endpoint handles all administrative operations related to Okta users and groups. It acts as a proxy to the Okta Management API, using a server-side Okta API Token for its calls, and includes server-side authorization based on the *end-user's* access token.

-   **Authentication:**

    -   **To this API (`/api/okta-user-management`):** The frontend sends the logged-in user's `access_token` in the `Authorization: Bearer <token>` header. The backend validates this token against Okta's `/userinfo` endpoint and checks if the user has the `'Admin'` role (from the `groups` claim) before processing the request.

    -   **From this API (to Okta Management API):** This backend uses a long-lived `OKTA_API_TOKEN` (SSWS token) configured in the environment variables to authenticate its requests to Okta's Management API.

### 3.1. Create User

-   **Purpose:** To create a new user account in Okta. The newly created user is automatically assigned to the `AccessBoardUsers` group.

-   **HTTP Method:**  `POST`

-   **Sample Request:**

    ```
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

-   **Sample Response (Success - Status 201 Created):**

    ```
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "email": "new.user@example.com"
    }

    ```

-   **Sample Response (Error - if not authenticated/authorized):**

    ```
    {
      "error": "Forbidden: User does not have administrative privileges."
    }

    ```

### 3.2. List All Users

-   **Purpose:** To retrieve a list of all users from Okta.

-   **HTTP Method:**  `GET`

-   **Query Parameters:**

    -   `action=listUsers`

-   **Sample Request:**

    ```
    GET /api/okta-user-management?action=listUsers
    Host: localhost:3000
    Authorization: Bearer your_admin_access_token

    ```

-   **Sample Response (Success):**

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

### 3.3. Get Single User

-   **Purpose:** To retrieve details for a specific user by their ID.

-   **HTTP Method:**  `GET`

-   **Query Parameters:**

    -   `action=getUser`

    -   `userId=<Okta_User_ID>` (e.g., `00uXXXXXXXXXXXXXXX`)

-   **Sample Request:**

    ```
    GET /api/okta-user-management?action=getUser&userId=00uXXXXXXXXXXXXXXX
    Host: localhost:3000
    Authorization: Bearer your_admin_access_token

    ```

-   **Sample Response (Success):**

    ```
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "given_name": "John",
      "family_name": "Doe",
      "email": "john.doe@example.com"
    }

    ```

### 3.4. Update User Details

-   **Purpose:** To modify a user's profile information (e.g., first name, last name) in Okta.

-   **HTTP Method:**  `PUT`

-   **Sample Request:**

    ```
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

-   **Sample Response (Success - Status 200 OK):**

    ```
    {
      "id": "00uXXXXXXXXXXXXXXX",
      "user_id": "00uXXXXXXXXXXXXXXX",
      "given_name": "Jonathan",
      "family_name": "Davis",
      "email": "john.doe@example.com"
    }

    ```

### 3.5. Assign User to Role (Group)

-   **Purpose:** To assign a specific role (represented by an Okta group) to a user. Currently used for `'Admin'` role.

-   **HTTP Method:**  `PUT`

-   **Sample Request:**

    ```
    PUT /api/okta-user-management
    Host: localhost:3000
    Content-Type: application/json
    Authorization: Bearer your_admin_access_token

    {
      "action": "assignRoles",
      "userId": "00uXXXXXXXXXXXXXXX",
      "roles": ["Admin"]
    }

    ```

-   **Sample Response (Success - Status 204 No Content):**

    ```
    (No content in response body)

    ```

### 3.6. Remove User from Role (Group)

-   **Purpose:** To remove a user from a specific role (represented by an Okta group). Currently used for `'Admin'` role.

-   **HTTP Method:**  `PUT`

-   **Sample Request:**

    ```
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

-   **Sample Response (Success - Status 204 No Content):**

    ```
    (No content in response body)

    ```

### 3.7. List Users in a Specific Role (Group)

-   **Purpose:** To list all users who are members of a specific Okta group (role). Currently used for `'Admin'` role.

-   **HTTP Method:**  `GET`

-   **Query Parameters:**

    -   `action=listUsersInRole`

    -   `roleName=<Role_Name>` (e.g., `'Admin'` or `'AccessBoardUsers'`)

-   **Sample Request:**

    ```
    GET /api/okta-user-management?action=listUsersInRole&roleName=Admin
    Host: localhost:3000
    Authorization: Bearer your_admin_access_token

    ```

-   **Sample Response (Success):**

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

### 3.8. Delete User

-   **Purpose:** To deactivate and then delete a user account in Okta.

-   **HTTP Method:**  `DELETE`

-   **Sample Request:**

    ```
    DELETE /api/okta-user-management
    Host: localhost:3000
    Content-Type: application/json
    Authorization: Bearer your_admin_access_token

    {
      "action": "deleteUser",
      "userId": "00uXXXXXXXXXXXXXXX"
    }

    ```

-   **Sample Response (Success - Status 204 No Content):**

    ```
    (No content in response body)

    ```