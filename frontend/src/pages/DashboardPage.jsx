import React, { useContext, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import api from '../api';
import { AuthContext } from '../App';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';

const statusOptions = ['Open', 'In Progress', 'Closed'];

function DashboardPage() {
  const { auth, logout } = useContext(AuthContext);
  const { user } = auth;

  const [currentTab, setCurrentTab] = useState(user.role === 'technician' ? 'tickets' : 'dashboard');
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0, unassigned: 0 });
  const [techs, setTechs] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [alertMsg, setAlertMsg] = useState('');
  const [commentText, setCommentText] = useState('');

  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'Medium', attachment: null });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'user', fullName: '' });

  const menuItems = useMemo(() => {
    if (user.role === 'admin') {
      return [
        { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { key: 'tickets', label: 'All Tickets', icon: 'tickets' },
        { key: 'users', label: 'Manage Users', icon: 'manage' }
      ];
    }

    if (user.role === 'technician') {
      return [{ key: 'tickets', label: 'Assigned Tickets', icon: 'technician' }];
    }

    return [
      { key: 'dashboard', label: 'New Ticket', icon: 'dashboard' },
      { key: 'tickets', label: 'My Tickets', icon: 'tickets' }
    ];
  }, [user.role]);

  const loadData = async () => {
    const [ticketRes, notifyRes] = await Promise.all([api.get('/tickets'), api.get('/notifications')]);
    setTickets(ticketRes.data);
    setNotifications(notifyRes.data);

    if (user.role === 'admin') {
      const [statsRes, techRes, userRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/technicians'),
        api.get('/users')
      ]);
      setStats(statsRes.data);
      setTechs(techRes.data);
      setUsers(userRes.data);
    }
  };

  useEffect(() => {
    loadData().catch(() => setAlertMsg('Failed to load data'));
    const iv = setInterval(() => loadData().catch(() => null), 12000);
    return () => clearInterval(iv);
  }, []);

  const createTicket = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries(ticketForm).forEach(([k, v]) => v && formData.append(k, v));

    await api.post('/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    setTicketForm({ title: '', description: '', priority: 'Medium', attachment: null });
    setAlertMsg('Ticket created successfully.');
    await loadData();
  };

  const assignTicket = async (ticketId, technicianId) => {
    await api.put(`/tickets/${ticketId}/assign`, { technicianId: Number(technicianId) });
    setAlertMsg('Ticket assigned.');
    await loadData();
  };

  const updateStatus = async (ticketId, status) => {
    await api.put(`/tickets/${ticketId}/status`, { status });
    setAlertMsg('Ticket status updated.');
    await loadData();
  };

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    const { data } = await api.get(`/tickets/${ticket.id}/comments`);
    setComments(data);
  };

  const addComment = async () => {
    if (!selectedTicket || !commentText.trim()) return;
    await api.post(`/tickets/${selectedTicket.id}/comments`, { comment: commentText });
    setCommentText('');
    await openTicket(selectedTicket);
    await loadData();
  };

  const createUser = async (e) => {
    e.preventDefault();
    await api.post('/users', newUserForm);
    setNewUserForm({ username: '', password: '', role: 'user', fullName: '' });
    setAlertMsg('User created.');
    await loadData();
  };

  const markRead = async () => {
    await api.put('/notifications/read-all');
    await loadData();
  };

  const updateUser = async (id, fullName, role) => {
    await api.put(`/users/${id}`, { fullName, role });
    setAlertMsg('User updated.');
    await loadData();
  };

  const deleteUser = async (id) => {
    await api.delete(`/users/${id}`);
    setAlertMsg('User deleted.');
    await loadData();
  };

  return (
    <div className="app-layout">
      <Sidebar menuItems={menuItems} current={currentTab} onChange={setCurrentTab} user={user} onLogout={logout} />
      <main className="content">
        <header className="topbar">
          <h1>{currentTab === 'users' ? 'User Management' : 'Ticket Workspace'}</h1>
          <NotificationBell notifications={notifications} onMarkRead={markRead} />
        </header>

        {alertMsg && <div className="alert">{alertMsg}</div>}

        {user.role === 'admin' && currentTab === 'dashboard' && (
          <section className="stats-grid">
            <StatCard title="Total Tickets" value={stats.total} />
            <StatCard title="Pending" value={stats.pending} />
            <StatCard title="Resolved" value={stats.resolved} />
            <StatCard title="Unassigned" value={stats.unassigned} />
          </section>
        )}

        {user.role === 'user' && currentTab === 'dashboard' && (
          <section className="card">
            <h3>Create New Ticket</h3>
            <form onSubmit={createTicket} className="form-grid">
              <input
                placeholder="Title"
                value={ticketForm.title}
                onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                required
              />
              <select value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
              <textarea
                rows={4}
                placeholder="Description"
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                required
              />
              <input type="file" onChange={(e) => setTicketForm({ ...ticketForm, attachment: e.target.files[0] })} />
              <button type="submit">Submit Ticket</button>
            </form>
          </section>
        )}

        {currentTab === 'users' && user.role === 'admin' && (
          <section className="card">
            <h3>Add User</h3>
            <form className="form-grid" onSubmit={createUser}>
              <input
                placeholder="Full Name"
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                required
              />
              <input
                placeholder="Username"
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                required
              />
              <input
                placeholder="Password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                required
              />
              <select value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}>
                <option value="user">User</option>
                <option value="technician">Technician</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit">Create User</button>
            </form>

            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <input
                        defaultValue={u.full_name}
                        onBlur={(e) => updateUser(u.id, e.target.value, u.role)}
                        disabled={u.id === user.id}
                      />
                    </td>
                    <td>{u.username}</td>
                    <td>
                      <select
                        value={u.role}
                        disabled={u.id === user.id}
                        onChange={(e) => updateUser(u.id, u.full_name, e.target.value)}
                      >
                        <option value="user">user</option>
                        <option value="technician">technician</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{dayjs(u.created_at).format('DD MMM YYYY')}</td>
                    <td>
                      <button type="button" onClick={() => deleteUser(u.id)} disabled={u.id === user.id}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {currentTab === 'tickets' && (
          <section className="card">
            <h3>{user.role === 'admin' ? 'All Tickets' : 'Ticket List'}</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>{t.ticket_code}</td>
                    <td>{t.title}</td>
                    <td>{t.priority}</td>
                    <td>{t.status}</td>
                    <td>{t.assigned_to_name || 'Unassigned'}</td>
                    <td>{dayjs(t.created_at).format('DD MMM YY, HH:mm')}</td>
                    <td>{dayjs(t.updated_at).format('DD MMM YY, HH:mm')}</td>
                    <td>
                      <div className="actions">
                        <button type="button" onClick={() => openTicket(t)}>
                          View
                        </button>
                        {user.role === 'admin' && (
                          <select onChange={(e) => assignTicket(t.id, e.target.value)} value={t.assigned_to || ''}>
                            <option value="">Assign</option>
                            {techs.map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                {tech.full_name}
                              </option>
                            ))}
                          </select>
                        )}
                        {(user.role === 'technician' || user.role === 'admin') && (
                          <select onChange={(e) => updateStatus(t.id, e.target.value)} value={t.status}>
                            {statusOptions.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        )}
                        {t.attachment_path && (
                          <a href={`http://localhost:3001${t.attachment_path}`} target="_blank" rel="noreferrer">
                            File
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {selectedTicket && (
          <section className="card">
            <h3>
              {selectedTicket.ticket_code} - {selectedTicket.title}
            </h3>
            <p>{selectedTicket.description}</p>
            <div className="comment-box">
              <strong>Comments / Solutions</strong>
              {comments.map((c) => (
                <div key={c.id} className="comment-item">
                  <b>{c.user_name}</b> ({c.role}) - {dayjs(c.created_at).format('DD MMM HH:mm')}
                  <p>{c.comment}</p>
                </div>
              ))}
            </div>

            {(user.role === 'technician' || user.role === 'admin') && (
              <div className="form-inline">
                <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add solution / comment" />
                <button type="button" onClick={addComment}>
                  Add
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <article className="card stat-card">
      <h4>{title}</h4>
      <p>{value}</p>
    </article>
  );
}

export default DashboardPage;
