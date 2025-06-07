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
      displayMessage(errorMessageElement, `Login failed: ${error.error || 'Invalid credentials.'}`, 'error', 'error-message', 0, true); // Added shake animation for error
    }
  } catch (error) {
    // Handle network errors or other issues during the login process.
    console.error('Login error:', error);
    const message = 'Invalid credentials or error during login.';
    displayMessage(errorMessageElement, message, 'error', 'error-message', 0, true); // Added shake animation for error
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
        profile: { firstName: 'Local', lastName: 'Tester', name: 'Local Tester', email: 'test@example.com', picture: 'assets/default-avatar.png' }, // Added default picture
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
  const userProfileNameEl = document.getElementById('user-profile-name');
  const userProfileEmailEl = document.getElementById('user-profile-email');
  const userProfileRolesEl = document.getElementById('user-profile-roles');
  const userProfilePictureEl = document.getElementById('user-profile-picture'); // New: Profile picture element
  const adminLinksContainerEl = document.getElementById('admin-links-container');
  const logoutButton = document.getElementById('logout-button');

  // Control visibility of the logout button based on authentication state.
  if (logoutButton) {
    logoutButton.style.display = authenticatedUser ? 'block' : 'none';
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
    // New: Set profile picture
    if (userProfilePictureEl && authenticatedUser.profile?.picture) {
        userProfilePictureEl.src = authenticatedUser.profile.picture;
    } else if (userProfilePictureEl) {
        userProfilePictureEl.src = 'assets/default-avatar.png'; // Fallback to default
    }

    if (userProfileRolesEl) {
      userProfileRolesEl.textContent = authenticatedUser.roles?.join(', ') || 'No roles assigned';
    }

    // Determine if the authenticated user has an 'admin' role.
    const isAdmin = authenticatedUser.roles && authenticatedUser.roles.some(role => typeof role === 'string' && role.toLowerCase() === 'admin');

    // Show or hide the admin links container based on whether the user is an admin.
    if (adminLinksContainerEl) {
      adminLinksContainerEl.style.display = isAdmin ? 'block' : 'none';
      // New: Staggered entry for dashboard cards if on protected.html
      if (currentPage.endsWith('protected.html')) {
        const userInfoCard = document.getElementById('user-info-details');
        if (userInfoCard) userInfoCard.style.animationDelay = '0.4s';
        if (adminLinksContainerEl) adminLinksContainerEl.style.animationDelay = '0.6s';
      }
    }

    // Redirection logic for logged-in users.
    if (isAdmin) {
      if (currentPage.endsWith('login.html')) {
        window.location.href = 'protected.html';
      }
    } else {
      const isAdminPage = currentPage.endsWith('admin.html') || currentPage.endsWith('admin-group.html') || currentPage.endsWith('admin-user-crud.html');
      if (isAdminPage) {
        // Use toast notification instead of alert for access denied
        showToast('Access Denied: You do not have permission to view this page.', 'error');
        window.location.href = 'protected.html';
      }
      if (currentPage.endsWith('login.html')) {
        window.location.href = 'protected.html';
      }
    }
  } else {
    // User is not authenticated
    const isProtectedPage = currentPage.endsWith('protected.html');
    const isAdminAreaPage = currentPage.includes('admin');
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
 * @param {boolean} [addShake=false] - If true, adds a shake animation to the error message.
 */
function displayMessage(element, text, type = 'info', baseClass = 'message-area', autoHideDelay = 0, addShake = false) {
  if (element) {
    element.textContent = text;
    element.className = `${baseClass} ${type} show`;
    if (addShake && type === 'error') {
      element.classList.add('shake');
      // Remove shake class after animation
      element.addEventListener('animationend', () => {
        element.classList.remove('shake');
      }, { once: true });
    }

    if (autoHideDelay > 0) {
      setTimeout(() => {
        element.classList.remove('show');
      }, autoHideDelay);
    }
  }
}

/**
 * Displays a transient "toast" notification.
 * @param {string} message - The message to display.
 * @param {'success' | 'error' | 'info'} [type='info'] - The type of toast.
 * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
 */
function showToast(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Auto-hide after duration
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove(); // Remove container if no toasts left
      }
    }, { once: true });
  }, duration);
}


