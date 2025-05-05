import {
  appStateProvider,
  AuthClient,
  authState,
  appState,
  buttonState,
} from "./providers";
import { reportsService, reportFilesService } from "./services";
import { isRouteLink, showContent, showContentFromUrl } from "./utils";

const { BASE_URL } = import.meta.env;

// Initialize global auth client
var auth0 = undefined;
var apiUrl = "/api";

// Initialize Bootstrap modals
let usersModal;
let rolesModal;

document.addEventListener("DOMContentLoaded", () => {
  usersModal = new bootstrap.Modal(document.getElementById("usersModal"));
  rolesModal = new bootstrap.Modal(document.getElementById("rolesModal"));
});

/**
 * Calls the API endpoint with an authorization token
 *
 * @param {Object} options
 * @param {AuthClient} options.auth0
 * @param {string} options.url
 * @param {string} options.btnId
 * @returns {Promise}
 */
export const callApi = async ({ auth0, url, btnId }) => {
  try {
    if (btnId) {
      buttonState({ id: btnId });
    }

    // Clear the response block
    const responseElement = document.getElementById("api-call-result");

    if (responseElement) {
      responseElement.innerText = "{}";
    }
    // ===

    history.pushState("", null, window.location.pathname);

    const accessToken = ["scoped-api-btn", "private-api-btn"].includes(btnId)
      ? await auth0.refreshTokens(true)
      : await auth0.getAccessToken();

    const fetchOptions = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const response = await fetch(url, fetchOptions);

    const { status, statusText, ...resp } = response.clone();

    const result = {
      status,
      statusText,
      ...(await response.json()),
    };

    return (appStateProvider.apiData = result);
  } catch (error) {
    console.error(error);
    alert(
      "Unable to access API or API is not configured correctly. See console for details."
    );
  } finally {
    if (btnId) {
      buttonState({ id: btnId, isLoading: false });
    }
  }
};

export const onPopState = ({ state }) => {
  if (state?.url && router[state.url]) {
    showContentFromUrl(state.url);
  }
};

// URL mapping, from hash to a function that responds to that URL action
export const router = {
  "/": () => {
    showContent("content-home");
    if (authState.isAuthenticated) {
      document.getElementById("user-approles").innerText = value?.approles?.join(", ") || "No roles assigned";
    }
  },
  "/profile": () =>
    auth0?.requireAuth(() => showContent("content-profile"), "/profile"),
  "/login": () => login(),
  "/apps": () => {
    auth0?.allowRole(
      () => {
        showContent("content-apps");
        loadApps();
      },
      "Application Owners",
      "/apps"
    );
  },
  '/permissions': () => {
    showContent('content-permissions');
    // Get appId from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    // const appId = urlParams.get('appId');
    const appName = urlParams.get('appName');
    if (appName) {
      document.getElementById('permissions-title').textContent = `Permission Management for ${appName}`;
    }
    loadPermissions();
  },
  "/reports": () => {
    auth0?.allowRole(
      () => {
        showContent("content-reports");
        reportsService.loadApplicationNames();
      },
      "ReportUser",
      "/reports"
    );
  },
  '/organizations': () => {
    showContent('content-organizations');
    loadOrganizations();
  },
  '/actions': () => {
    auth0?.allowRole(
      () => {
        showContent('content-actions');
        loadActions();
      },
      'Java Developers',
      '/actions'
    );
  },
  '/users': () => {
    auth0?.allowRole(
      () => {
        showContent("content-users");
        loadUsers();
        loadGroups(); // Load groups for the dropdown
        loadUserOptions();
      },
      "Application Owners",
      "/users"
    );
  },
};

