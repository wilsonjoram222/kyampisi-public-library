require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "kyampisi-library-secret-key";

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "kyampisi_library",
  password: process.env.DB_PASSWORD || "password",
  port: process.env.DB_PORT || 5432,
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname.replace(/\s/g, "_"));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ========== DATABASE INITIALIZATION ==========
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Drop tables (for clean slate)
    await client.query("DROP TABLE IF EXISTS saved_resources CASCADE");
    await client.query("DROP TABLE IF EXISTS resources CASCADE");
    await client.query("DROP TABLE IF EXISTS users CASCADE");
    await client.query("DROP TABLE IF EXISTS assistance_requests CASCADE");
    await client.query("DROP TABLE IF EXISTS announcements CASCADE");
    await client.query("DROP TABLE IF EXISTS workshops CASCADE");

    // Users
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'researcher',
        avatar TEXT,
        institution TEXT
      )
    `);

    // Resources (with file columns)
    await client.query(`
      CREATE TABLE resources (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        authors TEXT,
        year INTEGER,
        snippet TEXT,
        type TEXT,
        open_access INTEGER DEFAULT 0,
        cover_category TEXT,
        reading_time TEXT,
        doi TEXT,
        publisher TEXT,
        is_local_thesis INTEGER DEFAULT 0,
        file_path TEXT,
        file_name TEXT,
        file_size INTEGER,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Saved resources
    await client.query(`
      CREATE TABLE saved_resources (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, resource_id)
      )
    `);

    // Assistance requests
    await client.query(`
      CREATE TABLE assistance_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name TEXT,
        email TEXT,
        question TEXT NOT NULL,
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Announcements
    await client.query(`
      CREATE TABLE announcements (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT,
        category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Workshops
    await client.query(`
      CREATE TABLE workshops (
        id SERIAL PRIMARY KEY,
        title TEXT,
        description TEXT,
        date TEXT,
        time TEXT,
        registration_link TEXT
      )
    `);

    await client.query("COMMIT");
    console.log("PostgreSQL schema created");
    await seedDatabase(client);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Schema creation error:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function seedDatabase(client) {
  try {
    await client.query("BEGIN");

    // Seed resources
    const resources = [
      ["Albedo modification in dense cities: A meta-analysis", "Chen, L., Wong, T., & Martinez, R.", 2026, "Comprehensive review of cool roof and green canopy impacts on urban surface temperatures.", "journal", 0, "environmental", "14 min", "10.1016/j.uclim.2026.101234", "Urban Climate", 0],
      ["ASEAN solar tariff impacts 2024-2026: Policy analysis", "Widodo, A., Santos, M., & Lee, K.", 2025, "Examines feed-in tariff adjustments and their effect on solar PV adoption across Southeast Asia.", "journal", 1, "energy", "18 min", "10.1016/j.enpol.2025.113456", "Energy Policy", 0],
      ["Research Design: Qualitative, Quantitative, and Mixed Methods", "Creswell, J.W., & Creswell, J.D.", 2023, "Sixth edition includes new chapters on digital ethnography and online data collection ethics.", "book", 0, "methodology", "Reference", "978-1071817956", "SAGE Publications", 0],
      ["The Impact of Mobile Money on Rural Livelihoods in Uganda", "Nakato, M., & Okello, J.", 2025, "This thesis examines how mobile money services have transformed financial inclusion among smallholder farmers in Kyampisi District.", "thesis", 1, "economics", "45 min", null, "Kyampisi University", 1],
      ["Groundwater Quality Assessment in Kyampisi Sub-County", "Ssali, P.", 2024, "Master's thesis evaluating borehole water quality and contamination risks in peri-urban settlements.", "thesis", 1, "environmental", "50 min", null, "Kyampisi University", 1]
    ];

    for (const r of resources) {
      await client.query(
        `INSERT INTO resources (title, authors, year, snippet, type, open_access, cover_category, reading_time, doi, publisher, is_local_thesis)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        r
      );
    }

    // Demo users
    const hashed = bcrypt.hashSync("password123", 10);
    await client.query(
      "INSERT INTO users (email, password, name, role, institution, avatar) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING",
      ["maria.n@kyampisi.ac.ug", hashed, "Maria Nakato", "researcher", "Kyampisi University", "https://i.pravatar.cc/150?img=32"]
    );
    await client.query(
      "INSERT INTO users (email, password, name, role, institution, avatar) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING",
      ["librarian@kyampisi.go.ug", hashed, "James Okello", "librarian", "Kyampisi Public Library", "https://i.pravatar.cc/150?img=12"]
    );

    // Seed announcements
    await client.query(
      "INSERT INTO announcements (title, content, category) VALUES ($1, $2, $3)",
      ["New JSTOR Access", "Kyampisi Public Library now provides remote access to JSTOR Arts & Sciences I-X.", "database"]
    );
    await client.query(
      "INSERT INTO announcements (title, content, category) VALUES ($1, $2, $3)",
      ["Call for Papers: Uganda Research Symposium 2026", "Submit abstracts by May 15.", "conference"]
    );

    // Seed workshops
    await client.query(
      "INSERT INTO workshops (title, description, date, time, registration_link) VALUES ($1, $2, $3, $4, $5)",
      ["Zotero Citation Management", "Learn to organize references and insert citations in Word.", "2026-04-25", "14:00 EAT", "https://www.zotero.org/support/quick_start_guide"]
    );
    await client.query(
      "INSERT INTO workshops (title, description, date, time, registration_link) VALUES ($1, $2, $3, $4, $5)",
      ["Literature Searching with PubMed", "Hands-on workshop on building effective search strategies.", "2026-05-02", "10:00 EAT", "https://pubmed.ncbi.nlm.nih.gov/"]
    );

    await client.query("COMMIT");
    console.log("Database seeded successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed error:", err);
    throw err;
  }
}

// ========== MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

const requireLibrarian = (req, res, next) => {
  if (!req.user || (req.user.role || "").toLowerCase() !== "librarian") {
    return res.status(403).json({ error: "Librarian access required" });
  }
  next();
};

// ========== AUTH ROUTES ==========
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, institution, role } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = await pool.query(
      "INSERT INTO users (email, password, name, institution, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [email, hashed, name, institution, role || "researcher"]
    );
    const userId = result.rows[0].id;
    const token = jwt.sign(
      { id: userId, email, name, role: role || "researcher" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({ token, user: { id: userId, email, name, role: role || "researcher", institution } });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Email already registered" });
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, institution: user.institution } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PUBLIC RESOURCE ROUTES ==========
app.get("/api/resources", async (req, res) => {
  const { search, type, open, page = 1, limit = 12, local } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = "SELECT * FROM resources WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (search) {
    query += ` AND (title ILIKE $${paramIndex} OR authors ILIKE $${paramIndex} OR snippet ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  if (type && type !== "all") {
    query += ` AND type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }
  if (open === "true") {
    query += ` AND open_access = 1`;
  }
  if (local === "true") {
    query += ` AND is_local_thesis = 1`;
  }

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) AS temp`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY year DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    res.json({ resources: result.rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/resources/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM resources WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Resource not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/resources", authenticateToken, upload.single("file"), async (req, res) => {
  const { title, authors, year, snippet, type, open_access, publisher, doi, is_local_thesis } = req.body;
  if (!title || !authors || !year) return res.status(400).json({ error: "Title, authors, and year are required" });

  try {
    let filePath = null, fileName = null, fileSize = null;
    if (req.file) {
      filePath = "/uploads/" + req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;
    }
    const result = await pool.query(
      `INSERT INTO resources (title, authors, year, snippet, type, open_access, cover_category, reading_time, doi, publisher, is_local_thesis, file_path, file_name, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [title, authors, year, snippet || "", type || "journal", open_access ? 1 : 0, "default", "10 min", doi || null, publisher || null, is_local_thesis ? 1 : 0, filePath, fileName, fileSize, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add resource error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/resources/:id/download", async (req, res) => {
  try {
    const result = await pool.query("SELECT file_path, file_name FROM resources WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0 || !result.rows[0].file_path) {
      return res.status(404).json({ error: "File not found" });
    }
    const filePath = path.join(__dirname, result.rows[0].file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on server" });
    res.download(filePath, result.rows[0].file_name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== USER PROFILE & SAVED ==========
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, name, role, institution, avatar FROM users WHERE id = $1", [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/user/profile", authenticateToken, async (req, res) => {
  const { name, institution, avatar } = req.body;
  try {
    await pool.query(
      "UPDATE users SET name = COALESCE($1, name), institution = COALESCE($2, institution), avatar = COALESCE($3, avatar) WHERE id = $4",
      [name, institution, avatar, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/user/saved", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.* FROM resources r JOIN saved_resources s ON r.id = s.resource_id WHERE s.user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/user/save/:resourceId", authenticateToken, async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO saved_resources (user_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.user.id, req.params.resourceId]
    );
    res.json({ success: true, saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/user/save/:resourceId", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2", [req.user.id, req.params.resourceId]);
    res.json({ success: true, saved: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/user/saved/ids", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT resource_id FROM saved_resources WHERE user_id = $1", [req.user.id]);
    res.json(result.rows.map(r => r.resource_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ASSISTANCE ==========
app.post("/api/assistance", async (req, res) => {
  const { question, email } = req.body;
  const userId = req.user?.id || null;
  const userName = req.user?.name || null;
  const userEmail = email || req.user?.email || null;
  if (!question) return res.status(400).json({ error: "Question is required" });
  try {
    await pool.query(
      `INSERT INTO assistance_requests (user_id, user_name, email, question)
       VALUES ($1, $2, $3, $4)`,
      [userId, userName, userEmail, question]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PUBLIC ANNOUNCEMENTS & WORKSHOPS ==========
app.get("/api/announcements", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workshops", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM workshops WHERE date::DATE >= CURRENT_DATE ORDER BY date::DATE"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ADMIN (LIBRARIAN) ROUTES ==========
app.get("/api/admin/assistance-requests", authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM assistance_requests ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/assistance-requests/:id", authenticateToken, requireLibrarian, async (req, res) => {
  const { is_resolved } = req.body;
  try {
    await pool.query("UPDATE assistance_requests SET is_resolved = $1 WHERE id = $2", [is_resolved, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/resources", authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM resources ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/resources/:id", authenticateToken, requireLibrarian, upload.single("file"), async (req, res) => {
  const { title, authors, year, snippet, type, open_access, publisher, doi } = req.body;
  const resourceId = req.params.id;
  try {
    let filePath = null, fileName = null, fileSize = null;
    if (req.file) {
      filePath = "/uploads/" + req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;
    }
    const updates = [];
    const values = [];
    let idx = 1;
    if (title) { updates.push(`title = $${idx++}`); values.push(title); }
    if (authors) { updates.push(`authors = $${idx++}`); values.push(authors); }
    if (year) { updates.push(`year = $${idx++}`); values.push(parseInt(year)); }
    if (snippet !== undefined) { updates.push(`snippet = $${idx++}`); values.push(snippet); }
    if (type) { updates.push(`type = $${idx++}`); values.push(type); }
    if (open_access !== undefined) { updates.push(`open_access = $${idx++}`); values.push(open_access ? 1 : 0); }
    if (publisher !== undefined) { updates.push(`publisher = $${idx++}`); values.push(publisher); }
    if (doi !== undefined) { updates.push(`doi = $${idx++}`); values.push(doi); }
    if (filePath) {
      updates.push(`file_path = $${idx++}`); values.push(filePath);
      updates.push(`file_name = $${idx++}`); values.push(fileName);
      updates.push(`file_size = $${idx++}`); values.push(fileSize);
    }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(resourceId);
    await pool.query(`UPDATE resources SET ${updates.join(", ")} WHERE id = $${idx}`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/resources/:id", authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const result = await pool.query("SELECT file_path FROM resources WHERE id = $1", [req.params.id]);
    if (result.rows[0]?.file_path) {
      const filePath = path.join(__dirname, result.rows[0].file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await pool.query("DELETE FROM resources WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/announcements", authenticateToken, requireLibrarian, async (req, res) => {
  const { title, content, category } = req.body;
  try {
    await pool.query(
      "INSERT INTO announcements (title, content, category) VALUES ($1, $2, $3)",
      [title, content, category || "general"]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/announcements/:id", authenticateToken, requireLibrarian, async (req, res) => {
  const { title, content, category } = req.body;
  try {
    await pool.query(
      "UPDATE announcements SET title = COALESCE($1, title), content = COALESCE($2, content), category = COALESCE($3, category) WHERE id = $4",
      [title, content, category, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/announcements/:id", authenticateToken, requireLibrarian, async (req, res) => {
  try {
    await pool.query("DELETE FROM announcements WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/workshops", authenticateToken, requireLibrarian, async (req, res) => {
  const { title, description, date, time, registration_link } = req.body;
  try {
    await pool.query(
      "INSERT INTO workshops (title, description, date, time, registration_link) VALUES ($1, $2, $3, $4, $5)",
      [title, description, date, time, registration_link]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/workshops/:id", authenticateToken, requireLibrarian, async (req, res) => {
  const { title, description, date, time, registration_link } = req.body;
  try {
    await pool.query(
      `UPDATE workshops SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        date = COALESCE($3, date),
        time = COALESCE($4, time),
        registration_link = COALESCE($5, registration_link)
       WHERE id = $6`,
      [title, description, date, time, registration_link, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/workshops/:id", authenticateToken, requireLibrarian, async (req, res) => {
  try {
    await pool.query("DELETE FROM workshops WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Kyampisi Public Library running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });