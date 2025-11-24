// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * Okta Update User By ID Action
 *
 * Updates an existing user's profile in Okta using their Okta userId as identifier.
 * Supports optional firstName, lastName, email, department, employeeNumber, and additionalProfileAttributes.
 */

/**
 * Helper function to update a user in Okta by userId
 * @private
 */
async function updateUser(params, oktaDomain, authToken) {
  const { userId, firstName, lastName, email, department, employeeNumber, additionalProfileAttributes } = params;

  // Build profile object with only fields that are provided
  const profile = {};

  // Add optional fields if provided and not empty
  if (firstName && firstName.trim()) {
    profile.firstName = firstName.trim();
  }
  if (lastName && lastName.trim()) {
    profile.lastName = lastName.trim();
  }
  if (email && email.trim()) {
    profile.email = email.trim();
  }
  if (department && department.trim()) {
    profile.department = department.trim();
  }
  if (employeeNumber && employeeNumber.trim()) {
    profile.employeeNumber = employeeNumber.trim();
  }

  // Parse and add additional profile attributes if provided
  if (additionalProfileAttributes && additionalProfileAttributes.trim()) {
    try {
      const additionalAttrs = JSON.parse(additionalProfileAttributes);
      Object.assign(profile, additionalAttrs);
    } catch (error) {
      throw new Error(`Invalid additionalProfileAttributes JSON: ${error.message}`);
    }
  }

  // If no profile updates were provided, throw an error
  if (Object.keys(profile).length === 0) {
    throw new Error('At least one profile field must be provided to update');
  }

  // Build request body
  const requestBody = {
    profile
  };

  // Use userId directly in URL (no encoding needed for userId unlike login/email)
  const url = new URL(`/api/v1/users/${userId}`, `https://${oktaDomain}`);
  const authHeader = authToken.startsWith('SSWS ') ? authToken : `SSWS ${authToken}`;

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  return response;
}


var script = {
  /**
   * Main execution handler - updates an existing user in Okta by userId
   * @param {Object} params - Job input parameters
   * @param {string} params.userId - User's Okta userId identifier to update
   * @param {string} params.firstName - User's first name (optional)
   * @param {string} params.lastName - User's last name (optional)
   * @param {string} params.email - User's new email address (optional)
   * @param {string} params.department - User's department (optional)
   * @param {string} params.employeeNumber - Employee number (optional)
   * @param {string} params.additionalProfileAttributes - JSON string of additional attributes (optional)
   * @param {string} params.oktaDomain - The Okta domain
   * @param {Object} context - Execution context with env, secrets, outputs
   * @param {string} context.secrets.BEARER_AUTH_TOKEN - Bearer token for Okta API authentication
   * @returns {Object} Job results with updated user information
   */
  invoke: async (params, context) => {
    const { userId, oktaDomain } = params;

    console.log(`Starting Okta user update for userId: ${userId}`);

    // Validate required inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing userId parameter');
    }
    if (!oktaDomain || typeof oktaDomain !== 'string') {
      throw new Error('Invalid or missing oktaDomain parameter');
    }

    // Validate Okta API token is present
    if (!context.secrets?.BEARER_AUTH_TOKEN) {
      throw new Error('Missing required secret: BEARER_AUTH_TOKEN');
    }

    // Make the API request to update user
    const response = await updateUser(
      params,
      oktaDomain,
      context.secrets.BEARER_AUTH_TOKEN
    );

    // Handle the response
    if (response.ok) {
      const userData = await response.json();
      console.log(`Successfully updated user ${userData.id} (userId: ${userId})`);

      return {
        id: userData.id,
        status: userData.status,
        created: userData.created,
        activated: userData.activated,
        statusChanged: userData.statusChanged,
        lastLogin: userData.lastLogin,
        lastUpdated: userData.lastUpdated,
        profile: userData.profile
      };
    }

    // Handle error responses
    const statusCode = response.status;
    let errorMessage = `Failed to update user: HTTP ${statusCode}`;

    try {
      const errorBody = await response.json();
      if (errorBody.errorSummary) {
        errorMessage = `Failed to update user: ${errorBody.errorSummary}`;
      }
      console.error('Okta API error response:', errorBody);
    } catch {
      // Response might not be JSON
      console.error('Failed to parse error response');
    }

    // Throw error with status code for proper error handling
    const error = new Error(errorMessage);
    error.statusCode = statusCode;
    throw error;
  },

  /**
   * Error recovery handler - framework handles retries by default
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error, userId } = params;
    console.error(`User update failed for userId ${userId}: ${error.message}`);

    // Framework handles retries for transient errors (429, 502, 503, 504)
    // Just re-throw the error to let the framework handle it
    throw error;
  },

  /**
   * Graceful shutdown handler - cleanup when job is halted
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   * @returns {Object} Cleanup results
   */
  halt: async (params, _context) => {
    const { reason, userId } = params;
    console.log(`User update job is being halted (${reason}) for userId: ${userId}`);

    // No cleanup needed for this simple operation
    // The POST request either completed or didn't

    return {
      userId: userId || 'unknown',
      reason: reason,
      haltedAt: new Date().toISOString(),
      cleanupCompleted: true
    };
  }
};

module.exports = script;