/** Applicaitons Page */
async function viewAppUsers(appId) {
  try {
    const response = await fetch(`/api/apps/${appId}/users`);
    const users = await response.json();

    const modalBody = document.getElementById("users-modal-body");
    modalBody.innerHTML = "";

    users.forEach((user) => {
      const row = modalBody.insertRow();
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.credentials?.userName || user.profile?.login}</td>
        <td>${user.status}</td>
      `;
    });

    usersModal.show();
  } catch (error) {
    console.error("Error loading app users:", error);
    alert("Failed to load application users");
  }
}

async function viewAppRoles(appId) {
  try {
    const response = await fetch(`/api/apps/${appId}/roles`);
    const roles = await response.json();
    console.log("ROLES: ", roles);

    const modalBody = document.getElementById("roles-modal-body");
    modalBody.innerHTML = "";

    roles.forEach((role) => {
      const row = modalBody.insertRow();
      row.innerHTML = `
        <td>${role}</td>
      `;
    });

    rolesModal.show();
  } catch (error) {
    console.error("Error loading app roles:", error);
    alert("Failed to load application roles");
  }
}

async function loadApps() {
  try {
    const response = await fetch("/api/apps");
    const data = await response.json();

    const tableBody = document.getElementById("apps-table-body");
    tableBody.innerHTML = ""; // Clear existing table content

    data.forEach((app) => {
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${app.label}</td>
        <td>${app.status}</td>
        <td>
          <button onclick="window.viewAppUsers('${app.id}')" class="btn btn-sm btn-info me-2">
            View Users
          </button>
          <button onclick="window.viewAppRoles('${app.id}')" class="btn btn-sm btn-primary">
            View Roles
          </button>
          <a href="/permissions?appName=${app.label}" class="btn btn-sm btn-primary">
            Manage Permissions
          </a>
                 
            <button onclick="window.deactivateApp('${app.id}')" class="btn btn-sm btn-warning me-2">
              Deactivate
            </button>
            <button onclick="window.deleteApp('${app.id}')" class="btn btn-sm btn-danger">
              Delete
            </button>
          
        </td>
      `;
    });
  } catch (error) {
    console.error("Error loading apps:", error);
  }
}

// Add new functions for app management
async function deactivateApp(appId) {
  if (!confirm('Are you sure you want to deactivate this application?')) {
    return;
  }

  try {
    const response = await fetch(`/api/app/${appId}/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to deactivate application');
    }

    // Reload the apps table to show updated status
    await loadApps();
    alert('Application deactivated successfully');
  } catch (error) {
    console.error('Error deactivating application:', error);
    alert('Failed to deactivate application. Please try again.');
  }
}

async function deleteApp(appId) {
  if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`/api/app/${appId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete application');
    }

    // Reload the apps table
    await loadApps();
    alert('Application deleted successfully');
  } catch (error) {
    console.error('Error deleting application:', error);
    alert('Failed to delete application. Please try again.');
  }
}


// Make functions available globally for onclick handlers
window.viewAppUsers = viewAppUsers;
window.viewAppRoles = viewAppRoles;
window.deactivateApp = deactivateApp;
window.deleteApp = deleteApp;
window.deletePermission = deletePermission;
// window.manageAppPermssions = manageAppPermssions;

async function loadOrganizations() {
  try {
    const response = await fetch('/api/permissions');
    const data = await response.json();

    // Process tuples to get permission-role mappings
    const orgMap = new Map();

    data.tuples.forEach(tuple => {
      const { key } = tuple;

      // Only process member relations for organizations
      if (key.relation === 'member' && key.object.startsWith('org:')) {
        const orgId = key.object.replace('org:', '');
        const roleId = key.user.replace('role:', '');

        if (!orgMap.has(orgId)) {
          orgMap.set(orgId, new Set());
        }
        orgMap.get(orgId).add(roleId);
      }
    });

    const tableBody = document.getElementById('organizations-table-body');
    tableBody.innerHTML = ''; // Clear existing table content

    // Convert the map to array and sort by organization ID
    Array.from(orgMap.entries())
      .sort(([orgA], [orgB]) => orgA.localeCompare(orgB))
      .forEach(([orgId, roles]) => {
        const row = tableBody.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);

        cell1.textContent = orgId;
        cell2.textContent = Array.from(roles).sort().join(', ');
      });
  } catch (error) {
    console.error('Error loading organizations:', error);
  }
}

async function loadPermissions() {
  try {
    const response = await fetch("/api/permissions");
    const data = await response.json();

    // Process tuples to get permission-role mappings
    const permissionMap = new Map();

    data.tuples.forEach((tuple) => {
      const { key } = tuple;

      // Only process parent relations for permissions
      if (key.relation === 'parent' && key.object.startsWith('permission:')) {
        const permissionId = key.object.replace('permission:', '');
        const roleId = key.user.replace('role:', '');

        if (!permissionMap.has(permissionId)) {
          permissionMap.set(permissionId, new Set());
        }
        permissionMap.get(permissionId).add(roleId);
      }
    });

    const tableBody = document.getElementById("permissions-table-body");
    tableBody.innerHTML = ""; // Clear existing table content

    // Convert the map to array and sort by permission ID
    Array.from(permissionMap.entries())
      .sort(([permA], [permB]) => permA.localeCompare(permB))
      .forEach(([permissionId, roles]) => {
        const row = tableBody.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);

        cell1.textContent = permissionId;
        cell2.textContent = Array.from(roles).sort().join(", ");
        cell3.innerHTML = `
          <button onclick="deletePermission('${permissionId}', '${Array.from(roles)[0]}')" class="btn btn-danger btn-sm">
            Delete
          </button>
        `;
      });
  } catch (error) {
    console.error("Failed to load permissions:", error);
  }
}

