// server.js - Internship Portal (students + companies)
//
// Run:  npm install   then   npm start     ->  http://localhost:3000

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { pool, init, config: dbConfig } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const USER_DIR = path.join(__dirname, 'User Site');
const COMPANY_DIR = path.join(__dirname, 'Admin');
const COMPANY_HTML = path.join(COMPANY_DIR, '1-HTML');

// ---------------------------------------------------------------- setup
app.set('view engine', 'ejs');
app.set('views', [USER_DIR, COMPANY_HTML]); // user_profile.ejs + Company_Profile.ejs

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'csit128-portal-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
  })
);

// ---------------------------------------------------------------- helpers
const query = async (sql, params = []) => (await pool.query(sql, params))[0];

const cleanEmail = (e) => String(e || '').trim().toLowerCase();
const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Redirect back to a form page with an error message the page can display
const back = (res, page, msg) => res.redirect(`${page}?error=${encodeURIComponent(msg)}`);

// Replace the session with a fresh one for this user (prevents session fixation)
const startSession = (req, user) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = user;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });

async function emailTaken(email) {
  const s = await query('SELECT id FROM students WHERE email = ?', [email]);
  if (s.length) return true;
  const c = await query('SELECT id FROM companies WHERE email = ?', [email]);
  return c.length > 0;
}

// Access control. Pages redirect to the login page, API calls get a 401 JSON.
const requireStudent = (req, res, next) => {
  if (req.session.user?.role === 'student') return next();
  if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please log in first' });
  res.redirect('/user/login');
};
const requireCompany = (req, res, next) => {
  if (req.session.user?.role === 'company') return next();
  if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please log in first' });
  res.redirect('/company/login');
};

// ---------------------------------------------------------------- static files
// Only css/js (and the one shared admin.js) are public - never the whole folder.
app.use('/user/css', express.static(path.join(USER_DIR, 'css')));
app.use('/user/js', express.static(path.join(USER_DIR, 'js'), { index: false }));
app.use('/company/2-CSS', express.static(path.join(COMPANY_DIR, '2-CSS')));
app.get('/company/admin.js', (req, res) => res.sendFile(path.join(COMPANY_DIR, 'admin.js')));

// ---------------------------------------------------------------- public pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Landing_Page.html')));

for (const f of ['Sign-Up_n_login_Page.html', 'Login_Page.html', 'Sign-Up_Page.html']) {
  app.get('/user/' + f, (req, res) => res.sendFile(path.join(USER_DIR, f)));
}
app.get('/user/login', (req, res) => res.sendFile(path.join(USER_DIR, 'Login_Page.html')));
app.get('/user/signup', (req, res) => res.sendFile(path.join(USER_DIR, 'Sign-Up_Page.html')));

for (const f of ['Company_Login.html', 'Company_SignUp.html', 'Company_Sign-Up_n_login_Page.html']) {
  app.get('/company/1-HTML/' + f, (req, res) => res.sendFile(path.join(COMPANY_HTML, f)));
}
app.get('/company/login', (req, res) => res.sendFile(path.join(COMPANY_HTML, 'Company_Login.html')));
app.get('/company/signup', (req, res) => res.sendFile(path.join(COMPANY_HTML, 'Company_SignUp.html')));

// ---------------------------------------------------------------- AUTH: students
app.post('/user/signup', async (req, res) => {
  const full_name = text(req.body.full_name);
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const university = text(req.body.university) || null;
  const major = text(req.body.major) || null;

  const page = '/user/signup';
  if (!full_name || !email || !password) return back(res, page, 'Please fill in all fields.');
  if (!isEmail(email)) return back(res, page, 'Please enter a valid email address.');
  if (password.length < 6) return back(res, page, 'Password must be at least 6 characters.');
  if (await emailTaken(email)) return back(res, page, 'That email is already registered.');

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO students (full_name, email, password, university, major) VALUES (?, ?, ?, ?, ?)',
    [full_name, email, hash, university, major]
  );

  await startSession(req, { id: result.insertId, role: 'student', full_name, email });
  res.redirect('/student/dashboard');
});

// Login for BOTH students and companies (the user login form accepts either)
app.post('/user/login', async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const page = '/user/login';

  const students = await query('SELECT * FROM students WHERE email = ?', [email]);
  if (students.length) {
    const s = students[0];
    if (!(await bcrypt.compare(password, s.password))) return back(res, page, 'Wrong email or password.');
    await startSession(req, { id: s.id, role: 'student', full_name: s.full_name, email: s.email });
    return res.redirect('/student/dashboard');
  }

  const companies = await query('SELECT * FROM companies WHERE email = ?', [email]);
  if (companies.length) {
    const c = companies[0];
    if (!(await bcrypt.compare(password, c.password))) return back(res, page, 'Wrong email or password.');
    await startSession(req, { id: c.id, role: 'company', name: c.name, email: c.email });
    return res.redirect('/company/dashboard');
  }

  back(res, page, 'Wrong email or password.');
});

