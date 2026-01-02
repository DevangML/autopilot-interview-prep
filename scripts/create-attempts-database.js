/**
 * Helper Script: Create Attempts Database in Notion
 * 
 * This script helps you create an attempts database with the required schema.
 * Run this with: node scripts/create-attempts-database.js
 * 
 * Requirements:
 * - Notion API key
 * - Parent page ID (optional - will create in root if not provided)
 */

const NOTION_API_VERSION = '2022-06-28';

/**
 * Creates an attempts database in Notion
 * @param {string} apiKey - Notion API key
 * @param {string} parentPageId - Optional parent page ID (creates in root if not provided)
 * @returns {Promise<Object>} Created database with ID
 */
async function createAttemptsDatabase(apiKey, parentPageId = null) {
  const databaseTitle = [
    {
      type: 'text',
      text: { content: 'Attempts' }
    }
  ];

  const properties = {
    'Item': {
      relation: {
        database_id: null, // Will be set to link to your learning databases
        type: 'single_property'
      }
    },
    'Result': {
      select: {
        options: [
          { name: 'Solved', color: 'green' },
          { name: 'Partial', color: 'yellow' },
          { name: 'Failed', color: 'red' },
          { name: 'Skipped', color: 'gray' }
        ]
      }
    },
    'Time Spent': {
      number: {
        format: 'number'
      }
    },
    'Time Spent (min)': {
      number: {
        format: 'number'
      }
    },
    'Sheet': {
      select: {
        options: [
          { name: 'DSA', color: 'blue' },
          { name: 'OS', color: 'purple' },
          { name: 'DBMS', color: 'orange' },
          { name: 'CN', color: 'pink' },
          { name: 'OOP', color: 'brown' }
        ]
      }
    },
    'Confidence': {
      select: {
        options: [
          { name: 'High', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'Low', color: 'red' }
        ]
      }
    },
    'Hint Used': {
      checkbox: {}
    },
    'Mistake Tags': {
      multi_select: {
        options: []
      }
    }
  };

  const requestBody = {
    parent: parentPageId 
      ? { page_id: parentPageId }
      : { type: 'workspace', workspace: true },
    title: databaseTitle,
    properties
  };

  const response = await fetch('https://api.notion.com/v1/databases', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create database: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Gets database ID from a Notion database URL
 * @param {string} url - Notion database URL
 * @returns {string} Database ID
 */
function getDatabaseIdFromUrl(url) {
  // Notion URLs format: https://www.notion.so/{workspace}/{database-id}?v=...
  // Or: https://{workspace}.notion.so/{database-id}?v=...
  const match = url.match(/notion\.so\/(?:[^\/]+\/)?([a-f0-9]{32})/);
  if (match) {
    const id = match[1];
    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
  }
  throw new Error('Invalid Notion URL format');
}

// CLI usage - run with: node create-attempts-database.js <API_KEY> [PARENT_PAGE_ID]
// Or import and use the functions directly
if (typeof process !== 'undefined' && process.argv) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const apiKey = args[0];
    const parentPageId = args[1] || null;

    if (!apiKey) {
      console.error('Usage: node create-attempts-database.js <NOTION_API_KEY> [PARENT_PAGE_ID]');
      console.error('\nExample:');
      console.error('  node create-attempts-database.js secret_abc123');
      console.error('  node create-attempts-database.js secret_abc123 abc123def456');
      process.exit(1);
    }

    createAttemptsDatabase(apiKey, parentPageId)
      .then(database => {
        console.log('\n✅ Attempts database created successfully!');
        console.log(`\nDatabase ID: ${database.id}`);
        console.log(`Database URL: ${database.url}`);
        console.log(`\n📋 Copy this Database ID to your extension configuration:`);
        console.log(`   ${database.id}\n`);
      })
      .catch(err => {
        console.error('\n❌ Error creating database:', err.message);
        process.exit(1);
      });
  }
}

export { createAttemptsDatabase, getDatabaseIdFromUrl };

