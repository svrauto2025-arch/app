import React from 'react';
import { Bell } from 'lucide-react';

function NotificationBell({ notifications, onMarkRead }) {
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="notify-wrap">
      <button className="notify-btn" type="button" onClick={onMarkRead} title="Mark all as read">
        <Bell size={18} />
        {unread > 0 && <span className="notify-dot">{unread}</span>}
      </button>
      <div className="notify-list">
        {notifications.slice(0, 5).map((n) => (
          <div key={n.id} className={`notify-item ${n.is_read ? '' : 'unread'}`}>
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationBell;