app.get('/user/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------------------------------------------------------------- AUTH: companies
app.post('/company/signup', async (req, res) => {
  const name = text(req.body.company_name);
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const location = text(req.body.location);
  const industry = text(req.body.industry) || null;

  const page = '/company/signup';
  if (!name || !email || !password || !location) return back(res, page, 'Please fill in all required fields.');
  if (!isEmail(email)) return back(res, page, 'Please enter a valid email address.');
  if (password.length < 6) return back(res, page, 'Password must be at least 6 characters.');
  if (await emailTaken(email)) return back(res, page, 'That email is already registered.');

  const hash = await bcrypt.hash(password, 10);
  await query('INSERT INTO companies (name, email, password, location, industry) VALUES (?, ?, ?, ?, ?)', [
    name,
    email,
    hash,
    location,
    industry
  ]);

  res.redirect('/company/login?registered=1');
});

app.post('/company/login', async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const page = '/company/login';

  const rows = await query('SELECT * FROM companies WHERE email = ?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) {
    return back(res, page, 'Wrong email or password.');
  }
  const c = rows[0];
  await startSession(req, { id: c.id, role: 'company', name: c.name, email: c.email });
  res.redirect('/company/dashboard');
});

app.get('/company/logout', (req, res) => {
  req.session.destroy(() => res.sendFile(path.join(COMPANY_HTML, 'logout.html')));
});

// ---------------------------------------------------------------- session info (used by the page scripts)
app.get('/api/session', (req, res) => {
  if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
  else res.json({ loggedIn: false });
});

// ================================================================ STUDENT AREA
app.get('/student/dashboard', requireStudent, (req, res) =>
  res.sendFile(path.join(USER_DIR, 'User_Dashboard.html'))
);
app.get('/user/internships', requireStudent, (req, res) =>
  res.sendFile(path.join(USER_DIR, 'internship_page.html'))
);
app.get('/student/applications', requireStudent, (req, res) =>
  res.sendFile(path.join(USER_DIR, 'application_page.html'))
);

// Old links used these file names - keep them working
app.get('/user/User_Dashboard.html', (req, res) => res.redirect('/student/dashboard'));
app.get('/user/internship_page.html', (req, res) => res.redirect('/user/internships'));
app.get('/user/application_page.html', (req, res) => res.redirect('/student/applications'));

// ---- student profile
app.get('/user/profile', requireStudent, (req, res) => {
  const { full_name, email } = req.session.user;
  res.render('user_profile', { user: { full_name, email }, error: req.query.error || '', saved: !!req.query.saved });
});

app.post('/user/profile', requireStudent, async (req, res) => {
  const { id, email: oldEmail } = req.session.user;
  const full_name = text(req.body.full_name);
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!full_name || !isEmail(email)) return back(res, '/user/profile', 'Please enter a name and a valid email.');
  if (password && password.length < 6) return back(res, '/user/profile', 'Password must be at least 6 characters.');

  if (email !== oldEmail && (await emailTaken(email))) {
    return back(res, '/user/profile', 'That email is already used by another account.');
  }

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE students SET full_name = ?, email = ?, password = ? WHERE id = ?', [full_name, email, hash, id]);
  } else {
    await query('UPDATE students SET full_name = ?, email = ? WHERE id = ?', [full_name, email, id]);
  }
  // bookmarks are keyed by email, so move them along with it
  if (email !== oldEmail) {
    await query('UPDATE bookmarked_internships SET user_email = ? WHERE user_email = ?', [email, oldEmail]);
  }

  req.session.user.full_name = full_name;
  req.session.user.email = email;
  res.redirect('/user/profile?saved=1');
});

// ---- internships (public list; the page itself requires login)
const INTERNSHIP_SELECT = `
  SELECT i.id, i.company_id, i.title, i.location, i.type, i.skills, i.salary, i.duration,
         i.deadline, i.description, i.created_at,
         c.name AS company_name,
         COALESCE(NULLIF(i.industry, ''), c.industry) AS industry
  FROM internships i
  JOIN companies c ON i.company_id = c.id`;

