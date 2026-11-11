// db.js - MySQL connection pool + automatic schema setup
//
// Connection settings come from environment variables (or a .env file next to
// this file). Defaults match a stock local MySQL install with no root password:
//
//   DB_HOST      (default: localhost)
//   DB_PORT      (default: 3306)
//   DB_USER      (default: root)
//   DB_PASSWORD  (default: empty)
//   DB_NAME      (default: internship_portal)

const path = require('path');
const mysql = require('mysql2/promise');

// Load .env if present (built into Node 20.12+ / 22+, no extra package needed)
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (_) {
  /* no .env file - that's fine */
}

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'internship_portal'
};

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: ['DATE'] // return DATE columns as 'YYYY-MM-DD' strings (no timezone shifting)
});

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    university VARCHAR(100),
    major VARCHAR(100),
    resume_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    location VARCHAR(100),
    industry VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS internships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    type ENUM('Remote', 'On-site', 'Hybrid') DEFAULT 'On-site',
    skills TEXT,
    salary VARCHAR(50),
    duration VARCHAR(50),
    deadline DATE,
    description TEXT,
    industry VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    internship_id INT NOT NULL,
    applicant_name VARCHAR(100),
    applicant_email VARCHAR(100),
    phone VARCHAR(50),
    cover_letter TEXT,
    experience TEXT,
    status ENUM('Pending', 'Shortlisted', 'Rejected', 'Accepted') DEFAULT 'Pending',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    UNIQUE KEY unique_application (student_id, internship_id)
  )`,

  `CREATE TABLE IF NOT EXISTS bookmarked_internships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    internship_id INT NOT NULL,
    bookmarked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bookmark (user_email, internship_id)
  )`
];

// Upgrades for databases created by the OLD version of this project
// (CREATE TABLE IF NOT EXISTS does not touch tables that already exist).
// Every statement is safe to run repeatedly.
const MIGRATIONS = [
  "ALTER TABLE internships MODIFY type ENUM('Remote','On-site','Hybrid') DEFAULT 'On-site'",
  'ALTER TABLE internships MODIFY salary VARCHAR(50)',
  'ALTER TABLE applications ADD COLUMN applicant_name VARCHAR(100)',
  'ALTER TABLE applications ADD COLUMN applicant_email VARCHAR(100)',
  'ALTER TABLE applications ADD COLUMN phone VARCHAR(50)',
  'ALTER TABLE applications ADD COLUMN cover_letter TEXT',
  'ALTER TABLE applications ADD COLUMN experience TEXT'
];

async function init() {
  // 1. Make sure the database exists
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
  await bootstrap.end();

  // 2. Create tables
  for (const sql of SCHEMA) await pool.query(sql);

  // 3. Upgrade old tables if needed
  for (const sql of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err; // column already there = fine
    }
  }
}

module.exports = { pool, init, config };
