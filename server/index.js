import * as dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import config from "../config.js";
import jwt from "jsonwebtoken";
import axios from "axios";

export const loadEnv = (options) => {
  if (existsSync(".env.local")) {
    dotenv.config({ path: `.env.local`, ...options });
  }

  dotenv.config(options);
};

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { auth, server } = config || {};

const {
  SERVER_AUDIENCE: audience = server?.audience ??
  auth?.audience ??
  auth?.authorizationParams?.audience ??
  "api://default",
  SERVER_AUTH_PERMISSIONS: AUTH_PERMISSIONS = server?.permissions || [
    "AuthRocks",
  ],
  OKTA_API_TOKEN,
  FGA_STORE_ID,
  FGA_CLIENT_ID,
  FGA_CLIENT_SECRET,
  FGA_API_URL,
  OPENFGA_STORE_ID,
  OPENFGA_CLIENT_ID,
  OPENFGA_CLIENT_SECRET,
  OPENFGA_API_URL,
  OPENFGA_API_TOKEN_ISSUER,
  OPENFGA_API_AUDIENCE,
  OPENFGA_MODEL,
  OKTA_ORG_URL,
} = process.env;

const permissions = Array.isArray(AUTH_PERMISSIONS)
  ? AUTH_PERMISSIONS
  : AUTH_PERMISSIONS.split(" ");

const app = express();

app.use(cors({ origin: "*" }));
app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "public")));
app.use(express.json());

// Simple token extraction middleware
const extractToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }
  req.token = authHeader.split(" ")[1];
  next();
};

// Simple permissions check middleware
const checkPermissions = (req, res, next) => {
  try {
    const decoded = jwt.decode(req.token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const userPermissions = decoded.permissions || [];
    const hasRequiredPermissions = permissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermissions) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token verification failed",
    });
  }
};

// Get all groups from Okta labeled with WI
app.get('/api/groups', async (req, res) => {
  try {
    const response = await axios.get(
      `${OKTA_ORG_URL}/api/v1/groups`,
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('List groups error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to list groups',
      error: error.response?.data || error.message
    });
  }
});

// Assign user to group
app.post('/api/users/assign-group', async (req, res) => {
  const { userId, groupId } = req.body;

  if (!userId || !groupId) {
    return res.status(400).json({
      success: false,
      message: 'User ID and Group ID are required'
    });
  }

  try {
    const response = await axios.put(
      `${OKTA_ORG_URL}/api/v1/groups/${groupId}/users/${userId}`,
      {},
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Assign user to group error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to assign user to group',
      error: error.response?.data || error.message
    });
  }
});
// Read role to organization relaions 
// app.get('/api/organizations/members', async (req, res) => {
//   try {
//     const token = await getBearerToken();
//     const response = await axios.post(
//       `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/read`,
//       {

//       },
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     // Process the response to group roles by organization
//     const orgMap = new Map();

//     response.data.tuples.forEach(tuple => {
//       const orgId = tuple.key.object.replace('org:', '');
//       const roleId = tuple.key.user.replace('role:', '');

//       if (!orgMap.has(orgId)) {
//         orgMap.set(orgId, new Set());
//       }
//       orgMap.get(orgId).add(roleId);
//     });

//     // Convert to array format
//     const result = Array.from(orgMap.entries()).map(([orgId, roles]) => ({
//       orgId,
//       roles: Array.from(roles)
//     }));

//     // res.json(result);
//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching organization members:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch organization members',
//       error: error.message
//     });
//   }
// });

