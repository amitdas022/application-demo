// frontend/app.js
// This file manages client-side interactivity, user authentication state (via localStorage),
// communication with backend APIs (/api/auth for login, /api/auth0-user-management for user admin tasks),
// and dynamic HTML updates based on application state and user actions.

// LOCAL_TESTING_MODE:
// Set this global variable to true in your browser's developer console
// (e.g., window.LOCAL_TESTING_MODE = true;) to bypass client-side authentication checks
// and simulate a user. This is useful for UI development without needing to repeatedly log in.
// IMPORTANT: Ensure this is false or removed for production or real authentication testing.
// No Okta Auth JS initialization is used; authentication is handled via backend and localStorage.

/**
 * Handles user login by sending credentials to the backend /api/auth endpoint.
 * @async
 * @param {string} username - The user's username (expected to be an email).
 * @param {string} password - The user's password.
 * @param {HTMLElement} errorMessageElement - The HTML element where error messages should be displayed.
 */
async function login(username, password, errorMessageElement) {
  try {
    // Fetch call to the backend authentication endpoint.
    const response = await fetch('/api/auth', {
      method: 'POST', // HTTP method for sending data.
      headers: { 'Content-Type': 'application/json' }, // Indicates the body format is JSON.
      // Body contains the username and password. The backend /api/auth.js expects 'username'.
      body: JSON.stringify({ username, password })
    });

    // Handle successful login response.
    if (response.ok) {
      const user = await response.json(); // Parse the JSON response containing user data.
      // Store user information (including tokens, profile, roles) in localStorage.
      localStorage.setItem('authenticatedUser', JSON.stringify(user));
      // Log received user data for debugging, especially to verify roles.
      console.log('User data received from backend and stored:', user);

      // Clear any previous error messages from the UI.
      if (errorMessageElement) {
        errorMessageElement.textContent = '';
        errorMessageElement.className = 'error-message'; // Reset class to default.
      }
      // Redirect to the protected page after successful login.
      window.location.href = 'protected.html';
    } else {
      // Handle login failure (e.g., invalid credentials).
      // Attempt to parse error JSON from the backend, or use a default error message.
      const error = await response.json().catch(() => ({ error: 'Unknown error from server.' }));
      displayMessage(errorMessageElement, `Login failed: ${error.error || 'Invalid credentials.'}`, 'error', 'error-message');
    }
  } catch (error) {
    // Handle network errors or other issues during the login process.
    console.error('Login error:', error);
    const message = 'Invalid credentials or error during login.';
    displayMessage(errorMessageElement, message, 'error', 'error-message');
  }
}

/**
 * Logs the user out by clearing their session information from localStorage and redirecting to the login page.
 * @async
 */
async function logout() {
  // Clear the authenticatedUser item from localStorage, effectively ending the client-side session.
  localStorage.removeItem('authenticatedUser');
  // Note: In a real application with server-side sessions or token revocation,
  // you would also call a backend logout endpoint here (e.g., await fetch('/api/logout', { method: 'POST' });).
  // Redirect the user to the login page after logout.
  window.location.href = 'login.html';
}


/**
 * Checks the user's authentication state (from localStorage) and roles.
 * Manages page access by redirecting users based on their auth status and roles.
 * Updates UI elements (e.g., user profile display, admin links visibility).
 * This function is crucial for client-side route protection and UI personalization,
 * and it's typically called on every page load.
 */
