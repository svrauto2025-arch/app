import React from 'react';
import { ClipboardList, LayoutDashboard, UserCog, Users, Wrench, LogOut } from 'lucide-react';

const icons = {
  dashboard: <LayoutDashboard size={18} />,
  tickets: <ClipboardList size={18} />,
  users: <Users size={18} />,
  manage: <UserCog size={18} />,
  technician: <Wrench size={18} />
};

function Sidebar({ menuItems, current, onChange, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div>
        <h2>Ticket Desk</h2>
        <p>{user.fullName}</p>
        <span className="role-badge">{user.role}</span>
      </div>
      <nav>
        {menuItems.map((item) => (
          <button
            type="button"
            className={`sidebar-btn ${current === item.key ? 'active' : ''}`}
            key={item.key}
            onClick={() => onChange(item.key)}
          >
            {icons[item.icon]}
            {item.label}
          </button>
        ))}
      </nav>
      <button className="logout-btn" type="button" onClick={onLogout}>
        <LogOut size={16} /> Logout
      </button>
    </aside>
  );
}

export default Sidebar;
