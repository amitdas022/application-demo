// Set this global variable to true in your browser's developer console
// (e.g., window.LOCAL_TESTING_MODE = true;) to bypass Okta authentication checks.
// Remember to remove or set to false for production/actual testing.
// Removed Okta Auth JS initialization

// Function to handle login by sending credentials to backend
async function login(username, password, errorMessageElement) {
  try {
    const response = await fetch('/api/auth', { // Call backend auth endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Ensure your backend /api/auth expects 'username' or 'email'
      // The backend /api/auth.js provided uses 'username' which it then treats as email.
      // If your login form has an input with name="email", use that.
      // For consistency with backend, let's assume 'username' is the key for email.
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const user = await response.json();
      // Store user info locally (e.g., localStorage)
      localStorage.setItem('authenticatedUser', JSON.stringify(user));
      // Crucial: Log to see what your backend is sending, especially the roles
      console.log('User data received from backend and stored:', user);
      // Clear any previous error messages
      if (errorMessageElement) {
        errorMessageElement.textContent = '';
        errorMessageElement.className = 'error-message'; // Reset class
      }
      window.location.href = 'protected.html';
    } else {
      const error = await response.json().catch(() => ({ error: 'Unknown error from server.' }));
      displayMessage(errorMessageElement, `Login failed: ${error.error || 'Invalid credentials.'}`, 'error', 'error-message');
    }
  } catch (error) {
    console.error('Login error:', error);
    const message = 'Invalid credentials or error during login.';
    displayMessage(errorMessageElement, message, 'error', 'error-message');
  }
}

async function logout() {
  // Clear local storage user info
  localStorage.removeItem('authenticatedUser');
  // In a real app with server-side sessions, you'd call a backend logout endpoint here
  // await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html'; // Go to login page after logout
}

// checkAuth function now checks local storage instead of Okta Auth JS
// This is the single source of truth for client-side auth checks.
function checkAuthAndRedirect() { // Renamed for clarity, as it also handles UI updates
  // --- Start Local Testing Bypass (Frontend Only) ---
  if (window.LOCAL_TESTING_MODE) {
    console.warn("LOCAL_TESTING_MODE is active. Bypassing client-side authentication.");
    // Simulate a user object for UI elements if one isn't already set (e.g., by manual console commands)
    // If you want to test non-admin views in LOCAL_TESTING_MODE,
    // ensure the dummyUser here does NOT have an admin role.
    if (!localStorage.getItem('authenticatedUser') &&
      !window.location.pathname.endsWith('/login.html') &&
      !window.location.pathname.endsWith('/index.html') &&
      !window.location.pathname.endsWith('/') // Also check for root path
    ) {
      // Default dummy user for LOCAL_TESTING_MODE (non-admin if not overridden)
      const dummyUser = {
        id: 'test-user-123',
        profile: { firstName: 'Local', lastName: 'Tester', name: 'Local Tester', email: 'test@example.com' },
        roles: ['user'] // Simulate a basic user role
      };
      localStorage.setItem('authenticatedUser', JSON.stringify(dummyUser));
    }
  }
  // --- End Local Testing Bypass ---

  const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));
  const currentPage = window.location.pathname;

  // DOM elements for protected.html (or any page showing user info)
  const userProfileNameEl = document.getElementById('user-profile-name');
  const userProfileEmailEl = document.getElementById('user-profile-email');
  const userProfileRolesEl = document.getElementById('user-profile-roles');
  const adminLinksContainerEl = document.getElementById('admin-links-container');
  const logoutButton = document.getElementById('logout-button');

  if (logoutButton) {
    logoutButton.style.display = authenticatedUser ? 'block' : 'none';
  }

  if (authenticatedUser) {
    // User is "authenticated" (either via real login or LOCAL_TESTING_MODE with a dummy user)

    // Populate user info on relevant pages (e.g., protected.html)
    if (userProfileNameEl && authenticatedUser.profile) {
      userProfileNameEl.textContent = authenticatedUser.profile.name || authenticatedUser.profile.firstName || authenticatedUser.profile.email || 'User';
    }
    if (userProfileEmailEl && authenticatedUser.profile) {
      userProfileEmailEl.textContent = authenticatedUser.profile.email || 'N/A';
    }
    if (userProfileRolesEl) {
      userProfileRolesEl.textContent = authenticatedUser.roles?.join(', ') || 'No roles assigned';
      // For debugging, you can also log the roles here:
      // console.log('Current user roles:', authenticatedUser.roles);
    }

    const isAdmin = authenticatedUser.roles && authenticatedUser.roles.some(role => typeof role === 'string' && role.toLowerCase() === 'admin');

    // Show/hide admin links container on protected.html
    if (adminLinksContainerEl) {
      adminLinksContainerEl.style.display = isAdmin ? 'block' : 'none';
    }

    // Redirection logic for logged-in users
    if (isAdmin) {
      // Admin can access any page. No specific redirection needed *from* protected.html.
      // They will see admin links on protected.html.
      // If they are on login.html, redirect them.
      if (currentPage.endsWith('login.html')) {
        window.location.href = 'protected.html';
      }
    } else {
      // Non-admin user
      // If on an admin page, redirect to protected.html
      if (currentPage.endsWith('admin.html') || currentPage.endsWith('admin-group.html') || currentPage.endsWith('admin-user-crud.html')) {
        alert('Access Denied: You do not have permission to view this page.');
        window.location.href = 'protected.html'; // redirect from admin pages if not admin
      }
      // If they are on login.html, redirect them.
      if (currentPage.endsWith('login.html')) {
        window.location.href = 'protected.html';
      }
    }
  } else {
    // User is not authenticated
    // Redirect to login if on a protected page or any admin page
    const isProtectedOrAdminPage = currentPage.endsWith('protected.html') || currentPage.includes('admin');
    if (isProtectedOrAdminPage) {
      window.location.href = 'login.html';
    }
  }
}

