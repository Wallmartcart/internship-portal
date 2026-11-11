# \# Internship Portal

# \### CSIT128 – Assignment 2

# 

# A web-based internship management platform built using \*\*Node.js, Express, and MySQL\*\*.

# 

# The platform provides two types of users:

# \- \*\*Students:\*\* Browse available internships, bookmark opportunities, submit applications, and track application statuses.

# \- \*\*Companies:\*\* Register accounts, publish internship opportunities, manage listings, and review student applications.

# 

# \---

# 

# \## 1. Prerequisites

# 

# Before running the project, make sure you have installed:

# 

# \- \*\*Node.js\*\* 20.12 or newer.

# \- \*\*MySQL Server\*\* running locally (MySQL Workbench, XAMPP, MAMP, or WAMP can be used to manage your MySQL installation).

# \- \*\*Git\*\* (optional, for cloning the repository).

# 

# To check your Node.js version, run:

# 

# ```bash

# node -v

# ```

# 

# \## 2. Installation and Setup

# 

# Clone the repository or download the project files.

# 

# Open a terminal in the project directory and install the dependencies:

# 

# ```bash

# npm install

# ```

# 

# \### Configure Environment Variables

# 

# The project uses environment variables to store database credentials securely.

# 

# 1\. Copy `.env.example` and rename the copy to `.env`.

# 2\. Open `.env` in a text editor.

# 3\. Enter your own MySQL connection details.

# 

# Example configuration:

# 

# ```env

# DB\_HOST=localhost

# DB\_PORT=3306

# DB\_USER=root

# DB\_PASSWORD=your\_mysql\_password

# DB\_NAME=internship\_portal

# ```

# 

# \*\*Note:\*\* Replace `your\_mysql\_password` with your actual MySQL password. If your MySQL root account does not require a password, leave `DB\_PASSWORD` empty.

# 

# You do not need to create the database or tables manually. The server automatically creates the `internship\_portal` database and its required tables when it starts for the first time.

# 

# \## 3. Running the Application

# 

# Once the installation and database configuration are complete, start the server:

# 

# ```bash

# npm start

# ```

# 

# Open your browser and navigate to:

# 

# \*\*http://localhost:3000\*\*

# 

# If the application fails to start, check the terminal for error messages. Common causes include an incorrect MySQL password or a MySQL Server that is not running.

# 

# \## 4. Application Usage

# 

# \### Company Portal

# 

# 1\. Register a company account.

# 2\. Log in to the Company Portal.

# 3\. Post a new internship opportunity.

# 4\. Open \*\*My Internships\*\* to manage posted opportunities.

# 5\. Open \*\*Applications\*\* to review student applications.

# 6\. Select \*\*View\*\* to inspect an application, update its status, and save the changes.

# 

# Available application statuses:

# \- Pending

# \- Shortlisted

# \- Accepted

# \- Rejected

# 

# \### Student Portal

# 

# 1\. Sign up for a student account.

# 2\. Navigate to the Internships Page.

# 3\. Browse and filter available opportunities.

# 4\. Click the star icon to bookmark internships.

# 5\. Navigate to the Application Page.

# 6\. Select a bookmarked internship, complete the application form, and submit it.

# 7\. Track your application status.

# 8\. Visit the Profile Page to manage your profile.

# 

# \*\*Testing Tip:\*\* To test both user roles simultaneously, use two different browsers or open one normal browser window and one private/incognito window.

# 

# \## 5. Project Structure

# 

# ```text

# Internship-Portal/

# │

# ├── server.js               # Express server and application routes

# ├── db.js                   # MySQL connection and database initialization

# ├── package.json            # Project dependencies and scripts

# ├── .env.example            # Example environment configuration

# ├── .gitignore              # Files excluded from Git

# │

# ├── Landing\_Page.html       # Main landing page

# │

# ├── User Site/

# │   ├── HTML pages          # Student-facing pages

# │   ├── css/                # Student portal stylesheets

# │   ├── js/                 # Student portal scripts

# │   └── user\_profile.ejs    # Student profile template

# │

# ├── Admin/

# │   ├── 1-HTML/             # Company portal pages

# │   └── 2-CSS/              # Company portal stylesheets

# │

# └── \_unused/                # Legacy code from the original project

# ```

# 

# \---

# 

# \## 6. Security Notes

# 

# \- Never upload your `.env` file to GitHub.

# \- Keep your database credentials private.

# \- Each developer should configure their own `.env` file.

# \- The `.env.example` file can safely be shared because it contains only example configuration values.

# 

# \---

# 

# \*\*Technologies Used:\*\* Node.js · Express.js · MySQL · HTML · CSS · JavaScript · EJS

