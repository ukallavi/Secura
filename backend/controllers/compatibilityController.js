const crypto = require('crypto');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { db } = require('../../database/db');
const { logger, logSecurityEvent } = require('../utils/logger');

/**
 * Generates a deterministic password using the old system's algorithm
 * Precisely matching the original C# implementation
 */
const generateLegacyPassword = (alias, secret, overrideSettings, defaultOverrides, specialOverrides = []) => {
  // Get alias and custom overrides
  const [modifiedAlias, finalOverrides] = getAliasAndCustomOverrides(
    { Alias: alias, Secret: secret, OverrideSettings: overrideSettings },
    defaultOverrides,
    specialOverrides,
    alias
  );

  // Create SHA1 hash and convert to Base64 (matching original implementation)
  const hash = crypto.createHash('sha1').update(secret + modifiedAlias).digest();
  let result = Buffer.from(hash).toString('base64');
  
  // Truncate to 16 characters (matching original implementation)
  result = result.substring(0, 16);
  
  // Apply overrides in the same order as the original
  if (finalOverrides.RemoveSpecialCharacters) {
    result = removeSpecialCharacters(result);
  }
  
  if (finalOverrides.PrefixHash) {
    result = '#' + result;
  }
  
  if (finalOverrides.MaxLength > 0 && finalOverrides.MaxLength < result.length) {
    result = result.substring(0, finalOverrides.MaxLength);
  }
  
  return result;
};

/**
 * Helper function to get alias and custom overrides
 * Matches the original C# implementation
 */
const getAliasAndCustomOverrides = (model, defaultOverrides, specialOverrides, originalAlias) => {
  let alias = model.Alias || '';
  let overrides = { ...defaultOverrides };
  
  // Apply special overrides if the alias matches
  for (const special of specialOverrides) {
    if (special.AliasPattern && alias.match(new RegExp(special.AliasPattern, 'i'))) {
      overrides = { ...overrides, ...special.Overrides };
      break;
    }
  }
  
  // Apply user's custom overrides
  if (model.OverrideSettings) {
    overrides = { ...overrides, ...model.OverrideSettings };
  }
  
  // Apply alias transformations
  if (overrides.RemoveDomainFromAlias) {
    const atIndex = alias.indexOf('@');
    if (atIndex > 0) {
      alias = alias.substring(0, atIndex);
    }
  }
  
  if (overrides.LowercaseAlias) {
    alias = alias.toLowerCase();
  }
  
  return [alias, overrides];
};

/**
 * Check if two override settings match
 * Matches the original C# implementation
 */
const overrideSettingsMatch = (lhs, rhs) => {
  if (!lhs && !rhs) return true;
  if (!lhs || !rhs) return false;
  
  return (
    lhs.RemoveSpecialCharacters === rhs.RemoveSpecialCharacters &&
    lhs.PrefixHash === rhs.PrefixHash &&
    lhs.MaxLength === rhs.MaxLength &&
    lhs.RemoveDomainFromAlias === rhs.RemoveDomainFromAlias &&
    lhs.LowercaseAlias === rhs.LowercaseAlias
  );
};

/**
 * Remove special characters from a string
 * Matches the original C# implementation
 */
const removeSpecialCharacters = (str) => {
  const specialChars = /[^a-zA-Z0-9]/g;
  let result = str.replace(specialChars, '');
  
  // If after removal the string is empty or too short, use original with fallback
  if (!result || result.length < 8) {
    result = str.replace(/[^a-zA-Z0-9]/g, 'X');
  }
  
  return result;
};

/**
 * Generate a password using the legacy algorithm
 * API endpoint handler
 */
const generatePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { alias, secret, overrideSettings } = req.body;
    const userId = req.user.id;
    
    // Load default overrides from database
    const defaultOverrides = await db('system_settings')
      .where({ setting_key: 'default_password_overrides' })
      .first();
    
    const defaultOverrideSettings = defaultOverrides 
      ? JSON.parse(defaultOverrides.setting_value) 
      : {
          RemoveSpecialCharacters: false,
          PrefixHash: false,
          MaxLength: 0,
          RemoveDomainFromAlias: true,
          LowercaseAlias: true
        };
    
    // Load special overrides from database
    const specialOverridesRecord = await db('system_settings')
      .where({ setting_key: 'special_password_overrides' })
      .first();
    
    const specialOverrides = specialOverridesRecord 
      ? JSON.parse(specialOverridesRecord.setting_value) 
      : [];
    
    // Generate password
    const password = generateLegacyPassword(
      alias,
      secret,
      overrideSettings,
      defaultOverrideSettings,
      specialOverrides
    );
    
    // Log the password generation (not the password itself)
    await logSecurityEvent(
      userId,
      'LEGACY_PASSWORD_GENERATED',
      { alias },
      req
    );
    
    return res.json({ password });
  } catch (error) {
    logger.error('Error generating password:', error);
    return res.status(500).json({ error: 'Failed to generate password' });
  }
};