app.post('/api/organizations/members', async (req, res) => {
  const { orgId, orgRoleId } = req.body;
  console.log(req.body);
  if (!orgId || !orgRoleId) {
    return res.status(400).json({
      success: false,
      message: 'Organization ID and Role ID are required'
    });
  }


  try {
    const token = await getBearerToken();
    await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/write`,
      {
        writes: {
          tuple_keys: [{
            user: `role:${orgRoleId}`,
            relation: "member",
            object: `org:${orgId}`
          }]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: 'Member added successfully'
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member',
      error: error.message
    });
  }
});

// Organizations API endpoints
// app.get('/api/organizations', async (req, res) => {
//   try {
//     const response = await axios.post(
//       'https://usps-spa.workflows.oktapreview.com/api/flo/b24cec17923d893a2ec2c65c52aa9672/invoke',
//       {} // Add empty body for POST request
//     );
//     console.log(response);
//     if (!response.data || !response.data.values) {
//       throw new Error('Invalid response format from organizations API');
//     }

//     res.json(response.data.values);
//   } catch (error) {
//     console.error('Organizations API error:', error.message);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch organizations',
//       error: error.message,
//     });
//   }
// });

// app.post('/api/organizations', async (req, res) => {
//   try {
//     const response = await axios.post(
//       'https://usps-spa.workflows.oktapreview.com/api/flo/d75dda1cddb48c5d84c6ad41f36058ca/invoke?clientToken=607dee9156f5a28931abd00cb23a397d5ff516c4bdc787e329df2b033c06f84f',
//       {}
//     );

//     if (!response.data) {
//       throw new Error('No data received from create organization API');
//     }

//     res.json(response.data);
//   } catch (error) {
//     console.error('Create organization error:', error.message);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to create organization',
//       error: error.message,
//     });
//   }
// });

// Okta Apps API endpoints
app.get("/api/apps", async (req, res) => {
  try {
    const response = await axios.get(`${OKTA_ORG_URL}/api/v1/apps?q=WI`, {
      headers: {
        Authorization: `SSWS ${OKTA_API_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Apps API error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications",
      error: error.message,
    });
  }
});

app.get("/api/apps/:appId/users", async (req, res) => {
  try {
    const response = await axios.get(
      `${OKTA_ORG_URL}/api/v1/apps/${req.params.appId}/users`,
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("App users API error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch application users",
      error: error.message,
    });
  }
});

app.get("/api/apps/:appId/roles", async (req, res) => {
  const userTuple = {
    user: `application:${req.params.appId}`,
    relation: "assignedTo",
    type: "role",
  };

  try {
    const fgaResponse = await listObjects(userTuple);
    console.log(fgaResponse.objects);
    res.json(fgaResponse.objects);
  } catch (error) {
    console.error("App roles API error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch application roles",
      error: error.message || "Unknown error occurred",
    });
  }
});

//Deactivate Application in Okta
app.post('/api/app/:appId/deactivate', async (req, res) => {
  if (!req.params.appId) {
    return res.status(400).json({
      success: false,
      message: 'Application ID is required'
    });
  }
  try {
    const response = await axios.post(
      `${OKTA_ORG_URL}/api/v1/apps/${req.params.appId}/lifecycle/deactivate`,
      {},
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Disable application error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to disable application',
      error: error.response?.data || error.message
    });
  }
});

//Delete Application in Okta
app.delete('/api/app/:appId', async (req, res) => {
  if (!req.params.appId) {
    return res.status(400).json({
      success: false,
      message: 'Application ID is required'
    });
  }


  try {
    const response = await axios.delete(
      `${OKTA_ORG_URL}/api/v1/apps/${req.params.appId}`,
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Delete application error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete application',
      error: error.response?.data || error.message
    });
  }
});

//List Users from Okta
app.get('/api/users', async (req, res) => {
  try {
    const response = await axios.get(
      `${OKTA_ORG_URL}/api/v1/users`,
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('List users error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to list users',
      error: error.response?.data || error.message
    });
  }
});

//List Groups assigned to user
app.get('/api/users/:userId/groups', async (req, res) => {
  try {
    const response = await axios.get(
      `${OKTA_ORG_URL}/api/v1/users/${req.params.userId}/groups`,
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('List groups error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to list groups',
      error: error.response?.data || error.message
    });
  }
});