app.get('/api/internships', async (req, res) => {
  const rows = await query(
    `${INTERNSHIP_SELECT}
     WHERE (i.deadline IS NULL OR i.deadline >= CURDATE())
     ORDER BY i.created_at DESC, i.id DESC`
  );
  res.json(rows);
});

// ---- bookmarks
app.get('/api/bookmarks', requireStudent, async (req, res) => {
  const rows = await query(
    `SELECT i.*, i.id AS internship_id
     FROM bookmarked_internships b
     JOIN internships i ON b.internship_id = i.id
     WHERE b.user_email = ?
     ORDER BY b.bookmarked_at DESC`,
    [req.session.user.email]
  );
  res.json(rows);
});

app.post('/api/bookmarks', requireStudent, async (req, res) => {
  const internshipId = Number(req.body?.internshipId);
  if (!Number.isInteger(internshipId)) return res.status(400).json({ error: 'Invalid internship' });
  const exists = await query('SELECT id FROM internships WHERE id = ?', [internshipId]);
  if (!exists.length) return res.status(404).json({ error: 'Internship not found' });

  await query('INSERT IGNORE INTO bookmarked_internships (user_email, internship_id) VALUES (?, ?)', [
    req.session.user.email,
    internshipId
  ]);
  res.json({ success: true });
});

app.delete('/api/bookmarks', requireStudent, async (req, res) => {
  const internshipId = Number(req.body?.internshipId);
  if (!Number.isInteger(internshipId)) return res.status(400).json({ error: 'Invalid internship' });
  await query('DELETE FROM bookmarked_internships WHERE user_email = ? AND internship_id = ?', [
    req.session.user.email,
    internshipId
  ]);
  res.json({ success: true });
});

// ---- applications (student side)
app.get('/api/applications', requireStudent, async (req, res) => {
  const rows = await query(
    'SELECT id, internship_id, status, applied_at FROM applications WHERE student_id = ? ORDER BY applied_at DESC',
    [req.session.user.id]
  );
  res.json(rows);
});