function checkAuthAndRedirect() {
  // --- Start Local Testing Bypass (Frontend Only) ---
  // This block allows developers to bypass actual authentication for UI testing.
  if (window.LOCAL_TESTING_MODE) {
    console.warn("LOCAL_TESTING_MODE is active. Bypassing client-side authentication checks.");
    // If no 'authenticatedUser' is found in localStorage (meaning no real login or manual setup),
    // and the current page is not a public page (login, index),
    // then simulate a default user to allow access to protected UI elements.
    if (!localStorage.getItem('authenticatedUser') &&
      !window.location.pathname.endsWith('/login.html') && // Don't simulate on login page
      !window.location.pathname.endsWith('/index.html') && // Don't simulate on public index
      !window.location.pathname.endsWith('/')              // Don't simulate on root if it's public
    ) {
      // Create a default dummy user object. For testing non-admin views, ensure this user
      // does NOT have the 'admin' role. To test admin views, manually set an admin user
      // in localStorage via the browser console (see README for example).
      const dummyUser = {
        id: 'local-test-user-sub', // Simulated Auth0 user ID (sub)
        profile: { firstName: 'Local', lastName: 'Tester', name: 'Local Tester', email: 'test@example.com', picture: 'path/to/default-avatar.png' },
        roles: ['user'] // Simulate a basic user role; add 'admin' to test admin features.
      };
      localStorage.setItem('authenticatedUser', JSON.stringify(dummyUser)); // Store the dummy user.
      console.log('LOCAL_TESTING_MODE: Simulated user set in localStorage:', dummyUser);
    }
  }
  // --- End Local Testing Bypass ---

  // Retrieve the authenticated user object from localStorage.
  // This object (if present) contains profile, tokens, and roles.
  const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));
  const currentPage = window.location.pathname; // Get the current page's path.

  // Select DOM elements used for displaying user information and controlling UI visibility.
  const userProfileNameEl = document.getElementById('user-profile-name');       // Displays user's name.
  const userProfileEmailEl = document.getElementById('user-profile-email');     // Displays user's email.
  const userProfileRolesEl = document.getElementById('user-profile-roles');     // Displays user's roles.
  const adminLinksContainerEl = document.getElementById('admin-links-container'); // Container for admin-specific links.
  const logoutButton = document.getElementById('logout-button');                // The logout button.

  // Control visibility of the logout button based on authentication state.
  if (logoutButton) {
    logoutButton.style.display = authenticatedUser ? 'block' : 'none'; // Show if user is authenticated, hide otherwise.
  }

  // Handle behavior if a user is authenticated (i.e., authenticatedUser object exists).
  if (authenticatedUser) {
    // User is considered "authenticated" (either via a real login or LOCAL_TESTING_MODE simulation).

    // Populate user profile information on pages like protected.html.
    if (userProfileNameEl && authenticatedUser.profile) {
      userProfileNameEl.textContent = authenticatedUser.profile.name || authenticatedUser.profile.firstName || authenticatedUser.profile.email || 'User';
    }
    if (userProfileEmailEl && authenticatedUser.profile) {
      userProfileEmailEl.textContent = authenticatedUser.profile.email || 'N/A';
    }
    // Display user roles, joined by a comma, or a default message if no roles.
    if (userProfileRolesEl) {
      userProfileRolesEl.textContent = authenticatedUser.roles?.join(', ') || 'No roles assigned';
      // For debugging, log the roles to the console.
      // console.log('Current user roles from localStorage:', authenticatedUser.roles);
    }

    // Determine if the authenticated user has an 'admin' role.
    // This checks if the 'roles' array exists and includes the string 'admin' (case-insensitive).
    const isAdmin = authenticatedUser.roles && authenticatedUser.roles.some(role => typeof role === 'string' && role.toLowerCase() === 'admin');

    // Show or hide the admin links container based on whether the user is an admin.
    if (adminLinksContainerEl) {
      adminLinksContainerEl.style.display = isAdmin ? 'block' : 'none';
    }

    // Redirection logic for logged-in users.
    if (isAdmin) {
      // Admin users can access any page.
      // If an admin is somehow on the login page, redirect them to the protected page.
      if (currentPage.endsWith('login.html')) {
        window.location.href = 'protected.html';
      }
    } else {
      // Non-admin users.
      // If a non-admin user tries to access an admin-only page, show an alert and redirect them.
      const isAdminPage = currentPage.endsWith('admin.html') || currentPage.endsWith('admin-group.html') || currentPage.endsWith('admin-user-crud.html');
      if (isAdminPage) {
        alert('Access Denied: You do not have permission to view this page.');
        window.location.href = 'protected.html'; // Redirect to a general protected page.
      }
      // If a non-admin (but logged-in) user is on the login page, redirect them to the protected page.
      if (currentPage.endsWith('login.html')) {
        window.location.href = 'protected.html';
      }
    }
  } else {
    // User is not authenticated (no authenticatedUser object in localStorage).
    // If an unauthenticated user tries to access a protected page or any admin page, redirect them to the login page.
    const isProtectedPage = currentPage.endsWith('protected.html');
    const isAdminAreaPage = currentPage.includes('admin'); // Covers admin.html, admin-group.html, etc.
    if (isProtectedPage || isAdminAreaPage) {
      window.location.href = 'login.html';
    }
  }
}