// Create App in Okta
app.post('/api/apps', async (req, res) => {
  const { appName } = req.body;

  if (!appName) {
    return res.status(400).json({
      success: false,
      message: 'Application name is required'
    });
  }

  try {
    const response = await axios.post(
      `${OKTA_ORG_URL}/api/v1/apps`,
      {
        name: 'oidc_client',
        label: appName,
        signOnMode: 'OPENID_CONNECT',
        credentials: {
          oauthClient: {
            autoKeyRotation: true,
            token_endpoint_auth_method: 'client_secret_basic'
          }
        },
        settings: {
          oauthClient: {
            client_uri: 'http://localhost:3000',
            logo_uri: null,
            redirect_uris: [
              'http://localhost:3000/login/callback'
            ],
            post_logout_redirect_uris: [
              'http://localhost:3000'
            ],
            response_types: [
              'code'
            ],
            grant_types: [
              'authorization_code',
              'refresh_token'
            ],
            application_type: 'web',
            consent_method: 'REQUIRED',
            issuer_mode: 'ORG_URL'
          }
        }
      },
      {
        headers: {
          Authorization: `SSWS ${OKTA_API_TOKEN}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Create application error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create application',
      error: error.response?.data || error.message
    });
  }
});

app.delete('/api/tuple', async (req, res) => {
  try {
    const token = await getBearerToken();
    const response = await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/write`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
  }
});

// List All Permissions, actually returns all tuples, need to fix at some point 
app.get('/api/permissions', async (req, res) => {
  try {
    const token = await getBearerToken();
    const response = await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/read`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data) {
      throw new Error("No data received from OpenFGA API");
    }

    res.json(response.data);
  } catch (error) {
    console.error("Permissions API error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: error.message || "Unknown error occurred",
    });
  }
});

// List All Users By Role Type
app.post("/api/getUsersByRole", async (req, res) => {
  const { role } = req.body;
  try {
    const token = await getBearerToken();
    const response = await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/read`,
      {
        tuple_key: {
          object: `role:${role}`,
          relation: "containedIn",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data) {
      throw new Error("No data received from OpenFGA API");
    }

    res.json(response.data);
  } catch (error) {
    console.error("Permissions API error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
      error: error.message || "Unknown error occurred",
    });
  }
});

//Assign Action to Role
app.post("/api/action/assign", async (req, res) => {
  const { actionId, roleId } = req.body;
  console.log("Creating action:", actionId, roleId);
  if (!actionId || !roleId) {
    return res.status(400).json({
      success: false,
      message: "Action ID and Role ID are required",
    });
  }

  try {
    const token = await getBearerToken();
    await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/write`,
      {
        writes: {
          tuple_keys: [{
            user: `role:${roleId}`,
            relation: 'parent',
            object: `action:${actionId}`
          }]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      message: "Action assigned successfully",
    });
  } catch (error) {
    console.error("Action assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign action",
      error: error.message || "Unknown error occurred",
    });
  }
});


//Assign User to Role
app.post("/api/user/assign/role", async (req, res) => {
  const { userOktaId, roleId } = req.body;
  console.log("Creating relation:", userOktaId, roleId);
  if (!userOktaId || !roleId) {
    return res.status(400).json({
      success: false,
      message: "userOktaId and Role ID are required",
    });
  }

  try {
    const token = await getBearerToken();
    await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/write`,
      {
        writes: {
          tuple_keys: [{
            user: `user:${userOktaId}`,
            relation: 'containedIn',
            object: `role:${roleId}`
          }]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      message: "userOktaId assigned to role successfully",
    });
  } catch (error) {
    console.error("userOktaId assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign userOktaId to role",
      error: error.message || "Unknown error occurred",
    });
  }
});

//Assign Permission to Role
app.post("/api/permissions/assign", async (req, res) => {
  const { permissionId, roleId } = req.body;
  console.log("Creating permission:", permissionId, roleId);
  if (!permissionId || !roleId) {
    return res.status(400).json({
      success: false,
      message: "Permission ID and Role ID are required",
    });
  }

  try {
    const token = await getBearerToken();
    await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/write`,
      {
        writes: {
          tuple_keys: [{
            user: `role:${roleId}`,
            relation: 'parent',
            object: `permission:${permissionId}`
          }]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      message: "Permission assigned successfully",
    });
  } catch (error) {
    console.error("Permission assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign permission",
      error: error.message || "Unknown error occurred",
    });
  }
});

async function listObjects(userTuple) {
  try {
    const token = await getBearerToken();
    const response = await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/list-objects`,
      userTuple,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error listing objects:", error);
    throw error;
  }
}

async function readPermission(roleTuple) {
  try {
    const token = await getBearerToken();
    console.log(roleTuple);
    const response = await axios.post(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/read`,
      roleTuple,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error listing permissions:", error);
    throw error;
  }
}

async function getBearerToken() {
  try {
    const response = await axios.post('https://auth.fga.dev/oauth/token', {
      client_id: OPENFGA_CLIENT_ID,
      client_secret: OPENFGA_CLIENT_SECRET,
      grant_type: "client_credentials",
      audience: "https://api.us1.fga.dev/",
    });
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting bearer token:", error);
    throw error;
  }
}

export const handler = app;