app.post('/api/applications', requireStudent, async (req, res) => {
  const internshipId = Number(req.body?.internshipId);
  const applicantName = text(req.body?.applicantName);
  const applicantEmail = cleanEmail(req.body?.applicantEmail);
  const phone = text(req.body?.phone) || null;
  const coverLetter = text(req.body?.coverLetter);
  const experience = text(req.body?.experience) || null;

  if (!Number.isInteger(internshipId) || !applicantName || !applicantEmail || !coverLetter) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  const internship = await query('SELECT id FROM internships WHERE id = ?', [internshipId]);
  if (!internship.length) return res.status(404).json({ error: 'Internship not found' });

  try {
    await query(
      `INSERT INTO applications
         (student_id, internship_id, applicant_name, applicant_email, phone, cover_letter, experience, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [req.session.user.id, internshipId, applicantName, applicantEmail, phone, coverLetter, experience]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You already applied to this internship.' });
    throw err;
  }
  res.json({ success: true, message: 'Application submitted' });
});

// ================================================================ COMPANY AREA
app.get('/company/dashboard', requireCompany, (req, res) =>
  res.sendFile(path.join(COMPANY_HTML, 'Company_Dashboard.html'))
);
app.get('/company/Dashboard', (req, res) => res.redirect('/company/dashboard'));

app.get('/company/create_internship', requireCompany, (req, res) =>
  res.sendFile(path.join(COMPANY_HTML, 'Post_Internship.html'))
);
app.get('/company/internships', requireCompany, (req, res) =>
  res.sendFile(path.join(COMPANY_HTML, 'Company_Internships.html'))
);
app.get('/company/applications', requireCompany, (req, res) =>
  res.sendFile(path.join(COMPANY_HTML, 'View_Applications.html'))
);

// ---- post an internship
const TYPES = ['Remote', 'On-site', 'Hybrid'];

app.post('/company/create_internship', requireCompany, async (req, res) => {
  const title = text(req.body.title);
  const type = text(req.body.type);
  const skills = text(req.body.skills);
  const salary = text(req.body.salary) || null;
  const duration = text(req.body.duration);
  const deadline = text(req.body.deadline);
  const description = text(req.body.description) || null;
  const industry = text(req.body.industry) || null;
  const companyId = req.session.user.id;

  const page = '/company/create_internship';
  if (!title || !skills || !duration || !deadline) return back(res, page, 'Please fill in all required fields.');
  if (!TYPES.includes(type)) return back(res, page, 'Please choose a valid internship type.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return back(res, page, 'Invalid deadline date.');

  // Use the location typed in the form, fall back to the company's own location
  let location = text(req.body.location);
  if (!location) {
    const c = await query('SELECT location FROM companies WHERE id = ?', [companyId]);
    location = c[0]?.location || null;
  }

  await query(
    `INSERT INTO internships (company_id, title, location, type, skills, salary, duration, deadline, description, industry)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [companyId, title, location, type, skills, salary, duration, deadline, description, industry]
  );
  res.redirect('/company/internships?posted=1');
});

app.get('/api/company/internships', requireCompany, async (req, res) => {
  const rows = await query(
    `SELECT i.id, i.title, i.location, i.type, i.salary, i.duration, i.deadline, i.industry,
            (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id) AS application_count
     FROM internships i
     WHERE i.company_id = ?
     ORDER BY i.created_at DESC, i.id DESC`,
    [req.session.user.id]
  );
  res.json(rows);
});

app.delete('/api/company/internships/:id', requireCompany, async (req, res) => {
  const result = await query('DELETE FROM internships WHERE id = ? AND company_id = ?', [
    Number(req.params.id),
    req.session.user.id
  ]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Internship not found' });
  res.json({ success: true });
});

// ---- applications received
app.get('/api/company/applications', requireCompany, async (req, res) => {
  const rows = await query(
    `SELECT a.id, a.status, a.applied_at, a.phone, a.cover_letter, a.experience,
            COALESCE(a.applicant_name, s.full_name) AS student_name,
            COALESCE(a.applicant_email, s.email) AS student_email,
            s.university, s.major,
            i.title AS internship_title
     FROM applications a
     JOIN students s ON a.student_id = s.id
     JOIN internships i ON a.internship_id = i.id
     WHERE i.company_id = ?
     ORDER BY a.applied_at DESC, a.id DESC`,
    [req.session.user.id]
  );
  res.json(rows);
});

app.put('/api/company/applications/:id/status', requireCompany, async (req, res) => {
  const status = req.body?.status;
  if (!['Pending', 'Shortlisted', 'Accepted', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  // Only touch applications that belong to one of THIS company's internships
  const result = await query(
    `UPDATE applications SET status = ?
     WHERE id = ? AND internship_id IN (SELECT id FROM internships WHERE company_id = ?)`,
    [status, Number(req.params.id), req.session.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Application not found' });
  res.json({ success: true });
});

// ---- company profile
app.get('/company/profile', requireCompany, async (req, res) => {
  const rows = await query('SELECT * FROM companies WHERE id = ?', [req.session.user.id]);
  if (!rows.length) return res.status(404).send('Company not found');
  const c = rows[0];
  res.render('Company_Profile', {
    company: { company_name: c.name, email: c.email, location: c.location, industry: c.industry },
    error: req.query.error || '',
    saved: !!req.query.saved
  });
});

app.post('/company/profile', requireCompany, async (req, res) => {
  const { id, email: oldEmail } = req.session.user;
  const name = text(req.body.company_name);
  const email = cleanEmail(req.body.email);
  const location = text(req.body.location);
  const industry = text(req.body.industry) || null;

  if (!name || !location || !isEmail(email)) {
    return back(res, '/company/profile', 'Please fill in name, location and a valid email.');
  }
  if (email !== oldEmail && (await emailTaken(email))) {
    return back(res, '/company/profile', 'That email is already used by another account.');
  }

  await query('UPDATE companies SET name = ?, email = ?, location = ?, industry = ? WHERE id = ?', [
    name,
    email,
    location,
    industry,
    id
  ]);
  req.session.user.name = name;
  req.session.user.email = email;
  res.redirect('/company/profile?saved=1');
});

// ---------------------------------------------------------------- errors
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).send('Page not found. <a href="/">Go to the home page</a>');
});

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  if (res.headersSent) return next(err);
  if (req.originalUrl.startsWith('/api/')) return res.status(500).json({ error: 'Server error' });
  res.status(500).send('Something went wrong on the server. Check the terminal for details.');
});

// ---------------------------------------------------------------- start
(async () => {
  try {
    await init();
    console.log(`✅ Database "${dbConfig.database}" ready (${dbConfig.user}@${dbConfig.host}:${dbConfig.port})`);
  } catch (err) {
    console.error('\n❌ Could not connect to / set up MySQL:', err.code || '', err.message);
    if (err.code === 'ECONNREFUSED') console.error('   -> MySQL is not running. Start the MySQL service first.');
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   -> Wrong MySQL username/password. Set DB_USER / DB_PASSWORD (see README.md).');
    }
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
})();
