const bcrypt = require('bcrypt');
const { withTransaction } = require('../../database/db');
const User = require('../../database/models/User');
const { logger } = require('../utils/logger');

// Get all users
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get users with pagination
    const users = await User.findMany(
      {},
      { limit, offset, orderBy: 'created_at', order: 'desc' }
    );
    
    // Get total count
    const totalUsers = await User.count();
    
    return res.status(200).json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at
      })),
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      twoFactorEnabled: user.two_factor_enabled,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    logger.error(`Error fetching user ${req.params.id}:`, error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
};

// Create a new user
const createUser = async (req, res) => {
  try {
    const { email, firstName, lastName, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = await User.create({
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role: role || 'user',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      role: newUser.role,
      createdAt: newUser.created_at
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    return res.status(500).json({ message: 'Failed to create user' });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, role, password } = req.body;
    
    // Check if user exists
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    
    // Prepare update data
    const updateData = {
      email: email || user.email,
      first_name: firstName !== undefined ? firstName : user.first_name,
      last_name: lastName !== undefined ? lastName : user.last_name,
      role: role || user.role,
      updated_at: new Date()
    };
    
    // If password is being updated, hash it
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    // Update user
    await User.update(updateData, { id });
    
    // Get updated user
    const updatedUser = await User.findById(id);
    
    return res.status(200).json({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      role: updatedUser.role,
      updatedAt: updatedUser.updated_at
    });
  } catch (error) {
    logger.error(`Error updating user ${req.params.id}:`, error);
    return res.status(500).json({ message: 'Failed to update user' });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete user with transaction to ensure all related data is deleted
    await withTransaction(async (trx) => {
      // Delete user's related data
      // This assumes you have methods in your models to delete related data
      // You might need to add these methods or handle deletion differently
      
      // Finally delete the user
      await User.delete({ id }, trx);
    });
    
    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting user ${req.params.id}:`, error);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};