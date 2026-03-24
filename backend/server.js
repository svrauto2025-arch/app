const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Missing authorization header' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

function createNotificationsByRole(role, message, exceptUserId = null) {
  const users = db
    .prepare('SELECT id FROM users WHERE role = ?')
    .all(role)
    .filter((u) => u.id !== exceptUserId);

  const stmt = db.prepare('INSERT INTO notifications (user_id, message) VALUES (?, ?)');
  const tx = db.transaction((rows) => rows.forEach((u) => stmt.run(u.id, message)));
  tx(users);
}

function touchTicket(ticketId) {
  db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticketId);
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name }, JWT_SECRET, {
    expiresIn: '12h'
  });

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name
    }
  });
});

app.get('/api/users', authMiddleware, requireRole('admin'), (_, res) => {
  const users = db
    .prepare('SELECT id, username, role, full_name, created_at FROM users ORDER BY id DESC')
    .all();
  res.json(users);
});

app.post('/api/users', authMiddleware, requireRole('admin'), (req, res) => {
  const { username, password, role, fullName } = req.body;
  if (!username || !password || !role || !fullName) return res.status(400).json({ message: 'Missing required fields' });

  try {
    const result = db
      .prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)')
      .run(username, bcrypt.hashSync(password, 10), role, fullName);

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ message: 'Could not create user (username may already exist)' });
  }
});

app.put('/api/users/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { fullName, role } = req.body;
  const result = db.prepare('UPDATE users SET full_name = ?, role = ? WHERE id = ?').run(fullName, role, req.params.id);
  if (!result.changes) return res.status(404).json({ message: 'User not found' });
  res.json({ success: true });
});

app.delete('/api/users/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ message: 'Admin cannot delete self' });

  db.prepare('UPDATE tickets SET assigned_to = NULL WHERE assigned_to = ?').run(id);
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ message: 'User not found' });
  res.json({ success: true });
});

app.get('/api/tickets', authMiddleware, (req, res) => {
  const baseQuery = `
    SELECT t.*, u.full_name AS created_by_name, tech.full_name AS assigned_to_name
    FROM tickets t
    JOIN users u ON t.created_by = u.id
    LEFT JOIN users tech ON t.assigned_to = tech.id
  `;

  let rows = [];
  if (req.user.role === 'admin') {
    rows = db.prepare(`${baseQuery} ORDER BY t.created_at DESC`).all();
  } else if (req.user.role === 'technician') {
    rows = db.prepare(`${baseQuery} WHERE t.assigned_to = ? ORDER BY t.created_at DESC`).all(req.user.id);
  } else {
    rows = db.prepare(`${baseQuery} WHERE t.created_by = ? ORDER BY t.created_at DESC`).all(req.user.id);
  }

  res.json(rows);
});

app.get('/api/dashboard/stats', authMiddleware, requireRole('admin'), (_, res) => {
  const total = db.prepare('SELECT COUNT(*) as value FROM tickets').get().value;
  const pending = db.prepare("SELECT COUNT(*) as value FROM tickets WHERE status != 'Closed'").get().value;
  const resolved = db.prepare("SELECT COUNT(*) as value FROM tickets WHERE status = 'Closed'").get().value;
  const unassigned = db.prepare('SELECT COUNT(*) as value FROM tickets WHERE assigned_to IS NULL').get().value;

  res.json({ total, pending, resolved, unassigned });
});

app.post('/api/tickets', authMiddleware, requireRole('user'), upload.single('attachment'), (req, res) => {
  const { title, description, priority } = req.body;
  if (!title || !description || !priority) return res.status(400).json({ message: 'Missing required fields' });

  const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db
    .prepare(
      'INSERT INTO tickets (title, description, priority, attachment_path, created_by) VALUES (?, ?, ?, ?, ?)'
    )
    .run(title, description, priority, attachmentPath, req.user.id);

  const ticketId = Number(result.lastInsertRowid);
  const ticketCode = `TCK-${String(ticketId).padStart(4, '0')}`;
  db.prepare('UPDATE tickets SET ticket_code = ? WHERE id = ?').run(ticketCode, ticketId);

  createNotificationsByRole('admin', `New ticket created: ${ticketCode}`);
  createNotificationsByRole('technician', `New unassigned ticket available: ${ticketCode}`);

  res.status(201).json({ id: ticketId, ticketCode });
});

app.put('/api/tickets/:id/assign', authMiddleware, requireRole('admin'), (req, res) => {
  const { technicianId } = req.body;
  const ticketId = Number(req.params.id);

  const tech = db.prepare("SELECT id, full_name FROM users WHERE id = ? AND role = 'technician'").get(technicianId);
  if (!tech) return res.status(400).json({ message: 'Technician not found' });

  const ticket = db.prepare('SELECT ticket_code FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  db.prepare("UPDATE tickets SET assigned_to = ?, status = 'In Progress' WHERE id = ?").run(technicianId, ticketId);
  touchTicket(ticketId);

  db.prepare('INSERT INTO notifications (user_id, message) VALUES (?, ?)').run(
    technicianId,
    `You were assigned ticket ${ticket.ticket_code}`
  );

  res.json({ success: true });
});

app.put('/api/tickets/:id/status', authMiddleware, requireRole('technician', 'admin'), (req, res) => {
  const ticketId = Number(req.params.id);
  const { status } = req.body;

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  if (req.user.role === 'technician' && ticket.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'You can only update your assigned tickets' });
  }

  db.prepare('UPDATE tickets SET status = ?, resolved_at = CASE WHEN ? = \"Closed\" THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id = ?').run(status, status, ticketId);
  touchTicket(ticketId);

  db.prepare('INSERT INTO notifications (user_id, message) VALUES (?, ?)').run(
    ticket.created_by,
    `Your ticket ${ticket.ticket_code} status changed to ${status}`
  );

  res.json({ success: true });
});

app.post('/api/tickets/:id/comments', authMiddleware, requireRole('technician', 'admin'), (req, res) => {
  const ticketId = Number(req.params.id);
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ message: 'Comment is required' });

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  if (req.user.role === 'technician' && ticket.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'You can only comment on your assigned tickets' });
  }

  db.prepare('INSERT INTO comments (ticket_id, user_id, comment) VALUES (?, ?, ?)').run(ticketId, req.user.id, comment);
  touchTicket(ticketId);

  db.prepare('INSERT INTO notifications (user_id, message) VALUES (?, ?)').run(
    ticket.created_by,
    `New update on ${ticket.ticket_code}: ${comment.slice(0, 60)}`
  );

  res.status(201).json({ success: true });
});

app.get('/api/tickets/:id/comments', authMiddleware, (req, res) => {
  const ticketId = Number(req.params.id);

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (req.user.role === 'technician' && ticket.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const comments = db
    .prepare(
      `SELECT c.*, u.full_name as user_name, u.role
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.ticket_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(ticketId);

  res.json(comments);
});

app.get('/api/technicians', authMiddleware, requireRole('admin'), (_, res) => {
  const rows = db.prepare("SELECT id, full_name FROM users WHERE role = 'technician' ORDER BY full_name").all();
  res.json(rows);
});

app.get('/api/notifications', authMiddleware, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
    .all(req.user.id);
  res.json(rows);
});

app.put('/api/notifications/read-all', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
