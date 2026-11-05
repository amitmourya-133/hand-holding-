#!/usr/bin/env node
/**
 * update-account.js
 *
 * Interactive CLI utility to change the login email and password of an
 * existing Admin or Faculty (mentor with mentorType 'faculty') account.
 *
 * Usage:
 *   node scripts/update-account.js
 *
 * The script connects to the same MongoDB database configured via MONGODB_URI.
 * It NEVER creates new users, resets data, or modifies anything beyond the
 * target account's email and passwordHash fields.
 */

import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/db.js';
import { User } from '../src/models.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate email using the project's existing rule. */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validate password using the project's existing rule. */
function validatePassword(password) {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password);
}

/**
 * Prompt for a line of input.  If `hidden` is true the typed characters are
 * not echoed to the terminal (password-style input).
 */
function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // For hidden input we need raw-mode handling
    if (hidden) {
      rl.output.write(question);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (char) => {
        if (char === '\n' || char === '\r') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.output.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.output.write('\n');
          rl.close();
          process.exit(1);
        } else if (char === '\u007f' || char === '\b') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            rl.output.write('\b \b');
          }
        } else if (char.charCodeAt(0) >= 32) {
          input += char;
          rl.output.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Hand Holding Mini — Account Update Utility ===');
  console.log('This utility updates the email and password of an existing');
  console.log('Admin or Faculty account. No new users will be created.\n');

  // --- Collect current email ---
  const currentEmail = (await prompt('Current login email: ')).trim().toLowerCase();
  if (!currentEmail) {
    console.error('Error: Current email is required.');
    process.exit(1);
  }

  // --- Connect to database ---
  let connected = false;
  try {
    await connectDB();
    connected = true;
  } catch (err) {
    console.error('Error: Could not connect to the database.');
    console.error('Category:', err && err.category ? err.category : 'unknown');
    console.error('Please verify MONGODB_URI is set correctly.');
    process.exit(1);
  }

  try {
    // --- Find existing account ---
    const user = await User.findOne({ email: currentEmail });
    if (!user) {
      console.error('Error: No account found with email "' + currentEmail + '".');
      console.error('This utility only updates existing accounts. No new user was created.');
      process.exit(1);
    }

    // --- Verify role is Admin or Faculty ---
    const isAdmin = user.role === 'admin';
    const isFaculty = user.role === 'mentor' && user.mentorType === 'faculty';

    if (!isAdmin && !isFaculty) {
      console.error('Error: The account found is not an Admin or Faculty account.');
      console.error('Role: ' + user.role + (user.mentorType ? ' (' + user.mentorType + ')' : ''));
      console.error('This utility only updates Admin or Faculty accounts.');
      process.exit(1);
    }

    const roleLabel = isAdmin ? 'Admin' : 'Faculty';
    console.log('Found ' + roleLabel + ' account: ' + user.name + ' (' + user.email + ')');

    // --- Collect new email ---
    const newEmailRaw = await prompt('New login email: ');
    const newEmail = newEmailRaw.trim().toLowerCase();

    if (!newEmail) {
      console.error('Error: New email is required.');
      process.exit(1);
    }

    if (!validateEmail(newEmail)) {
      console.error('Error: Invalid email format.');
      process.exit(1);
    }

    // --- Check if new email already belongs to another account ---
    if (newEmail !== currentEmail) {
      const existing = await User.findOne({ email: newEmail });
      if (existing) {
        console.error('Error: The email "' + newEmail + '" is already in use by another account.');
        console.error('Aborting. No changes were made.');
        process.exit(1);
      }
    }

    // --- Collect new password ---
    const newPassword = await prompt('New password: ', true);

    if (!newPassword) {
      console.error('Error: Password is required.');
      process.exit(1);
    }

    if (!validatePassword(newPassword)) {
      console.error('Error: Password must be at least 8 characters and contain at least one letter and one number.');
      process.exit(1);
    }

    // --- Confirm ---
    const confirm = await prompt('Update email to "' + newEmail + '" and set a new password? (yes/no): ');
    if (confirm.trim().toLowerCase() !== 'yes') {
      console.log('Aborted. No changes were made.');
      process.exit(0);
    }

    // --- Hash password using the same approach as the application (bcrypt, 10 rounds) ---
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // --- Update only email and passwordHash on the existing account ---
    user.email = newEmail;
    user.passwordHash = passwordHash;
    await user.save();

    console.log('\nAccount updated successfully.');
    console.log('Name: ' + user.name);
    console.log('Role: ' + roleLabel);
    console.log('New email: ' + user.email);
    console.log('Password: [updated — not displayed]');
  } finally {
    if (connected) {
      await disconnectDB();
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err && err.message ? err.message : err);
  process.exit(1);
});