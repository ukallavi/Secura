/**
 * Tests for the PasswordItem component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PasswordItem from '../../components/PasswordItem';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

// Mock the API client
jest.mock('../../lib/api-client', () => ({
  deletePassword: jest.fn(() => Promise.resolve({ message: 'Password deleted successfully' })),
  updatePassword: jest.fn(() => Promise.resolve({ id: 1, message: 'Password updated successfully' }))
}));

describe('PasswordItem Component', () => {
  const mockPassword = {
    id: 1,
    title: 'Test Password',
    username: 'testuser',
    password: 'testpassword',
    url: 'https://example.com',
    notes: 'Test notes',
    folder_id: 1,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  };
  
  const mockFolders = [
    { id: 1, name: 'Work' },
    { id: 2, name: 'Personal' }
  ];
  
  const mockTags = [
    { id: 1, name: 'Important', color: '#ff0000' },
    { id: 2, name: 'Social', color: '#0000ff' }
  ];
  
  const mockPasswordTags = [
    { id: 1, tag_id: 1, password_id: 1 }
  ];
  
  const mockOnDelete = jest.fn();
  const mockOnUpdate = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders password item correctly', () => {
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Check that the password title is displayed
    expect(screen.getByText('Test Password')).toBeInTheDocument();
    
    // Check that the username is displayed
    expect(screen.getByText('testuser')).toBeInTheDocument();
    
    // Check that the password is masked
    const passwordField = screen.getByTestId('password-field');
    expect(passwordField).toHaveTextContent('••••••••••');
    
    // Check that the URL is displayed
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    
    // Check that the folder name is displayed
    expect(screen.getByText('Work')).toBeInTheDocument();
    
    // Check that the tag is displayed
    expect(screen.getByText('Important')).toBeInTheDocument();
  });
  
  test('toggles password visibility when show/hide button is clicked', () => {
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Password should be masked initially
    const passwordField = screen.getByTestId('password-field');
    expect(passwordField).not.toHaveTextContent('testpassword');
    
    // Click the show password button
    const showPasswordButton = screen.getByLabelText('Show password');
    fireEvent.click(showPasswordButton);
    
    // Password should now be visible
    expect(passwordField).toHaveTextContent('testpassword');
    
    // Click the hide password button
    const hidePasswordButton = screen.getByLabelText('Hide password');
    fireEvent.click(hidePasswordButton);
    
    // Password should be masked again
    expect(passwordField).not.toHaveTextContent('testpassword');
  });
  
  test('copies username to clipboard when copy button is clicked', async () => {
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Click the copy username button
    const copyUsernameButton = screen.getByLabelText('Copy username');
    fireEvent.click(copyUsernameButton);
    
    // Check that clipboard API was called with the correct value
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('testuser');
    });
  });
  
  test('copies password to clipboard when copy button is clicked', async () => {
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Click the copy password button
    const copyPasswordButton = screen.getByLabelText('Copy password');
    fireEvent.click(copyPasswordButton);
    
    // Check that clipboard API was called with the correct value
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('testpassword');
    });
  });
  
  test('opens edit mode when edit button is clicked', () => {
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Initially in view mode
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    
    // Click the edit button
    const editButton = screen.getByLabelText('Edit password');
    fireEvent.click(editButton);
    
    // Should now be in edit mode
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Folder')).toBeInTheDocument();
  });
  
  test('calls onDelete when delete button is clicked and confirmed', async () => {
    // Mock window.confirm to return true
    window.confirm = jest.fn(() => true);
    
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Click the delete button
    const deleteButton = screen.getByLabelText('Delete password');
    fireEvent.click(deleteButton);
    
    // Check that confirm was called
    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this password?'
    );
    
    // Check that onDelete was called with the correct ID
    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });
  });
  
  test('does not call onDelete when delete is cancelled', () => {
    // Mock window.confirm to return false
    window.confirm = jest.fn(() => false);
    
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Click the delete button
    const deleteButton = screen.getByLabelText('Delete password');
    fireEvent.click(deleteButton);
    
    // Check that confirm was called
    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this password?'
    );
    
    // Check that onDelete was not called
    expect(mockOnDelete).not.toHaveBeenCalled();
  });
  
  test('updates password when save button is clicked in edit mode', async () => {
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Enter edit mode
    const editButton = screen.getByLabelText('Edit password');
    fireEvent.click(editButton);
    
    // Update the title field
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Password Title' } });
    
    // Update the username field
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'updateduser' } });
    
    // Click the save button
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    // Check that onUpdate was called with the updated password
    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        title: 'Updated Password Title',
        username: 'updateduser'
      }));
    });
  });
  
  test('cancels edit mode when cancel button is clicked', () => {
    render(
      <PasswordItem
        password={mockPassword}
        folders={mockFolders}
        tags={mockTags}
        passwordTags={mockPasswordTags}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );
    
    // Enter edit mode
    const editButton = screen.getByLabelText('Edit password');
    fireEvent.click(editButton);
    
    // Update the title field
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Password Title' } });
    
    // Click the cancel button
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    // Should be back in view mode
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    
    // Original title should be displayed
    expect(screen.getByText('Test Password')).toBeInTheDocument();
    
    // onUpdate should not have been called
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