/**
 * Displays a message in a designated HTML element with appropriate styling and optional auto-hide.
 * Uses CSS classes for styling (e.g., 'success', 'error', 'info') and for triggering show/hide animations.
 * @param {HTMLElement} element - The HTML element where the message will be displayed.
 * @param {string} text - The message text to display.
 * @param {'success' | 'error' | 'info'} [type='info'] - The type of message, influencing its styling.
 * @param {string} [baseClass='message-area'] - The base CSS class for the message element.
 * @param {number} [autoHideDelay=0] - Delay in milliseconds to auto-hide the message. If 0, message remains visible.
 */
function displayMessage(element, text, type = 'info', baseClass = 'message-area', autoHideDelay = 0) {
  if (element) {
    // Set the message text.
    element.textContent = text;
    // Apply CSS classes: the base class, the message type class, and 'show' to trigger visibility/animation.
    element.className = `${baseClass} ${type} show`;

    // If an autoHideDelay is specified, set a timeout to remove the 'show' class,
    // which can trigger a CSS transition to hide the message.
    if (autoHideDelay > 0) {
      setTimeout(() => {
        element.classList.remove('show');
        // Optional: Fully reset the element's content and class after the hide animation.
        // This might be useful if the element is reused for many messages.
        // setTimeout(() => {
        //   element.textContent = '';
        //   element.className = baseClass;
        // }, 300); // Duration should match the CSS transition-duration for hiding.
      }, autoHideDelay);
    }
  }
}

