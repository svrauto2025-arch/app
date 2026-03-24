import React, { useContext, useState } from 'react';
import api from '../api';
import { AuthContext } from '../App';

function LoginPage() {
  const { login } = useContext(AuthContext);
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      login(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>Ticket Management System</h1>
        <p>Sign in to continue</p>
        <input
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit">Login</button>

        <div className="hint">
          Demo users: admin/admin123, tech1/tech123, user1/user123
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
