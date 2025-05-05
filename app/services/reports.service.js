/** reports modals */
let userRolesReportModal;
let appAccessReportModal;
let appRoleReportModal;
let scheduleDeliveryForms;

document.addEventListener("DOMContentLoaded", () => {
  userRolesReportModal = new bootstrap.Modal(
    document.getElementById("userRolesReportModal")
  );
  appAccessReportModal = new bootstrap.Modal(
    document.getElementById("appAccessReportModal")
  );
  appRoleReportModal = new bootstrap.Modal(
    document.getElementById("appRoleReportModal")
  );

  scheduleDeliveryForms = document.getElementsByClassName(
    "schedule-delivery-form"
  );
  if (scheduleDeliveryForms) {
    Array.from(scheduleDeliveryForms).forEach((ele) => {
      ele.addEventListener("submit", (event) => {
        event.preventDefault();
        window.alert("Success! Report will be delivered on the selected date.");
      });
    });
  }
});

async function loadApplicationNames(params) {
  const response = await fetch("/api/apps");
  const data = await response.json();

  let appAccessSelect = document.getElementById("report_appName");
  let appRoleSelect = document.getElementById("report_roleAppId");

  data.forEach((app) => {
    let opt = document.createElement("option");
    opt.value = app.id;
    opt.innerHTML = app.label;

    let optClone = opt.cloneNode(true);

    appAccessSelect.appendChild(opt);
    appRoleSelect.appendChild(optClone);
  });
}

async function loadUserReportByRole(event) {
  event.preventDefault();

  const role = document.getElementById("report_roleName").value;

  try {
    const response = await fetch("/api/getUsersByRole", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      throw new Error("Failed to get users");
    }

    const data = await response.json();

    // Process tuples to get user table
    const userMap = new Map();

    data.tuples.forEach((tuple) => {
      const { key } = tuple;

      const userId = key.user.replace("user:", "");
      const roleId = key.object.replace("role:", "");

      if (!userMap.has(userId)) {
        userMap.set(userId, roleId);
      }
    });

    const tableBody = document.getElementById("user-roles-report-table-body");
    tableBody.innerHTML = ""; // Clear existing table content

    // Convert the map to array and sort by userId ID
    Array.from(userMap.entries())
      .sort(([permA], [permB]) => permA.localeCompare(permB))
      .forEach(([userId, role]) => {
        const row = tableBody.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);

        cell1.textContent = userId;
        cell2.textContent = role;
      });

    userRolesReportModal.show();
  } catch (error) {
    console.error("Error fetching users:", error);
    alert("Failed to fetch users. Please try again.");
  }
}

async function loadAppAccessReport(event) {
  event.preventDefault();

  const appId = document.getElementById("report_appName").value;

  try {
    const response = await fetch(`/api/apps/${appId}/users`);
    const users = await response.json();

    const modalBody = document.getElementById("app-access-report-table-body");
    modalBody.innerHTML = "";

    users.forEach((user) => {
      const row = modalBody.insertRow();
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.credentials?.userName || user.profile?.login}</td>
        <td>${user.status}</td>
      `;
    });

    appAccessReportModal.show();
  } catch (error) {
    console.error("Error fetching app access report:", error);
    alert("Failed to fetch data. Please try again.");
  }
}

async function loadAppRoleAccess(event) {
  event.preventDefault();

  const selectEle = document.getElementById("report_roleAppId");
  const appId = selectEle.value;
  const appName = selectEle.options[selectEle.selectedIndex].text;

  try {
    const response = await fetch(`/api/apps/${appId}/roles`);
    const roles = await response.json();

    const modalBody = document.getElementById("app-role-report-table-body");
    modalBody.innerHTML = "";

    roles.forEach((role) => {
      const row = modalBody.insertRow();
      row.innerHTML = `
        <td>${appName}</td>
        <td>${role}</td>
      `;
    });

    appRoleReportModal.show();
  } catch (error) {
    console.error("Error fetching app access report:", error);
    alert("Failed to fetch data. Please try again.");
  }
}

export const reportsService = {
  loadApplicationNames,
  loadUserReportByRole,
  loadAppAccessReport,
  loadAppRoleAccess,
};
