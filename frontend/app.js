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
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const user = await response.json();
      // Store user info locally (e.g., localStorage)
      localStorage.setItem('authenticatedUser', JSON.stringify(user));
      window.location.href = 'protected.html';
    } else {
      const error = await response.json().catch(() => ({ error: 'Unknown error from server.' }));
      errorMessageElement.textContent = `Login failed: ${error.error || 'Invalid credentials.'}`;
    }
  } catch (error) {
    console.error('Login error:', error);
    // Use the passed errorMessageElement if available, otherwise fallback to displayError
    if (errorMessageElement) {
        errorMessageElement.textContent = 'Invalid credentials or error during login.';
    } else {
        displayError('Invalid credentials or error during login.');
    }
  }
}

async function logout() {
  // Clear local storage user info
  localStorage.removeItem('authenticatedUser');
  // In a real app with server-side sessions, you'd call a backend logout endpoint here
  // await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'index.html';
}

// checkAuth function now checks local storage instead of Okta Auth JS
// This is the single source of truth for client-side auth checks.
async function checkAuth() {
    // --- Start Local Testing Bypass (Frontend Only) ---
    if (window.LOCAL_TESTING_MODE) {
        console.warn("LOCAL_TESTING_MODE is active. Bypassing client-side authentication.");
        // Simulate a user object for UI elements if needed
        // If you want to test non-admin views in LOCAL_TESTING_MODE,
        // ensure the dummyUser here does NOT have an admin role.
        if (!localStorage.getItem('authenticatedUser') &&
            !window.location.pathname.endsWith('/login.html') &&
            !window.location.pathname.endsWith('/index.html') &&
            !window.location.pathname.endsWith('/') // Also check for root path
        ) {
            // Default dummy user for LOCAL_TESTING_MODE (non-admin)
            const dummyUser = {
                id: 'test-user-123',
                profile: { firstName: 'Local', lastName: 'Tester', name: 'Local Tester', email: 'test@example.com' },
                roles: ['user'] // Simulate a basic user role
            };
            localStorage.setItem('authenticatedUser', JSON.stringify(dummyUser));
        }
        // Do not return here if you want the rest of the logic (like admin checks) to run with the dummy user.
    }
    // --- End Local Testing Bypass ---

    const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));

    if (authenticatedUser) {
        // User is "authenticated" based on local storage
        const usernameEl = document.getElementById('username');
        if (usernameEl && authenticatedUser.profile) {
             usernameEl.textContent = authenticatedUser.profile.name || authenticatedUser.profile.firstName || authenticatedUser.profile.email;
        }

        // Check for admin role from Auth0 roles.
        // Adjust 'admin' if your Auth0 role name is different.
        const isAdmin = authenticatedUser.roles && authenticatedUser.roles.some(role => typeof role === 'string' && role.toLowerCase() === 'admin');

        if (isAdmin) {
            if (window.location.pathname.endsWith('protected.html')) {
                window.location.href = 'admin.html'; // redirect to admin if on protected
            }
        } else {
            if (window.location.pathname.endsWith('admin.html') || window.location.pathname.endsWith('admin-group.html') || window.location.pathname.endsWith('admin-user-crud.html')) {
                window.location.href = 'protected.html'; // redirect from admin pages if not admin
            }
        }
    } else {
        // User is not authenticated (and not in LOCAL_TESTING_MODE with a dummy user),
        // redirect to login if not already on login or index page.
        if (!window.location.pathname.endsWith('login.html') &&
            !window.location.pathname.endsWith('index.html') &&
            !window.location.pathname.endsWith('/') // Also check for root path
        ) {
            window.location.href = 'login.html';
        }
    }
}

function displayError(message) {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = message;
  }
}