/**
 * Save an override setting
 */
const saveOverrideSetting = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { alias, overrideSettings } = req.body;
    const userId = req.user.id;
    
    if (!alias) {
      return res.status(400).json({ error: 'Alias is required' });
    }
    
    // Check if override already exists
    const existingOverride = await db('password_overrides')
      .where({ 
        user_id: userId,
        alias
      })
      .first();
    
    if (existingOverride) {
      // Update existing override
      await db('password_overrides')
        .where({ id: existingOverride.id })
        .update({
          override_settings: JSON.stringify(overrideSettings),
          updated_at: new Date()
        });
    } else {
      // Create new override
      await db('password_overrides').insert({
        user_id: userId,
        alias,
        override_settings: JSON.stringify(overrideSettings),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    // Log the override setting
    await logSecurityEvent(
      userId,
      'PASSWORD_OVERRIDE_SAVED',
      { alias },
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Override settings saved successfully' 
    });
  } catch (error) {
    logger.error('Error saving override setting:', error);
    return res.status(500).json({ error: 'Failed to save override setting' });
  }
};

/**
 * Get all override settings for a user
 */
const getOverrideSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all override settings for the user
    const overrides = await db('password_overrides')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
    
    // Format the response
    const formattedOverrides = overrides.map(override => ({
      id: override.id,
      alias: override.alias,
      overrideSettings: JSON.parse(override.override_settings),
      createdAt: override.created_at,
      updatedAt: override.updated_at
    }));
    
    return res.json(formattedOverrides);
  } catch (error) {
    logger.error('Error getting override settings:', error);
    return res.status(500).json({ error: 'Failed to get override settings' });
  }
};

/**
 * Delete an override setting
 */
const deleteOverrideSetting = async (req, res) => {
  try {
    const userId = req.user.id;
    const overrideId = req.params.id;
    
    // Check if override exists and belongs to the user
    const override = await db('password_overrides')
      .where({ 
        id: overrideId,
        user_id: userId
      })
      .first();
    
    if (!override) {
      return res.status(404).json({ error: 'Override setting not found' });
    }
    
    // Delete the override
    await db('password_overrides')
      .where({ id: overrideId })
      .delete();
    
    // Log the deletion
    await logSecurityEvent(
      userId,
      'PASSWORD_OVERRIDE_DELETED',
      { alias: override.alias },
      req
    );
    
    return res.json({ 
      success: true,
      message: 'Override setting deleted successfully' 
    });
  } catch (error) {
    logger.error('Error deleting override setting:', error);
    return res.status(500).json({ error: 'Failed to delete override setting' });
  }
};

/**
 * Get default and special override settings
 */
const getSystemOverrides = async (req, res) => {
  try {
    // Load default overrides from database
    const defaultOverrides = await db('system_settings')
      .where({ setting_key: 'default_password_overrides' })
      .first();
    
    const defaultOverrideSettings = defaultOverrides 
      ? JSON.parse(defaultOverrides.setting_value) 
      : {
          RemoveSpecialCharacters: false,
          PrefixHash: false,
          MaxLength: 0,
          RemoveDomainFromAlias: true,
          LowercaseAlias: true
        };
    
    // Load special overrides from database
    const specialOverridesRecord = await db('system_settings')
      .where({ setting_key: 'special_password_overrides' })
      .first();
    
    const specialOverrides = specialOverridesRecord 
      ? JSON.parse(specialOverridesRecord.setting_value) 
      : [];
    
    return res.json({
      defaultOverrides: defaultOverrideSettings,
      specialOverrides
    });
  } catch (error) {
    logger.error('Error getting system overrides:', error);
    return res.status(500).json({ error: 'Failed to get system overrides' });
  }
};

module.exports = {
  generatePassword,
  saveOverrideSetting,
  getOverrideSettings,
  deleteOverrideSetting,
  getSystemOverrides
};