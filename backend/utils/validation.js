// backend/utils/validation.js
const Joi = require('joi');

// User validation schemas
const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.ref('password')
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
    confirmPassword: Joi.ref('newPassword')
  })
};

// Password entry validation schemas
const passwordSchemas = {
  create: Joi.object({
    accountName: Joi.string().required(),
    username: Joi.string().allow(''),
    password: Joi.string().required(),
    url: Joi.string().uri().allow(''),
    notes: Joi.string().allow(''),
    category: Joi.string().allow('')
  }),
  
  update: Joi.object({
    accountName: Joi.string(),
    username: Joi.string().allow(''),
    password: Joi.string(),
    url: Joi.string().uri().allow(''),
    notes: Joi.string().allow(''),
    category: Joi.string().allow('')
  })
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message 
      });
    }
    
    next();
  };
};

module.exports = {
  validate,
  userSchemas,
  passwordSchemas
};