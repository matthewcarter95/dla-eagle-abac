import downloadCsv from "download-csv";

async function writeUserRolePermissionsReport() {
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

    let csvData = data.tuples.map((tuple) => {
      const { key } = tuple;

      return {
        userId: key.user.replace("user:", ""),
        role: key.object.replace("role:", ""),
      };
    });

    // prevent default text from rendering on empty csv
    if (csvData.length < 1) {
      csvData = [{ userId: "", role: "" }];
    }

    const columns = { userId: "User Id", role: "Role" };

    downloadCsv(csvData, columns);
  } catch (error) {
    console.error("Error fetching users:", error);
    alert("Failed to fetch users. Please try again.");
  }
}

async function writeAppAccessReport() {
  const appId = document.getElementById("report_appName").value;

  try {
    const response = await fetch(`/api/apps/${appId}/users`);
    const users = await response.json();

    let csvData = users.map((user) => {
      return {
        userId: user.id,
        username: user.credentials?.userName,
        status: user.status,
      };
    });

    // prevent default text from rendering on empty csv
    if (csvData.length < 1) {
      csvData = [{ userId: "", username: "", status: "" }];
    }

    const columns = {
      userId: "User Id",
      username: "Username",
      status: "Status",
    };

    downloadCsv(csvData, columns);
  } catch (error) {
    console.error("Error fetching users:", error);
    alert("Failed to fetch users. Please try again.");
  }
}

async function writeAppRoleReport() {
  const selectEle = document.getElementById("report_roleAppId");
  const appId = selectEle.value;
  const appName = selectEle.options[selectEle.selectedIndex].text;

  try {
    const response = await fetch(`/api/apps/${appId}/roles`);
    const roles = await response.json();

    let csvData = roles.map((role) => {
      return {
        appName: appName,
        role: role,
      };
    });

    // prevent default text from rendering on empty csv
    if (csvData.length < 1) {
      csvData = [{ appName: "", role: "" }];
    }

    const columns = {
      appName: "App Name",
      role: "Role",
    };

    downloadCsv(csvData, columns);
  } catch (error) {
    console.error("Error fetching users:", error);
    alert("Failed to fetch users. Please try again.");
  }
}

export const reportFilesService = {
  writeUserRolePermissionsReport,
  writeAppAccessReport,
  writeAppRoleReport,
};