/**
 * Displays a message in a designated element with appropriate styling and animation.
 * @param {HTMLElement} element The HTML element to display the message in.
 * @param {string} text The message text.
 * @param {'success' | 'error' | 'info'} type The type of message.
 * @param {string} baseClass The base class for the message element (e.g., 'message-area' or 'error-message').
 * @param {number} autoHideDelay Milliseconds to auto-hide the message, 0 for no auto-hide.
 */
function displayMessage(element, text, type = 'info', baseClass = 'message-area', autoHideDelay = 0) {
  if (element) {
    element.textContent = text;
    element.className = `${baseClass} ${type} show`; // Add 'show' to trigger animation

    if (autoHideDelay > 0) {
      setTimeout(() => {
        element.classList.remove('show');
        // Optionally reset completely after animation out
        // setTimeout(() => {
        //   element.textContent = '';
        //   element.className = baseClass;
        // }, 300); // Match CSS transition duration
      }, autoHideDelay);
    }
  }
}

// Event listeners and initial checks:
document.addEventListener('DOMContentLoaded', () => {
  // Welcome page title animation
  if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html')) {
    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) {
      const letters = welcomeTitle.querySelectorAll('span');
      letters.forEach((span, index) => {
        span.style.setProperty('--letter-index', index);
      });
    }
  }

  if (window.location.pathname.endsWith('login.html')) {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const usernameInput = loginForm.querySelector('input[name="username"]'); // Or by ID if you have one
        const passwordInput = loginForm.querySelector('input[name="password"]'); // Or by ID
        const errorMessageElement = document.getElementById('error-message');
        const submitButton = loginForm.querySelector('button[type="submit"]');

        if (submitButton) submitButton.classList.add('loading');
        try {
          await login(usernameInput.value, passwordInput.value, errorMessageElement);
        } finally {
          if (submitButton) submitButton.classList.remove('loading');
        }
      });
    } // else if on login.html and user is already authenticated, redirect (handled in checkAuthAndRedirect)
  }
  if (document.getElementById('logout-button')) {
    document.getElementById('logout-button').addEventListener('click', logout)
  }

  // This page should now be considered "User Role Management" or similar
  // Updated for admin-group.html
  if (window.location.pathname.endsWith('admin-group.html')) {
    const addToAdminRoleButton = document.getElementById('add-to-admin-role-button');
    const removeFromAdminRoleButton = document.getElementById('remove-from-admin-role-button');
    const userIdInput = document.getElementById('admin-role-userId');
    const messageDiv = document.getElementById('admin-role-message');
    const loadAdminUsersButton = document.getElementById('load-admin-users-button');
    const adminUsersList = document.getElementById('admin-users-list');
    const loadAdminUsersMessage = document.getElementById('load-admin-users-message');

    async function manageAdminRole(action, buttonElement) {
      const userIdToAssignRole = userIdInput.value;
      if (userIdToAssignRole) {
        // const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser')); // Not needed if backend uses M2M
        try {
          if (buttonElement) buttonElement.classList.add('loading');
          // Call endpoint to assign roles in Auth0
          const response = await fetch('/api/auth0-user-management', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              // No specific user header needed here if backend uses M2M token for Management API
            },
            // For Auth0, you assign roles. 'AdminGroup' concept is now an Auth0 role.
            body: JSON.stringify({ action: action, userId: userIdToAssignRole, roles: ['admin'] }) // Example: assign/remove 'admin' role
          });
          if (response.ok) {
            const successMessage = action === 'assignRoles' ? 'User added to admin role.' : 'User removed from admin role.';
            displayMessage(messageDiv, successMessage, 'success');
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error from server.' }));
            displayMessage(messageDiv, `Failed to update roles: ${errorData.error || 'Server error'}`, 'error');
          }
        } catch (error) {
          console.error("Error updating roles:", error);
          displayMessage(messageDiv, 'Error: ' + error.message, 'error');
        } finally {
          if (buttonElement) buttonElement.classList.remove('loading');
        }
      } else {
        displayMessage(messageDiv, 'Please enter a User ID (Auth0 `sub`).', 'error');
      }
    }

    if (addToAdminRoleButton) {
      addToAdminRoleButton.addEventListener('click', () => manageAdminRole('assignRoles', addToAdminRoleButton));
    }
    if (removeFromAdminRoleButton) {
      removeFromAdminRoleButton.addEventListener('click', () => manageAdminRole('unassignRoles', removeFromAdminRoleButton));
    }

    async function loadAdminUsers() {
      displayMessage(loadAdminUsersMessage, 'Loading admin users...', 'info');
      adminUsersList.innerHTML = ''; // Clear previous list
      if (loadAdminUsersButton) loadAdminUsersButton.classList.add('loading');

      try {
        const response = await fetch('/api/auth0-user-management?action=listUsersInRole&roleName=admin'); // Assuming backend supports this
        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            adminUsersList.innerHTML = '<li>No users currently in the admin role.</li>';
          } else {
            users.forEach(user => {
              const li = document.createElement('li');
              li.textContent = `${user.name || user.email} (ID: ${user.user_id})`;
              adminUsersList.appendChild(li);
            });
          }
          displayMessage(loadAdminUsersMessage, '', 'info'); // Clear loading message
        } else {
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
          displayMessage(loadAdminUsersMessage, `Error: ${error.error || 'Failed to load admin users.'}`, 'error');
        }
      } catch (err) {
        console.error("Load admin users error:", err);
        displayMessage(loadAdminUsersMessage, `Network error: ${err.message}`, 'error');
      } finally {
        if (loadAdminUsersButton) loadAdminUsersButton.classList.remove('loading');
      }
    }

    if (loadAdminUsersButton) {
      loadAdminUsersButton.addEventListener('click', loadAdminUsers);
    }
    // loadAdminUsers(); // Optionally load on page init
  }

  if (window.location.pathname.endsWith('admin-user-crud.html')) {
    const createUserForm = document.getElementById('create-user-form');
    const createMessage = document.getElementById('create-message');
    const loadUsersButton = document.getElementById('load-users-button');
    const userListContainer = document.getElementById('user-list-container');
    const listMessage = document.getElementById('list-message');

    const editModal = document.getElementById('edit-user-modal');
    const editUserIdInput = document.getElementById('edit-userId');
    const editFirstNameInput = document.getElementById('edit-firstName');
    const editLastNameInput = document.getElementById('edit-lastName');
    const editEmailInput = document.getElementById('edit-email');
    const saveEditButton = document.getElementById('save-edit-button');
    const editMessage = document.getElementById('edit-message');
    const createUserSubmitButton = createUserForm ? createUserForm.querySelector('button[type="submit"]') : null;

    if (createUserForm) {
      createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        displayMessage(createMessage, '', 'info'); // Clear previous

        const userData = { // This structure is for Auth0 user creation
          firstName: document.getElementById('firstName').value,
          lastName: document.getElementById('lastName').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        };

        if (createUserSubmitButton) createUserSubmitButton.classList.add('loading');
        try {
          const response = await fetch('/api/auth0-user-management', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createUser', userData })
          });

          if (response.ok) {
            const newUser = await response.json();
            displayMessage(createMessage, `User ${newUser.email} created successfully (ID: ${newUser.user_id || newUser.id})`, 'success');
            createUserForm.reset();
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(createMessage, `Error: ${error.error || error.message || 'Failed to create user.'}`, 'error');
          }
        } catch (err) {
          console.error("Create user network error:", err);
          displayMessage(createMessage, `Network error: ${err.message}`, 'error');
        } finally {
          if (createUserSubmitButton) createUserSubmitButton.classList.remove('loading');
        }
      });
    }

    async function loadUsers() {
      displayMessage(listMessage, 'Loading users...', 'info');
      userListContainer.innerHTML = '';
      if (loadUsersButton) loadUsersButton.classList.add('loading');

      try {
        const response = await fetch('/api/auth0-user-management?action=listUsers');

        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            userListContainer.innerHTML = '<p>No users found.</p>';
          } else {
            const ul = document.createElement('ul');
            ul.style.listStyleType = 'none';
            ul.className = 'styled-list item-list'; // Apply new CSS classes
            users.forEach(user => {
              const li = document.createElement('li');
              // Removed inline styles, will be handled by CSS classes
              // Adjust to Auth0 user object structure
              const userId = user.user_id || user.id || user.sub;
              const firstName = user.given_name || user.name || '';
              const lastName = user.family_name || '';
              const email = user.email || '';

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

            document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', handleEditUser));
            document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', handleDeleteUser));
          }
          displayMessage(listMessage, '', 'info'); // Clear loading message
        } else {
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
          displayMessage(listMessage, `Error loading users: ${error.error || error.message || 'Failed to load users.'}`, 'error');
        }
      } catch (err) {
        console.error("Load users network error:", err);
        displayMessage(listMessage, `Network error: ${err.message}`, 'error');
      } finally {
        if (loadUsersButton) loadUsersButton.classList.remove('loading');
      }
    }

    if (loadUsersButton) {
      loadUsersButton.addEventListener('click', loadUsers);
    }

    function closeEditModal() {
      if (editModal) {
        editModal.style.display = 'none';
      }
    }
    // Make it globally accessible if modal's close button uses it directly in HTML onclick
    window.closeEditModal = closeEditModal;

    function handleEditUser(event) {
      const btn = event.target.closest('.edit-user-btn');
      if (!btn) return;
      editUserIdInput.value = btn.dataset.userid; // Auth0 User ID (sub)
      editFirstNameInput.value = btn.dataset.firstname;
      editLastNameInput.value = btn.dataset.lastname;
      editEmailInput.value = btn.dataset.email;
      displayMessage(editMessage, '', 'info'); // Clear previous message
      if (editModal) editModal.style.display = 'flex'; // Ensure 'flex' is used to enable CSS centering
    }

    if (saveEditButton) {
      saveEditButton.addEventListener('click', async () => {
        const userIdToUpdate = editUserIdInput.value; // Auth0 User ID (sub)
        const updates = { // Payload for Auth0 Management API (PATCH users)
          given_name: editFirstNameInput.value,
          family_name: editLastNameInput.value
          // email: editEmailInput.value, // Email updates are sensitive and might require specific handling/permissions
        };
        displayMessage(editMessage, 'Saving...', 'info');

        if (saveEditButton) saveEditButton.classList.add('loading');
        try {
          const response = await fetch('/api/auth0-user-management', {
            method: 'PUT', // Should be PATCH for Auth0 user updates
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateUser', userId: userIdToUpdate, updates })
          });
          if (response.ok) {
            displayMessage(editMessage, 'User updated successfully!', 'success', 'message-area', 3000);
            closeEditModal();
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(editMessage, `Error: ${error.error || error.message || 'Failed to update.'}`, 'error');
          }
        } catch (err) {
          console.error("Update user network error:", err);
          displayMessage(editMessage, `Network error: ${err.message}`, 'error');
        } finally {
          if (saveEditButton) saveEditButton.classList.remove('loading');
        }
      });
    }

    async function handleDeleteUser(event) {
      const btn = event.target.closest('.delete-user-btn');
      if (!btn) return;
      const userIdToDelete = btn.dataset.userid; // Auth0 User ID (sub)
      if (confirm(`Are you sure you want to delete user with ID: ${userIdToDelete}? This is irreversible.`)) {
        displayMessage(listMessage, 'Deleting user...', 'info');
        btn.classList.add('loading'); // Add loading to the specific delete button
        try {
          const response = await fetch('/api/auth0-user-management', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteUser', userId: userIdToDelete })
          });

          if (response.ok) { // Auth0 DELETE user returns 204 No Content
            displayMessage(listMessage, 'User deleted successfully.', 'success', 'message-area', 3000);
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(listMessage, `Error deleting user: ${error.error || error.message || 'Failed to delete.'}`, 'error');
          }
        } catch (err) {
          console.error("Delete user network error:", err);
          displayMessage(listMessage, `Network error: ${err.message}`, 'error');
        } finally {
          btn.classList.remove('loading');
        }
      }
    }
    // loadUsers(); // Optionally load users on page load
  }
  checkAuthAndRedirect(); // Call this on every page load
});