// Event listeners and initial checks:
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.endsWith('login.html')) {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        const errorMessageElement = document.getElementById('error-message');
        await login(username, password, errorMessageElement);
      });
    }
  }
  if (document.getElementById('logout-button')) {
    document.getElementById('logout-button').addEventListener('click', logout)
  }

  // This page should now be considered "User Role Management" or similar
  if (window.location.pathname.endsWith('admin-group.html')) {
    const addUserButton = document.getElementById('add-user-button');
    const addUserInput = document.getElementById('add-user-input'); // This input should take Auth0 User ID (sub)
    const messageDiv = document.getElementById('message');

    if (addUserButton) {
        addUserButton.addEventListener('click', async () => {
          const userIdToAssignRole = addUserInput.value; // Auth0 User ID (sub)
          if (userIdToAssignRole) {
            // const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser')); // Not needed if backend uses M2M
            try {
              // Call endpoint to assign roles in Auth0
              const response = await fetch('/api/auth0-user-management', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  // No specific user header needed here if backend uses M2M token for Management API
                },
                // For Auth0, you assign roles. 'AdminGroup' concept is now an Auth0 role.
                body: JSON.stringify({ action: 'assignRoles', userId: userIdToAssignRole, roles: ['admin'] }) // Example: assign 'admin' role
              });
              if (response.ok) {
                messageDiv.textContent = 'User roles updated successfully (e.g., "admin" role assigned).';
                messageDiv.className = 'success';
              } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error from server.' }));
                messageDiv.textContent = `Failed to update roles: ${errorData.error || 'Server error'}`;
                messageDiv.className = 'error';
              }
            } catch (error) {
              console.error("Error updating roles:", error);
              messageDiv.textContent = 'Error: ' + error.message;
              messageDiv.className = 'error';
            }
          } else {
            messageDiv.textContent = 'Please enter a User ID (Auth0 `sub`).';
            messageDiv.className = 'error';
          }
        });
    }
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

    if (createUserForm) {
      createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        createMessage.textContent = '';
        createMessage.className = 'message';

        const userData = { // This structure is for Auth0 user creation
          firstName: document.getElementById('firstName').value,
          lastName: document.getElementById('lastName').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        };

        try {
          const response = await fetch('/api/auth0-user-management', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createUser', userData })
          });
          if (response.ok) {
            const newUser = await response.json();
            createMessage.textContent = `User ${newUser.email} created successfully (ID: ${newUser.user_id || newUser.id})`;
            createMessage.className = 'message success';
            createUserForm.reset();
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.'}));
            createMessage.textContent = `Error: ${error.error || error.message || 'Failed to create user.'}`;
            createMessage.className = 'message error';
          }
        } catch (err) {
          console.error("Create user network error:", err);
          createMessage.textContent = `Network error: ${err.message}`;
          createMessage.className = 'message error';
        }
      });
    }

    async function loadUsers() {
      listMessage.textContent = 'Loading users...';
      listMessage.className = 'message';
      userListContainer.innerHTML = '';

      try {
        const response = await fetch('/api/auth0-user-management?action=listUsers');
        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            userListContainer.innerHTML = '<p>No users found.</p>';
          } else {
            const ul = document.createElement('ul');
            ul.style.listStyleType = 'none';
            ul.style.paddingLeft = '0';
            users.forEach(user => {
              const li = document.createElement('li');
              li.style.marginBottom = '10px';
              li.style.padding = '10px';
              li.style.border = '1px solid #eee';
              li.style.borderRadius = '4px';
              // Adjust to Auth0 user object structure
              const userId = user.user_id || user.id || user.sub;
              const firstName = user.given_name || user.name || '';
              const lastName = user.family_name || '';
              const email = user.email || '';

              li.innerHTML = `
                <strong>${firstName} ${lastName}</strong> (${email})<br>
                Auth0 ID: ${userId}
                <button data-userid="${userId}" data-firstname="${firstName}" data-lastname="${lastName}" data-email="${email}" class="edit-user-btn button" style="font-size:0.8em; padding: 3px 6px; margin-left:10px; margin-top:5px;">Edit</button>
                <button data-userid="${userId}" class="delete-user-btn button" style="font-size:0.8em; padding: 3px 6px; background-color:var(--error-color); margin-top:5px;">Delete</button>
              `;
              ul.appendChild(li);
            });
            userListContainer.appendChild(ul);

            document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', handleEditUser));
            document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', handleDeleteUser));
          }
          listMessage.textContent = '';
        } else {
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.'}));
          listMessage.textContent = `Error loading users: ${error.error || error.message ||'Failed to load users.'}`;
          listMessage.className = 'message error';
        }
      } catch (err) {
        console.error("Load users network error:", err);
        listMessage.textContent = `Network error: ${err.message}`;
        listMessage.className = 'message error';
      }
    }

    if (loadUsersButton) {
      loadUsersButton.addEventListener('click', loadUsers);
    }

    function handleEditUser(event) {
        const btn = event.target.closest('.edit-user-btn');
        if (!btn) return;
        editUserIdInput.value = btn.dataset.userid; // Auth0 User ID (sub)
        editFirstNameInput.value = btn.dataset.firstname;
        editLastNameInput.value = btn.dataset.lastname;
        editEmailInput.value = btn.dataset.email;
        editMessage.textContent = '';
        editMessage.className = 'message';
        if (editModal) editModal.style.display = 'block';
    }

    if (saveEditButton) {
        saveEditButton.addEventListener('click', async () => {
            const userIdToUpdate = editUserIdInput.value; // Auth0 User ID (sub)
            const updates = { // Payload for Auth0 Management API (PATCH users)
                given_name: editFirstNameInput.value,
                family_name: editLastNameInput.value
                // email: editEmailInput.value, // Email updates are sensitive and might require specific handling/permissions
            };
            editMessage.textContent = 'Saving...';
            editMessage.className = 'message';

            try {
                const response = await fetch('/api/auth0-user-management', {
                    method: 'PUT', // Should be PATCH for Auth0 user updates
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'updateUser', userId: userIdToUpdate, updates })
                });
                if (response.ok) {
                    editMessage.textContent = 'User updated successfully!';
                    editMessage.className = 'message success';
                    if (editModal) editModal.style.display = 'none';
                    loadUsers();
                } else {
                    const error = await response.json().catch(() => ({ error: 'Failed to parse error response.'}));
                    editMessage.textContent = `Error: ${error.error || error.message || 'Failed to update.'}`;
                    editMessage.className = 'message error';
                }
            } catch (err) {
                console.error("Update user network error:", err);
                editMessage.textContent = `Network error: ${err.message}`;
                editMessage.className = 'message error';
            }
        });
    }

    async function handleDeleteUser(event) {
      const btn = event.target.closest('.delete-user-btn');
      if (!btn) return;
      const userIdToDelete = btn.dataset.userid; // Auth0 User ID (sub)
      if (confirm(`Are you sure you want to delete user with ID: ${userIdToDelete}? This is irreversible.`)) {
        listMessage.textContent = 'Deleting user...';
        listMessage.className = 'message';
        try {
          const response = await fetch('/api/auth0-user-management', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteUser', userId: userIdToDelete })
          });
          if (response.ok) { // Auth0 DELETE user returns 204 No Content
            listMessage.textContent = 'User deleted successfully.';
            listMessage.className = 'message success';
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.'}));
            listMessage.textContent = `Error deleting user: ${error.error || error.message || 'Failed to delete.'}`;
            listMessage.className = 'message error';
          }
        } catch (err) {
          console.error("Delete user network error:", err);
          listMessage.textContent = `Network error: ${err.message}`;
          listMessage.className = 'message error';
        }
      }
    }
    // loadUsers(); // Optionally load users on page load
  }
  checkAuth(); // Call checkAuth after all event listeners are set up
});