// DeletePermission function
async function deletePermission(permissionId, deleteRoleId) {
  if (!confirm('Are you sure you want to delete this permission? This will remove all role assignments.')) {
    return;
  }

  try {
    const response = await fetch('/api/tuple', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deletes: {
          tuple_keys: [{
            user: 'role:deleteRoleId',
            relation: 'parent',
            object: `permission:${permissionId}`
          }]
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to delete permission');
    }

    // Reload the permissions table
    await loadPermissions();
    alert('Permission deleted successfully');
  } catch (error) {
    console.error('Error deleting permission:', error);
    alert('Failed to delete permission. Please try again.');
  }
}

async function loadActions() {
  try {
    const response = await fetch('/api/permissions');
    const data = await response.json();

    // Process tuples to get action-role mappings
    const actionMap = new Map();

    data.tuples.forEach(tuple => {
      const { key } = tuple;

      // Only process parent relations for actions
      if (key.relation === 'parent' && key.object.startsWith('action:')) {
        const actionId = key.object.replace('action:', '');
        const roleId = key.user.replace('role:', '');

        if (!actionMap.has(actionId)) {
          actionMap.set(actionId, new Set());
        }
        actionMap.get(actionId).add(roleId);
      }
    });

    const tableBody = document.getElementById('actions-table-body');
    tableBody.innerHTML = ''; // Clear existing table content

    // Convert the map to array and sort by action ID
    Array.from(actionMap.entries())
      .sort(([actionA], [actionB]) => actionA.localeCompare(actionB))
      .forEach(([actionId, roles]) => {
        const row = tableBody.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);

        cell1.textContent = actionId;
        cell2.textContent = Array.from(roles).sort().join(', ');
      });
  } catch (error) {
    console.error('Error loading actions:', error);
  }
}

