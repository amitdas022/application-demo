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
      // Staggered entry for dashboard cards if on protected.html
      if (currentPage.endsWith('protected.html')) {
        const userInfoCard = document.getElementById('user-info-details');
        // Delay applied directly to the card elements to trigger animation
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

/**
 * Creates and displays a custom confirmation modal.
 * @param {string} title - The title of the confirmation.
 * @param {string} message - The message body of the confirmation.
 * @param {function} onConfirmCallback - Function to execute if user confirms.
 * @param {function} [onCancelCallback] - Optional function to execute if user cancels.
 */
function showConfirmModal(title, message, onConfirmCallback, onCancelCallback = () => { }) {
  // Remove any existing modal first to prevent duplicates
  let existingModal = document.getElementById('custom-confirm-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHTML = `
        <div id="custom-confirm-modal" class="modal" aria-labelledby="confirm-modal-title" aria-modal="true" role="dialog">
            <div class="modal-content card">
                <header class="modal-header">
                    <h3 id="confirm-modal-title" class="card-title">${title}</h3>
                    <button class="modal-close-btn" aria-label="Close dialog">&times;</button>
                </header>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <footer class="modal-footer">
                    <button id="confirm-yes-btn" class="btn btn-danger">Confirm</button>
                    <button id="confirm-no-btn" class="btn btn-secondary">Cancel</button>
                </footer>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modalElement = document.getElementById('custom-confirm-modal');
  const confirmYesBtn = document.getElementById('confirm-yes-btn');
  const confirmNoBtn = document.getElementById('confirm-no-btn');
  const closeModalBtn = modalElement.querySelector('.modal-close-btn');
  const modalContent = modalElement.querySelector('.modal-content');

  // Show the modal container and trigger open animations
  modalElement.classList.remove('modal-closing-backdrop'); // Ensure no lingering closing class
  modalElement.classList.add('modal-active');
  modalContent.classList.remove('modal-closing'); // Ensure no lingering closing class
  modalContent.classList.add('modal-open');


  const closeAndCleanup = () => {
    // Trigger closing animations
    modalContent.classList.remove('modal-open');
    modalContent.classList.add('modal-closing');
    modalElement.classList.remove('modal-active');
    modalElement.classList.add('modal-closing-backdrop');

    // Wait for animations to finish before removing from DOM
    let animationEndCount = 0;
    const totalAnimations = 2; // one for modalContent, one for modalElement

    const onAnimationEnd = () => {
      animationEndCount++;
      if (animationEndCount === totalAnimations) {
        modalContent.removeEventListener('animationend', onContentAnimationEnd);
        modalElement.removeEventListener('animationend', onElementAnimationEnd);
        modalElement.remove(); // Remove modal from DOM after all animations
      }
    };

    const onContentAnimationEnd = (event) => {
      // Ensure this is the bounce animation, not some other child animation
      if (event.animationName === 'modalBounceOut' || event.animationName === 'fadeOut') {
        onAnimationEnd();
      }
    };

    const onElementAnimationEnd = (event) => {
      // Ensure this is the backdrop fade out
      if (event.animationName === 'fadeOut') {
        onAnimationEnd();
      }
    };

    modalContent.addEventListener('animationend', onContentAnimationEnd, { once: true });
    modalElement.addEventListener('animationend', onElementAnimationEnd, { once: true });
  };


  confirmYesBtn.addEventListener('click', () => {
    onConfirmCallback();
    closeAndCleanup();
  });

  confirmNoBtn.addEventListener('click', () => {
    onCancelCallback();
    closeAndCleanup();
  });

  closeModalBtn.addEventListener('click', () => {
    onCancelCallback();
    closeAndCleanup();
  });

  // Close modal if clicking outside content (on overlay)
  modalElement.addEventListener('click', (event) => {
    if (event.target === modalElement) { // Ensure click is on the modal container itself
      onCancelCallback();
      closeAndCleanup();
    }
  });
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
    const formWrapper = document.querySelector('.form-wrapper'); // Parent of bg-logos

    // Event listener for global background logo animation on button hover
    if (loginButton && formWrapper) {
      loginButton.addEventListener('mouseenter', () => {
        formWrapper.classList.add('hovered-by-button'); // Add a class to the form-wrapper or button
      });
      loginButton.addEventListener('mouseleave', () => {
        formWrapper.classList.remove('hovered-by-button');
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

        // Prevent re-animation/submission
        if (submitButton.classList.contains('login-button-morphing') || submitButton.classList.contains('login-button-pulse-active')) {
            return;
        }

        submitButton.classList.add('login-button-pulse-active');
        submitButton.classList.remove('ripple-active'); // Stop ripple if it's somehow active

        // Define pulseEndHandler here to be able to remove it by reference in the fallback
        function pulseEndHandler() {
            submitButton.removeEventListener('animationend', pulseEndHandler);
            submitButton.classList.remove('login-button-pulse-active');
            submitButton.classList.add('login-button-morphing');
            performLogin();
        }

        submitButton.addEventListener('animationend', pulseEndHandler, { once: true });

        // Fallback for pulse animation
        const pulseFallbackTimeout = setTimeout(() => {
            if (submitButton.classList.contains('login-button-pulse-active') && !submitButton.classList.contains('login-button-morphing')) {
                console.warn('Login button pulse animation fallback triggered.');
                submitButton.removeEventListener('animationend', pulseEndHandler); // Remove listener
                submitButton.classList.remove('login-button-pulse-active');
                submitButton.classList.add('login-button-morphing');
                performLogin();
            }
        }, 260); // Pulse duration + buffer

        async function performLogin() {
            // Clear the fallback timeout if performLogin is called, e.g. by animationend
            clearTimeout(pulseFallbackTimeout);
            try {
                // The original login function already handles displaying errors.
                await login(usernameInput.value, passwordInput.value, errorMessageElement);
                // If login is successful, page redirects, so button state reset might not be visible or necessary here.
            } catch (error) {
                // This catch block might not be strictly necessary if login() handles all its errors.
                console.error("Error during performLogin:", error);
            } finally {
                // Reset button state ONLY if login failed and we are still on the page.
                // A simple way to check is if the morphing class is still present,
                // implying an error occurred before redirection.
                if (submitButton.classList.contains('login-button-morphing')) {
                    submitButton.classList.remove('login-button-morphing');
                    // Text will reappear due to text-indent no longer applying from CSS.
                    // If text was manually cleared, it would need to be restored here.
                }
                 // Ensure pulse class is also cleaned up in case of very fast errors or edge cases
                submitButton.classList.remove('login-button-pulse-active');
            }
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
    button.addEventListener('click', function (e) {
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
    const messageDiv = document.getElementById('admin-role-message'); // Renamed from messageDiv for clarity
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
              li.style.setProperty('--item-index', `${index * 0.05}s`); // Set delay for staggered animation
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
      // Trigger initial load on page load if the list is empty (optional)
      if (adminUsersList.children.length === 0) { // Check if the container has content
        loadAdminUsers();
      }
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

    // --- Modal Control Functions for Edit User Modal ---
    function showEditModal() {
      if (editModal) {
        const modalContent = editModal.querySelector('.modal-content');
        // Ensure no closing animation classes are present
        editModal.classList.remove('modal-closing-backdrop');
        modalContent.classList.remove('modal-closing');

        editModal.style.display = 'flex'; // Make it visible
        editModal.classList.add('modal-active'); // Activate backdrop fade-in
        modalContent.classList.add('modal-open'); // Trigger content bounce-in
      }
    }

    function closeEditModal() {
      if (editModal) {
        const modalContent = editModal.querySelector('.modal-content');

        // Trigger closing animations
        modalContent.classList.remove('modal-open');
        modalContent.classList.add('modal-closing');
        editModal.classList.remove('modal-active'); // Start backdrop fade-out
        editModal.classList.add('modal-closing-backdrop');

        // Wait for both animations to finish before hiding display
        let animationEndCount = 0;
        const totalAnimations = 2; // For modalContent and editModal (backdrop)

        const onAnimationEnd = () => {
          animationEndCount++;
          if (animationEndCount === totalAnimations) {
            modalContent.removeEventListener('animationend', onContentAnimationEnd);
            editModal.removeEventListener('animationend', onElementAnimationEnd);
            editModal.style.display = 'none'; // Finally hide the modal
            // Clean up closing classes
            modalContent.classList.remove('modal-closing');
            editModal.classList.remove('modal-closing-backdrop');
          }
        };

        const onContentAnimationEnd = (event) => {
          // Ensure this is the correct animation (e.g., modalBounceOut or fadeOut)
          if (event.animationName === 'modalBounceOut' || event.animationName === 'fadeOut') {
            onAnimationEnd();
          }
        };

        const onElementAnimationEnd = (event) => {
          // Ensure this is the correct animation (e.g., fadeOut for backdrop)
          if (event.animationName === 'fadeOut') {
            onAnimationEnd();
          }
        };

        modalContent.addEventListener('animationend', onContentAnimationEnd, { once: true });
        editModal.addEventListener('animationend', onElementAnimationEnd, { once: true });
      }
    }
    // Make closeEditModal globally accessible for HTML `onclick` (if any, though prefer JS listener)
    window.closeEditModal = closeEditModal;


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
              li.style.setProperty('--item-index', `${index * 0.05}s`); // Set delay for staggered animation
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
      // Trigger initial load on page load if the list is empty (optional)
      if (userListContainer.children.length === 0) { // Check if the container has content
        loadUsers();
      }
    }

    // Event listener for the 'x' button on the edit modal
    const editModalCloseBtn = editModal.querySelector('.modal-close-btn');
    if (editModalCloseBtn) {
      editModalCloseBtn.addEventListener('click', closeEditModal);
    }
    // Event listener for clicking outside the modal content (on the overlay)
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) { // Check if the click was directly on the modal backdrop
        closeEditModal();
      }
    });


    function handleEditUser(event) {
      const btn = event.target.closest('.edit-user-btn');
      if (!btn) return;

      editUserIdInput.value = btn.dataset.userid;
      editFirstNameInput.value = btn.dataset.firstname;
      editLastNameInput.value = btn.dataset.lastname;
      editEmailInput.value = btn.dataset.email;

      displayMessage(editMessage, '', 'info');
      showEditModal(); // Call the new function to show modal smoothly
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

      // Replace confirm() with custom modal
      showConfirmModal(
        'Confirm Deletion',
        `Are you sure you want to delete user with ID: ${userIdToDelete}? This action cannot be undone.`,
        async () => { // On Confirm Callback
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
        },
        () => { // On Cancel Callback
          showToast('User deletion cancelled.', 'info');
        }
      );
    }
  }

  // Call checkAuthAndRedirect on every page load.
  checkAuthAndRedirect();

  // *************  Animations   *************** //

  /**
  * This function makes a given HTML element move to random positions within the visible browser window.
  * Each element animated by this function will move independently, with its own random initial delay
  * and subsequent random intervals between movements, ensuring they don't move in sync.
  *
  * @param {HTMLElement} element - The HTML element to be animated.
  */
  function moveLandingPageElementIndependently() {
    const els = [...document.querySelectorAll('.scene-element')];
    const scene = { w: window.innerWidth, h: window.innerHeight };
    window.onresize = () => {
      scene.w = window.innerWidth;
      scene.h = window.innerHeight;
    };

    const objs = els.map(el => ({
      el,
      w: el.offsetWidth,
      h: el.offsetHeight,
      x: Math.random() * (scene.w - el.offsetWidth),
      y: Math.random() * (scene.h - el.offsetHeight),
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      angle: Math.random() * 360,
      rotationSpeed: 0.5 + Math.random() * 1.5,    // random rotation speed per element
      morphSpeed: 300 + Math.random() * 700,       // random morph period (ms)
      morphPhase: Math.random() * 2 * Math.PI       // random morph phase offset
    }));

    function animate(time = 0) {
      objs.forEach(o => {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < 0 || o.x + o.w > scene.w) o.vx *= -1;
        if (o.y < 0 || o.y + o.h > scene.h) o.vy *= -1;

        o.angle = (o.angle + o.rotationSpeed) % 360;
        const morphProgress = Math.sin((time / o.morphSpeed) + o.morphPhase);
        const scale = 0.9 + 0.1 * morphProgress;

        o.el.style.transform = `translate(${o.x}px,${o.y}px) scale(${scale}) rotate(${o.angle}deg)`;

        // Morph border-radius with randomized morphing
        const r1 = 20 + 30 * Math.abs(morphProgress);
        const r2 = 100 - r1;
        o.el.style.borderRadius = `${r1}% ${r2}% ${r2}% ${r1}% / ${r2}% ${r1}% ${r1}% ${r2}%`;
      });
      requestAnimationFrame(animate);
    }
    animate();
  }
  moveLandingPageElementIndependently();

});