// Main event listener that runs when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
  // Code for welcome page title animation.
  if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html')) {
    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) {
      const letters = welcomeTitle.querySelectorAll('span');
      letters.forEach((span, index) => {
        span.style.setProperty('--letter-index', index);
      });
    }
  }

  // Setup for the login page.
  if (window.location.pathname.endsWith('login.html')) {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.querySelector('.login-button'); // Get the login button
    const bgLogos = document.querySelectorAll('.login-page > .bg-logo'); // Global logos

    // Event listener for global background logo animation on button hover
    if (loginButton) {
      loginButton.addEventListener('mouseenter', () => {
        bgLogos.forEach(logo => logo.classList.add('reveal')); // This class should trigger the `logoPulseDrift` animation.
      });
      loginButton.addEventListener('mouseleave', () => {
        bgLogos.forEach(logo => logo.classList.remove('reveal'));
      });
    }

    if (loginForm) {
      // Form field entrance animation
      const formGroups = loginForm.querySelectorAll('.form-group');
      formGroups.forEach((group, index) => {
        group.style.setProperty('--form-field-delay', `${0.2 + index * 0.1}s`);
      });

      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const usernameInput = loginForm.querySelector('input[name="username"]');
        const passwordInput = loginForm.querySelector('input[name="password"]');
        const errorMessageElement = document.getElementById('error-message');
        const submitButton = loginForm.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.classList.add('loading');
            submitButton.classList.remove('ripple-active'); // Ensure no lingering ripple
        }

        try {
          await login(usernameInput.value, passwordInput.value, errorMessageElement);
        } finally {
          if (submitButton) submitButton.classList.remove('loading');
        }
      });
    }
  }

  // Add event listener for the global logout button if it exists.
  const globalLogoutButton = document.getElementById('logout-button');
  if (globalLogoutButton) {
    globalLogoutButton.addEventListener('click', logout);
  }

  // Add ripple effect to all buttons
  document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', function(e) {
      // Only apply ripple if not loading
      if (!this.classList.contains('loading')) {
        this.classList.add('ripple-active');
        // Remove the class after the animation to allow it to be re-triggered
        this.addEventListener('animationend', () => {
          this.classList.remove('ripple-active');
        }, { once: true });
      }
    });
  });


  // Setup for the Admin Group Management page (admin-group.html).
  if (window.location.pathname.endsWith('admin-group.html')) {
    const addToAdminRoleButton = document.getElementById('add-to-admin-role-button');
    const removeFromAdminRoleButton = document.getElementById('remove-from-admin-role-button');
    const userIdInput = document.getElementById('admin-role-userId');
    const messageDiv = document.getElementById('admin-role-message');
    const loadAdminUsersButton = document.getElementById('load-admin-users-button');
    const adminUsersList = document.getElementById('admin-users-list');
    const loadAdminUsersMessage = document.getElementById('load-admin-users-message');

    async function manageAdminRole(action, buttonElement) {
      const userIdToManage = userIdInput.value;
      if (userIdToManage) {
        try {
          if (buttonElement) buttonElement.classList.add('loading');
          const response = await fetch('/api/auth0-user-management', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, userId: userIdToManage, roles: ['admin'] })
          });

          if (response.ok) {
            const successMessage = action === 'assignRoles' ? 'User added to admin role successfully.' : 'User removed from admin role successfully.';
            showToast(successMessage, 'success'); // Use toast for success
            userIdInput.value = ''; // Clear input
            loadAdminUsers(); // Refresh the list
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown server error.' }));
            showToast(`Failed to update roles: ${errorData.error || 'Server error'}`, 'error'); // Use toast for error
          }
        } catch (error) {
          console.error("Error updating roles:", error);
          showToast('Client-side error: ' + error.message, 'error'); // Use toast for network errors
        } finally {
          if (buttonElement) buttonElement.classList.remove('loading');
        }
      } else {
        showToast('Please enter a User ID (Auth0 `sub`).', 'error'); // Use toast for validation
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
      adminUsersList.innerHTML = '';
      if (loadAdminUsersButton) loadAdminUsersButton.classList.add('loading');

      try {
        const response = await fetch('/api/auth0-user-management?action=listUsersInRole&roleName=admin');
        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            adminUsersList.innerHTML = '<li>No users currently in the admin role.</li>';
          } else {
            users.forEach((user, index) => {
              const li = document.createElement('li');
              li.textContent = `${user.name || user.email} (ID: ${user.user_id || user.id})`;
              li.classList.add('animated-item'); // Add class for animation
              li.style.setProperty('--item-index', index); // Set delay
              adminUsersList.appendChild(li);
            });
          }
          displayMessage(loadAdminUsersMessage, '', 'info');
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
  }

  // Setup for the Admin User CRUD page (admin-user-crud.html).
  if (window.location.pathname.endsWith('admin-user-crud.html')) {
    const createUserForm = document.getElementById('create-user-form');
    const createMessage = document.getElementById('create-message');
    const loadUsersButton = document.getElementById('load-users-button');
    const userListContainer = document.getElementById('user-list-container');
    const listMessage = document.getElementById('list-message');
    const userListSkeleton = document.getElementById('user-list-skeleton'); // Skeleton loader

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
        displayMessage(createMessage, 'Creating user...', 'info');

        const userData = {
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
            showToast(`User ${newUser.email} created successfully!`, 'success'); // Use toast
            createUserForm.reset();
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(createMessage, `Error: ${error.error || error.message || 'Failed to create user.'}`, 'error', 'message-area', 0, true); // Shake on error
          }
        } catch (err) {
          console.error("Create user network error:", err);
          displayMessage(createMessage, `Network error: ${err.message}`, 'error', 'message-area', 0, true); // Shake on error
        } finally {
          if (createUserSubmitButton) createUserSubmitButton.classList.remove('loading');
        }
      });
    }

    async function loadUsers() {
      displayMessage(listMessage, 'Loading users...', 'info');
      userListContainer.innerHTML = ''; // Clear existing
      if (loadUsersButton) loadUsersButton.classList.add('loading');
      if (userListSkeleton) userListSkeleton.style.display = 'flex'; // Show skeleton

      try {
        const response = await fetch('/api/auth0-user-management?action=listUsers');
        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            userListContainer.innerHTML = '<p>No users found.</p>';
          } else {
            const ul = document.createElement('ul');
            ul.className = 'styled-list item-list';
            users.forEach((user, index) => {
              const li = document.createElement('li');
              const userId = user.user_id || user.id || user.sub;
              const firstName = user.given_name || '';
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
              li.classList.add('animated-item'); // Add class for animation
              li.style.setProperty('--item-index', index); // Set delay
              ul.appendChild(li);
            });
            userListContainer.appendChild(ul);

            document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', handleEditUser));
            document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', handleDeleteUser));
          }
          displayMessage(listMessage, '', 'info');
        } else {
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
          displayMessage(listMessage, `Error loading users: ${error.error || error.message || 'Failed to load users.'}`, 'error');
        }
      } catch (err) {
        console.error("Load users network error:", err);
        displayMessage(listMessage, `Network error: ${err.message}`, 'error');
      } finally {
        if (loadUsersButton) loadUsersButton.classList.remove('loading');
        if (userListSkeleton) userListSkeleton.style.display = 'none'; // Hide skeleton
      }
    }

    if (loadUsersButton) {
      loadUsersButton.addEventListener('click', loadUsers);
    }

    function closeEditModal() {
      if (editModal) {
        editModal.style.display = 'none';
        editModal.querySelector('.modal-content').classList.remove('animated-modal'); // Remove bounce class
      }
    }
    window.closeEditModal = closeEditModal;

    function handleEditUser(event) {
      const btn = event.target.closest('.edit-user-btn');
      if (!btn) return;

      editUserIdInput.value = btn.dataset.userid;
      editFirstNameInput.value = btn.dataset.firstname;
      editLastNameInput.value = btn.dataset.lastname;
      editEmailInput.value = btn.dataset.email;

      displayMessage(editMessage, '', 'info');
      if (editModal) {
        editModal.style.display = 'flex';
        editModal.querySelector('.modal-content').classList.add('animated-modal'); // Add bounce class
      }
    }

    if (saveEditButton) {
      saveEditButton.addEventListener('click', async () => {
        const userIdToUpdate = editUserIdInput.value;
        const updates = {
          given_name: editFirstNameInput.value,
          family_name: editLastNameInput.value
        };
        displayMessage(editMessage, 'Saving changes...', 'info');

        if (saveEditButton) saveEditButton.classList.add('loading');
        try {
          const response = await fetch('/api/auth0-user-management', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateUser', userId: userIdToUpdate, updates })
          });

          if (response.ok) {
            showToast('User updated successfully!', 'success'); // Use toast
            closeEditModal();
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(editMessage, `Error: ${error.error || error.message || 'Failed to update user.'}`, 'error', 'message-area', 0, true); // Shake on error
          }
        } catch (err) {
          console.error("Update user network error:", err);
          displayMessage(editMessage, `Network error: ${err.message}`, 'error', 'message-area', 0, true); // Shake on error
        } finally {
          if (saveEditButton) saveEditButton.classList.remove('loading');
        }
      });
    }

    async function handleDeleteUser(event) {
      const btn = event.target.closest('.delete-user-btn');
      if (!btn) return;
      const userIdToDelete = btn.dataset.userid;

      if (confirm(`Are you sure you want to delete user with ID: ${userIdToDelete}? This action cannot be undone.`)) {
        displayMessage(listMessage, 'Deleting user...', 'info');
        btn.classList.add('loading');
        try {
          const response = await fetch('/api/auth0-user-management', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteUser', userId: userIdToDelete })
          });

          if (response.ok) {
            showToast('User deleted successfully.', 'success'); // Use toast
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(listMessage, `Error deleting user: ${error.error || error.message || 'Failed to delete.'}`, 'error', 'message-area', 0, true); // Shake on error
          }
        } catch (err) {
          console.error("Delete user network error:", err);
          displayMessage(listMessage, `Network error: ${err.message}`, 'error');
        } finally {
          btn.classList.remove('loading');
        }
      }
    }
  }

  // Call checkAuthAndRedirect on every page load.
  checkAuthAndRedirect();
});