async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    const users = await response.json();

    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = ''; // Clear existing table content

    users.forEach(user => {
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${user.profile.firstName || ''}</td>
        <td>${user.profile.lastName || ''}</td>
        <td>${user.profile.login || ''}</td>
        <td>${user.profile.groups?.join(', ') || ''}</td>
      `;
    });
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

async function loadGroups() {
  try {
    const response = await fetch('/api/groups');
    const groups = await response.json();

    const groupSelect = document.getElementById('groupId');
    groupSelect.innerHTML = '<option value="">--Select a Role--</option>';

    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.profile.name;
      groupSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

// Add this function after loadGroups()
async function loadUserOptions() {
  try {
    const response = await fetch('/api/users');
    const users = await response.json();

    const userSelect = document.getElementById('userId');
    userSelect.innerHTML = '<option value="">--Select a User--</option>';

    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.profile.login;
      userSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Add add-app form submission handler
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('createAppForm');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const appName = document.getElementById('appName').value;

      try {
        const response = await fetch('/api/apps', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ appName })
        });

        if (!response.ok) {
          throw new Error('Failed to create application');
        }

        // Clear the form
        form.reset();

        // Reload the applications table
        await loadApps();

        alert('Application created successfully!');
      } catch (error) {
        console.error('Error creating application:', error);
        alert('Failed to create application. Please try again.');
      }
    });
  }
});

// Add event listener for the permission assignment form
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("assignPermissionForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const permissionId = document.getElementById("permissionId").value;
      const roleId = document.getElementById("roleId").value;

      try {
        const response = await fetch("/api/permissions/assign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ permissionId, roleId }),
        });

        if (!response.ok) {
          throw new Error("Failed to assign permission");
        }

        // Clear the form
        form.reset();

        // Reload the permissions table
        await loadPermissions();

        alert("Permission assigned successfully!");
      } catch (error) {
        console.error("Error assigning permission:", error);
        alert("Failed to assign permission. Please try again.");
      }
    });
  }
});

// Add form submission handler for organization members
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addMemberForm');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const orgId = document.getElementById('orgId').value;
      const orgRoleId = document.getElementById('orgRoleId').value;
      try {
        const response = await fetch('/api/organizations/members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orgId, orgRoleId })
        });

        if (!response.ok) {
          throw new Error('Failed to add member');
        }

        // Clear the form
        form.reset();

        // Reload the organizations table
        await loadOrganizations();

        alert('Member added successfully!');
      } catch (error) {
        console.error('Error adding member:', error);
        alert('Failed to add member. Please try again.');
      }
    });
  }
});

// Add event listener for action assignment form
document.addEventListener('DOMContentLoaded', () => {
  const actionForm = document.getElementById('assignActionForm');
  if (actionForm) {
    actionForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const actionId = document.getElementById('actionId').value;
      const roleId = document.getElementById('actionRoleId').value;

      try {
        const response = await fetch('/api/action/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ actionId: actionId, roleId })
        });

        if (!response.ok) {
          throw new Error('Failed to assign action');
        }

        // Clear the form
        actionForm.reset();

        // Reload the actions table
        await loadActions();

        alert('Action assigned successfully!');
      } catch (error) {
        console.error('Error assigning action:', error);
        alert('Failed to assign action. Please try again.');
      }
    });
  }
});

// Add event listener for the group assignment form
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('assignGroupForm');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const userId = document.getElementById('userId').value;
      const groupId = document.getElementById('groupId').value;
      const groupLabel = document.getElementById('groupId').options[document.getElementById('groupId').selectedIndex].text;

      try {
        // Assign user to group in Okta
        const oktaResponse = await fetch('/api/users/assign-group', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, groupId })
        });

        if (!oktaResponse.ok) {
          throw new Error('Failed to assign group in Okta');
        }

        // Create relation in FGA
        const fgaResponse = await fetch('/api/user/assign/role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userOktaId: `${userId}`,
            roleId: groupLabel
          })
        });

        if (!fgaResponse.ok) {
          throw new Error('Failed to create relation in FGA');
        }

        // Clear the form
        form.reset();

        // Reload the users table
        await loadUsers();

        alert('User assigned to group successfully!');
      } catch (error) {
        console.error('Error assigning user to group:', error);
        alert('Failed to assign user to group. Please try again.');
      }
    });
  }
});

/**
 * Reports page
 */
document.addEventListener("DOMContentLoaded", () => {
  // forms
  const userRoleForm = document.getElementById("roleReportForm");
  const appAccessReportForm = document.getElementById("appAccessReportForm");
  const appRoleReportForm = document.getElementById("appRoleReportForm");

  if (userRoleForm) {
    userRoleForm.addEventListener(
      "submit",
      reportsService.loadUserReportByRole
    );
  }
  if (appAccessReportForm) {
    appAccessReportForm.addEventListener(
      "submit",
      reportsService.loadAppAccessReport
    );
  }
  if (appRoleReportForm) {
    appRoleReportForm.addEventListener(
      "submit",
      reportsService.loadAppRoleAccess
    );
  }

  // downloads
  const downloadUserRoleData = document.getElementById(
    "download-user-roles-data"
  );
  const downloadAppAccessData = document.getElementById(
    "download-app-access-data"
  );
  const downloadAppRoleData = document.getElementById("download-app-role-data");

  if (downloadUserRoleData) {
    downloadUserRoleData.addEventListener(
      "click",
      reportFilesService.writeUserRolePermissionsReport
    );
  }
  if (downloadAppAccessData) {
    downloadAppAccessData.addEventListener(
      "click",
      reportFilesService.writeAppAccessReport
    );
  }
  if (downloadAppRoleData) {
    downloadAppRoleData.addEventListener(
      "click",
      reportFilesService.writeAppRoleReport
    );
  }
});

/**
 * Runs as the default function when the page is initially loaded.
 */
export default async () => {
  window.onpopstate = onPopState;

  auth0 = new AuthClient();

  if (BASE_URL && !BASE_URL.startsWith("/")) {
    apiUrl = new URL(apiUrl, BASE_URL).toString();
  }

  // Add event listeners to buttons
  const loginButton = document.querySelector("#qsLoginBtn");
  const refreshTokensButton = document.querySelector("#qsRefreshTokens");
  const logoutButton = document.querySelector("#qsLogoutBtn");
  const scopedAPIButton = document.querySelector("#scoped-api-btn");

  loginButton.addEventListener("click", () => auth0.login());

  refreshTokensButton.addEventListener("click", () => auth0.refreshTokens());

  logoutButton.addEventListener("click", () => auth0.signout());

  scopedAPIButton.addEventListener("click", () =>
    callApi({
      auth0,
      url: window.location.origin + apiUrl + "/scoped",
      btnId: "scoped-api-btn",
    })
  );

  // If unable to parse the history hash, default to the root URL
  if (!showContentFromUrl(window.location.pathname)) {
    showContentFromUrl("/");
    window.history.replaceState({ url: "/" }, {}, "/");
  }

  const bodyElement = document.getElementsByTagName("body")[0];

  // Listen out for clicks on any hyperlink that navigates to a #/ URL
  bodyElement.addEventListener("click", (e) => {
    if (isRouteLink(e.target)) {
      const url = e.target.getAttribute("href");

      if (showContentFromUrl(url)) {
        e.preventDefault();
        window.history.pushState({ url }, {}, url);
      }
    }
  });

  if (auth0) {
    await auth0.handleAuth();
  }

  return (appStateProvider.isLoading = false);
};