const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function migrate() {
  try {
    console.log('[Migration] Checking users table for security question columns...');
    const columns = await db.query('DESCRIBE users');
    const colNames = columns.map(c => c.Field);

    if (!colNames.includes('security_question')) {
      console.log('[Migration] Adding security_question column to users table...');
      await db.query('ALTER TABLE `users` ADD COLUMN `security_question` VARCHAR(255) NULL AFTER `full_name`');
      console.log('✅ security_question added');
    }

    if (!colNames.includes('security_answer_hash')) {
      console.log('[Migration] Adding security_answer_hash column to users table...');
      await db.query('ALTER TABLE `users` ADD COLUMN `security_answer_hash` VARCHAR(255) NULL AFTER `security_question`');
      console.log('✅ security_answer_hash added');
    }

    // Set a default security question and answer for admin user 'Vikram' if not set
    const adminUser = await db.queryOne("SELECT id, username, security_question, security_answer_hash FROM users WHERE username = 'Vikram' OR id = 1 LIMIT 1");
    if (adminUser && (!adminUser.security_question || !adminUser.security_answer_hash)) {
      const defaultQuestion = "What is your father's name?";
      const defaultAnswer = "amit patel"; // Normalized lowercase
      const defaultAnswerHash = await bcrypt.hash(defaultAnswer, 10);

      await db.query(
        'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?',
        [defaultQuestion, defaultAnswerHash, adminUser.id]
      );
      console.log(`✅ Default security question & answer set for user '${adminUser.username}'`);
    }

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

module.exports = { migrate };

// Allow running directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}