// Main event listener that runs when the DOM is fully loaded.
// Sets up page-specific event listeners and performs initial checks like authentication.
document.addEventListener('DOMContentLoaded', () => {
  // Code for welcome page title animation (if the element exists).
  // This applies a staggered animation to letters within the '.welcome-title' element.
  if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html')) {
    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) {
      const letters = welcomeTitle.querySelectorAll('span');
      letters.forEach((span, index) => {
        // CSS variable '--letter-index' is likely used by a CSS animation to create a delay or offset.
        span.style.setProperty('--letter-index', index);
      });
    }
  }

  // Setup for the login page.
  if (window.location.pathname.endsWith('login.html')) {
    const loginForm = document.getElementById('login-form'); // Get the login form element.
    if (loginForm) {
      // Add a submit event listener to the login form.
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the default form submission (which would cause a page reload).

        // Get username and password input values.
        const usernameInput = loginForm.querySelector('input[name="username"]');
        const passwordInput = loginForm.querySelector('input[name="password"]');
        const errorMessageElement = document.getElementById('error-message'); // Element for displaying login errors.
        const submitButton = loginForm.querySelector('button[type="submit"]'); // Login button for loading state.

        // Toggle loading state on the submit button.
        if (submitButton) submitButton.classList.add('loading');
        try {
          // Call the login function with credentials and the error message element.
          await login(usernameInput.value, passwordInput.value, errorMessageElement);
        } finally {
          // Remove loading state from the submit button after login attempt.
          if (submitButton) submitButton.classList.remove('loading');
        }
      });
    }
    // Note: If a user is already authenticated and lands on login.html,
    // checkAuthAndRedirect() will handle redirecting them away.
  }

  // Add event listener for the global logout button if it exists.
  const globalLogoutButton = document.getElementById('logout-button');
  if (globalLogoutButton) {
    globalLogoutButton.addEventListener('click', logout);
  }

  // Setup for the Admin Group Management page (admin-group.html).
  // This page is now effectively "User Role Management" for the 'admin' role.
  if (window.location.pathname.endsWith('admin-group.html')) {
    // Select DOM elements for role management.
    const addToAdminRoleButton = document.getElementById('add-to-admin-role-button');
    const removeFromAdminRoleButton = document.getElementById('remove-from-admin-role-button');
    const userIdInput = document.getElementById('admin-role-userId'); // Input for Auth0 User ID (sub).
    const messageDiv = document.getElementById('admin-role-message'); // For displaying success/error messages.
    const loadAdminUsersButton = document.getElementById('load-admin-users-button');
    const adminUsersList = document.getElementById('admin-users-list'); // UL element to list admin users.
    const loadAdminUsersMessage = document.getElementById('load-admin-users-message'); // Message area for loading admins.

    /**
     * Manages assigning or unassigning the 'admin' role to a user via a backend API call.
     * @async
     * @param {'assignRoles' | 'unassignRoles'} action - The action to perform.
     * @param {HTMLButtonElement} buttonElement - The button that triggered the action, for loading state.
     */
    async function manageAdminRole(action, buttonElement) {
      const userIdToManage = userIdInput.value; // Get the User ID (Auth0 sub) from the input field.
      // Validate that a User ID has been entered.
      if (userIdToManage) {
        try {
          // Toggle loading state on the button.
          if (buttonElement) buttonElement.classList.add('loading');
          // Call the backend API to assign or unassign the 'admin' role.
          const response = await fetch('/api/auth0-user-management', {
            method: 'PUT', // Backend expects PUT for role modifications.
            headers: {
              'Content-Type': 'application/json',
              // No specific user authorization header needed here if the backend uses an M2M token
              // for calls to the Auth0 Management API.
            },
            // The backend API expects an 'action', 'userId', and 'roles' array.
            // This example specifically targets the 'admin' role.
            body: JSON.stringify({ action: action, userId: userIdToManage, roles: ['admin'] })
          });

          // Handle the response from the backend.
          if (response.ok) { // HTTP 204 (No Content) is typical for successful role assignment.
            const successMessage = action === 'assignRoles' ? 'User added to admin role successfully.' : 'User removed from admin role successfully.';
            displayMessage(messageDiv, successMessage, 'success', 'message-area', 3000);
          } else {
            // Parse error response from the backend.
            const errorData = await response.json().catch(() => ({ error: 'Unknown server error.' }));
            displayMessage(messageDiv, `Failed to update roles: ${errorData.error || 'Server error'}`, 'error');
          }
        } catch (error) {
          // Handle network errors or other issues.
          console.error("Error updating roles:", error);
          displayMessage(messageDiv, 'Client-side error: ' + error.message, 'error');
        } finally {
          // Remove loading state from the button.
          if (buttonElement) buttonElement.classList.remove('loading');
        }
      } else {
        // If no User ID was entered, display an error message.
        displayMessage(messageDiv, 'Please enter a User ID (Auth0 `sub`).', 'error');
      }
    }

    // Add event listeners to the "Add to Admin Role" and "Remove from Admin Role" buttons.
    if (addToAdminRoleButton) {
      addToAdminRoleButton.addEventListener('click', () => manageAdminRole('assignRoles', addToAdminRoleButton));
    }
    if (removeFromAdminRoleButton) {
      removeFromAdminRoleButton.addEventListener('click', () => manageAdminRole('unassignRoles', removeFromAdminRoleButton));
    }

    /**
     * Loads and displays users who have the 'admin' role from the backend.
     * @async
     */
    async function loadAdminUsers() {
      displayMessage(loadAdminUsersMessage, 'Loading admin users...', 'info'); // Show loading message.
      adminUsersList.innerHTML = ''; // Clear any previously listed admin users.
      if (loadAdminUsersButton) loadAdminUsersButton.classList.add('loading'); // Set button to loading state.

      try {
        // Fetch users in the 'admin' role from the backend.
        // The backend /api/auth0-user-management should handle the 'listUsersInRole' action
        // by querying the Auth0 Management API.
        const response = await fetch('/api/auth0-user-management?action=listUsersInRole&roleName=admin');
        if (response.ok) {
          const users = await response.json(); // Parse the list of admin users.
          if (users.length === 0) {
            adminUsersList.innerHTML = '<li>No users currently in the admin role.</li>';
          } else {
            // Render each admin user in the list.
            users.forEach(user => {
              const li = document.createElement('li');
              // Auth0 user object might have user.user_id or user.id, and user.name or user.email.
              li.textContent = `${user.name || user.email} (ID: ${user.user_id || user.id})`;
              adminUsersList.appendChild(li);
            });
          }
          displayMessage(loadAdminUsersMessage, '', 'info'); // Clear the loading message.
        } else {
          // Handle errors from the backend.
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
          displayMessage(loadAdminUsersMessage, `Error: ${error.error || 'Failed to load admin users.'}`, 'error');
        }
      } catch (err) {
        // Handle network errors.
        console.error("Load admin users error:", err);
        displayMessage(loadAdminUsersMessage, `Network error: ${err.message}`, 'error');
      } finally {
        if (loadAdminUsersButton) loadAdminUsersButton.classList.remove('loading'); // Reset button loading state.
      }
    }

    // Add event listener to the "Load Admin Users" button.
    if (loadAdminUsersButton) {
      loadAdminUsersButton.addEventListener('click', loadAdminUsers);
    }
    // Optionally, load admin users when the page initially loads:
    // loadAdminUsers();
  }

  // Setup for the Admin User CRUD page (admin-user-crud.html).
  if (window.location.pathname.endsWith('admin-user-crud.html')) {
    // Select DOM elements for CRUD operations.
    const createUserForm = document.getElementById('create-user-form');
    const createMessage = document.getElementById('create-message'); // For create user feedback.
    const loadUsersButton = document.getElementById('load-users-button');
    const userListContainer = document.getElementById('user-list-container'); // Where the list of users is rendered.
    const listMessage = document.getElementById('list-message'); // For user list feedback.

    // Modal elements for editing a user.
    const editModal = document.getElementById('edit-user-modal');
    const editUserIdInput = document.getElementById('edit-userId');     // Hidden input for user's Auth0 ID.
    const editFirstNameInput = document.getElementById('edit-firstName');
    const editLastNameInput = document.getElementById('edit-lastName');
    const editEmailInput = document.getElementById('edit-email');       // Email might be read-only or require special handling.
    const saveEditButton = document.getElementById('save-edit-button');
    const editMessage = document.getElementById('edit-message');        // For edit user feedback.
    const createUserSubmitButton = createUserForm ? createUserForm.querySelector('button[type="submit"]') : null;

    // Event listener for the Create User form submission.
    if (createUserForm) {
      createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission.
        displayMessage(createMessage, 'Creating user...', 'info'); // Clear previous messages.

        // Gather user data from the form. This structure is for creating an Auth0 user.
        const userData = {
          firstName: document.getElementById('firstName').value,
          lastName: document.getElementById('lastName').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value // Initial password for the new user.
        };

        if (createUserSubmitButton) createUserSubmitButton.classList.add('loading'); // Set button to loading.
        try {
          // Call the backend API to create a new user.
          const response = await fetch('/api/auth0-user-management', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // The backend API expects 'action: createUser' and the 'userData' payload.
            body: JSON.stringify({ action: 'createUser', userData })
          });

          if (response.ok) {
            const newUser = await response.json(); // Get the created user data.
            displayMessage(createMessage, `User ${newUser.email} created successfully (ID: ${newUser.user_id || newUser.id})`, 'success', 'message-area', 3000);
            createUserForm.reset(); // Reset the form fields.
            loadUsers(); // Refresh the list of users to include the new one.
          } else {
            // Handle creation errors from the backend.
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(createMessage, `Error: ${error.error || error.message || 'Failed to create user.'}`, 'error');
          }
        } catch (err) {
          // Handle network errors.
          console.error("Create user network error:", err);
          displayMessage(createMessage, `Network error: ${err.message}`, 'error');
        } finally {
          if (createUserSubmitButton) createUserSubmitButton.classList.remove('loading'); // Reset button loading state.
        }
      });
    }

    /**
     * Loads all users from the backend and renders them in the UI.
     * @async
     */
    async function loadUsers() {
      displayMessage(listMessage, 'Loading users...', 'info'); // Show loading message.
      userListContainer.innerHTML = ''; // Clear existing user list.
      if (loadUsersButton) loadUsersButton.classList.add('loading'); // Set button to loading.

      try {
        // Fetch all users from the backend.
        const response = await fetch('/api/auth0-user-management?action=listUsers');
        if (response.ok) {
          const users = await response.json(); // Parse the list of users.
          if (users.length === 0) {
            userListContainer.innerHTML = '<p>No users found.</p>';
          } else {
            const ul = document.createElement('ul');
            ul.className = 'styled-list item-list'; // Apply CSS classes for styling.
            // Create list items for each user with their details and action buttons.
            users.forEach(user => {
              const li = document.createElement('li');
              // Extract user details. Auth0 user objects have fields like user_id, given_name, family_name, email.
              const userId = user.user_id || user.id || user.sub; // Auth0 User ID (subject claim).
              const firstName = user.given_name || ''; // User's first name.
              const lastName = user.family_name || '';  // User's last name.
              const email = user.email || '';           // User's email.

              // Populate list item HTML with user info and action buttons.
              // Data attributes on buttons store user data for easy access in event handlers.
              li.innerHTML = `
                <div class="user-item-info">
                  <span class="user-name">${firstName} ${lastName}</span>
                  <span class="user-email">${email}</span>
                  <span class="user-id">Auth0 ID: ${userId}</span>
                </div>
                <div class="user-item-actions">
                  <button data-userid="${userId}" data-firstname="${firstName}" data-lastname="${lastName}" data-email="${email}" class="edit-user-btn btn btn-secondary btn-sm">Edit</button>
                  <button data-userid="${userId}" class="delete-user-btn btn btn-danger btn-sm">Delete</button>
                </div>
              `;
              ul.appendChild(li);
            });
            userListContainer.appendChild(ul);

            // Attach event listeners to the dynamically created "Edit" and "Delete" buttons.
            document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', handleEditUser));
            document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', handleDeleteUser));
          }
          displayMessage(listMessage, '', 'info'); // Clear loading message.
        } else {
          // Handle errors from the backend when loading users.
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
          displayMessage(listMessage, `Error loading users: ${error.error || error.message || 'Failed to load users.'}`, 'error');
        }
      } catch (err) {
        // Handle network errors.
        console.error("Load users network error:", err);
        displayMessage(listMessage, `Network error: ${err.message}`, 'error');
      } finally {
        if (loadUsersButton) loadUsersButton.classList.remove('loading'); // Reset button loading state.
      }
    }

    // Add event listener to the "Load Users" button.
    if (loadUsersButton) {
      loadUsersButton.addEventListener('click', loadUsers);
    }

    /**
     * Closes the edit user modal.
     */
    function closeEditModal() {
      if (editModal) {
        editModal.style.display = 'none'; // Hide the modal.
      }
    }
    // Make closeEditModal globally accessible if the modal's close button (X)
    // uses it directly in HTML (e.g., onclick="closeEditModal()").
    window.closeEditModal = closeEditModal;

    /**
     * Handles the click event for an "Edit User" button.
     * Populates the edit modal with the user's data and displays the modal.
     * @param {Event} event - The click event object.
     */
    function handleEditUser(event) {
      const btn = event.target.closest('.edit-user-btn'); // Get the button that was clicked.
      if (!btn) return; // Should not happen if listener is correctly attached.

      // Retrieve user data stored in the button's data attributes.
      editUserIdInput.value = btn.dataset.userid;       // Auth0 User ID (sub).
      editFirstNameInput.value = btn.dataset.firstname;
      editLastNameInput.value = btn.dataset.lastname;
      editEmailInput.value = btn.dataset.email;         // Email is often not updatable or requires special permissions.
                                                        // The backend should handle what can be updated.
      displayMessage(editMessage, '', 'info'); // Clear any previous messages in the modal.
      if (editModal) editModal.style.display = 'flex'; // Display the modal (use 'flex' for CSS centering).
    }

    // Add event listener for the "Save Changes" button in the edit modal.
    if (saveEditButton) {
      saveEditButton.addEventListener('click', async () => {
        const userIdToUpdate = editUserIdInput.value; // Get the Auth0 User ID.
        // Prepare the 'updates' payload for the Auth0 Management API (PATCH users endpoint).
        // Only include fields that are intended to be updated.
        // Email updates are sensitive and might be disallowed or require specific handling by the backend.
        const updates = {
          given_name: editFirstNameInput.value,
          family_name: editLastNameInput.value
          // email: editEmailInput.value, // Example: If email updates were allowed.
        };
        displayMessage(editMessage, 'Saving changes...', 'info'); // Show saving message.

        if (saveEditButton) saveEditButton.classList.add('loading'); // Set button to loading.
        try {
          // Call the backend API to update the user.
          // The backend should use the 'PATCH' method for Auth0 user updates.
          // Frontend sends 'PUT' here, backend's /api/auth0-user-management maps this to PATCH for Auth0.
          const response = await fetch('/api/auth0-user-management', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateUser', userId: userIdToUpdate, updates })
          });

          if (response.ok) {
            displayMessage(editMessage, 'User updated successfully!', 'success', 'message-area', 3000);
            closeEditModal(); // Close the modal on success.
            loadUsers();      // Refresh the user list to show changes.
          } else {
            // Handle update errors from the backend.
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(editMessage, `Error: ${error.error || error.message || 'Failed to update user.'}`, 'error');
          }
        } catch (err) {
          // Handle network errors.
          console.error("Update user network error:", err);
          displayMessage(editMessage, `Network error: ${err.message}`, 'error');
        } finally {
          if (saveEditButton) saveEditButton.classList.remove('loading'); // Reset button loading state.
        }
      });
    }

    /**
     * Handles the click event for a "Delete User" button.
     * Prompts for confirmation and then calls the backend to delete the user.
     * @async
     * @param {Event} event - The click event object.
     */
    async function handleDeleteUser(event) {
      const btn = event.target.closest('.delete-user-btn'); // Get the button that was clicked.
      if (!btn) return;
      const userIdToDelete = btn.dataset.userid; // Get the Auth0 User ID from the button's data attribute.

      // Confirm with the user before deleting, as this is irreversible.
      if (confirm(`Are you sure you want to delete user with ID: ${userIdToDelete}? This action cannot be undone.`)) {
        displayMessage(listMessage, 'Deleting user...', 'info'); // Show deleting message.
        btn.classList.add('loading'); // Set the specific delete button to loading state.
        try {
          // Call the backend API to delete the user.
          const response = await fetch('/api/auth0-user-management', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteUser', userId: userIdToDelete })
          });

          // Auth0 Management API returns 204 No Content on successful deletion.
          if (response.ok) {
            displayMessage(listMessage, 'User deleted successfully.', 'success', 'message-area', 3000);
            loadUsers(); // Refresh the user list.
          } else {
            // Handle deletion errors from the backend.
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(listMessage, `Error deleting user: ${error.error || error.message || 'Failed to delete.'}`, 'error');
          }
        } catch (err) {
          // Handle network errors.
          console.error("Delete user network error:", err);
          displayMessage(listMessage, `Network error: ${err.message}`, 'error');
        } finally {
          btn.classList.remove('loading'); // Reset button loading state.
        }
      }
    }
    // Optionally, load all users when the CRUD page initially loads:
    // loadUsers();
  }

  // Call checkAuthAndRedirect on every page load.
  // This ensures the user's authentication state is checked, UI is updated accordingly,
  // and redirection rules are applied consistently across the application.
  checkAuthAndRedirect();

  // Theme switching logic
  const themeToggleButton = document.getElementById('theme-toggle');
  const currentTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }

  // Apply saved theme or preference on initial load
  if (currentTheme) {
    applyTheme(currentTheme);
  } else if (prefersDark) {
    applyTheme('dark'); // Default to dark if OS prefers it and no user choice yet
  } else {
    applyTheme('light'); // Default to light
  }

  if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
      let newTheme = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
    });
  }
});