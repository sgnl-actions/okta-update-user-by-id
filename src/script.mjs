/**
 * Okta Update User By ID Action
 *
 * Updates an existing user's profile in Okta using their Okta userId as identifier.
 * Supports optional firstName, lastName, email, department, employeeNumber, and additionalProfileAttributes.
 */

import { getBaseURL, createAuthHeaders} from '@sgnl-actions/utils';

/**
 * Helper function to update a user in Okta by userId
 * @private
 */
async function updateUser(params, baseUrl, headers) {
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
  const url = `${baseUrl}/api/v1/users/${userId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  return response;
}

export default {
  /**
   * Main execution handler - updates an existing user in Okta by userId
   * @param {Object} params - Job input parameters
   * @param {string} params.userId - User's Okta userId identifier to update
   * @param {string} params.login - User's login (optional)
   * @param {string} params.firstName - User's first name (optional)
   * @param {string} params.lastName - User's last name (optional)
   * @param {string} params.email - User's email address (optional)
   * @param {string} params.department - User's department (optional)
   * @param {string} params.employeeNumber - Employee number (optional)
   * @param {string} params.additionalProfileAttributes - JSON string of additional attributes (optional)
   * @param {string} params.address - Full URL to Okta API (defaults to ADDRESS environment variable)
   *
   * @param {Object} context - Execution context with secrets and environment
   * @param {string} context.environment.ADDRESS - Default Okta API base URL
   *
   * The configured auth type will determine which of the following environment variables and secrets are available
   * @param {string} context.secrets.BEARER_AUTH_TOKEN
   *
   * @param {string} context.secrets.BASIC_USERNAME
   * @param {string} context.secrets.BASIC_PASSWORD
   *
   * @param {string} context.secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_SCOPE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL
   *
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN
   *
   * @returns {Object} Job results with updated user information
   */
  invoke: async (params, context) => {

    const { userId } = params;

    console.log(`Starting Okta user update for userId: ${userId}`);

    // Get base URL using utility function
    const baseUrl = getBaseURL(params, context);

    // Get headers using utility function
    let headers = await createAuthHeaders(context);

    // Handle Okta's SSWS token format - only for Bearer token auth mode
    if (context.secrets.BEARER_AUTH_TOKEN && headers['Authorization'].startsWith('Bearer ')) {
      const token = headers['Authorization'].substring(7);
      headers['Authorization'] = token.startsWith('SSWS ') ? token : `SSWS ${token}`;
    }

    // Make the API request to update user
    const response = await updateUser(
      params,
      baseUrl,
      headers
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