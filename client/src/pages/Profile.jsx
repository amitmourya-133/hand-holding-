import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, Card, FormGroup, Input, Textarea, Avatar } from '../components/ui.jsx';

export default function Profile() {
  const { user, setUser, logout, notifications, unread, markAllRead } = useAuth();

  const [name, setName] = useState('');
  const [mentorType, setMentorType] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');
  const [skills, setSkills] = useState('');
  const [availability, setAvailability] = useState(user.availability || 'available');
  const [bio, setBio] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState({ old: '', new: '', confirm: '' });
  const [pwNotice, setPwNotice] = useState('');
  const [adminSettings, setAdminSettings] = useState({ success: false, error: '', submitting: false });
  const [currentPasswordSetting, setCurrentPasswordSetting] = useState('');
  const [newEmailSetting, setNewEmailSetting] = useState('');
  const [newPasswordSetting, setNewPasswordSetting] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setMentorType(user.mentorType || '');
    setDepartment(user.department || '');
    setBatch(user.batch || '');
    setCompany(user.company || '');
    setDesignation(user.designation || '');
    setSkills(user.skills ? user.skills.join(', ') : '');
    setAvailability(user.availability || 'available');
    setBio(user.bio || '');
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const d = await api('/users/profile', {
        method: 'PUT',
        body: {
          name: name.trim() || undefined,
          mentorType: user.role === 'mentor' ? mentorType : undefined,
          department: department.trim() || undefined,
          batch: batch.trim() || undefined,
          company: company.trim() || undefined,
          designation: designation.trim() || undefined,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
          bio: bio.trim() || undefined,
        },
      });
      if (d?.user) setUser(d.user);
      setNotice('Profile updated successfully');
    } catch (err) {
      setError(err?.message || 'Update failed');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwNotice('');
    if (changePassword.new !== changePassword.confirm) {
      setPwNotice('Passwords do not match');
      return;
    }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { oldPassword: changePassword.old, newPassword: changePassword.new },
      });
      setChangePassword({ old: '', new: '', confirm: '' });
      setPwNotice('Password changed successfully');
    } catch (err) {
      setPwNotice(err?.message || 'Change failed');
    }
  };

  const handleAdminSettings = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const d = await api('/users/settings', {
        method: 'PUT',
        body: {
          currentPassword: currentPasswordSetting,
          newEmail: newEmailSetting,
          newPassword: newPasswordSetting,
        },
      });
      if (d?.ok) setNotice('Account settings updated successfully');
      setError(d?.error || '');
    } catch (err) {
      setError(err?.message || 'Failed to update account settings');
    }
  };

  if (!user) return null;
  const role = user.role;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Profile</h2>
        <p className="muted">Manage your account details.</p>
      </div>

      <div className="row">
        <div className="col-12 col-md-6">
          <Card>
            <div className="d-flex align-items-center gap-3 mb-3">
              <Avatar user={user} size={56} />
              <div>
                <h3>{user.name}</h3>
                <p className="muted small">
                  {user.email} · <span className="badge badge-blue">{role}</span>
                </p>
              </div>
            </div>
            <form onSubmit={handleUpdate}>
              {notice && <p className="text-success small">{notice}</p>}
              {error && <p className="text-danger small">{error}</p>}
              <FormGroup>
                <Input label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </FormGroup>
              <FormGroup>
                <Input label="Email (contact admin to change)" type="email" value={user.email} readOnly />
              </FormGroup>
              {role === 'mentor' && (
                <FormGroup>
                  <label className="input-label">Mentor Type</label>
                  <select className="input" value={mentorType} onChange={(e) => setMentorType(e.target.value)}>
                    <option value="faculty">Faculty</option>
                    <option value="alumni">Alumni</option>
                    <option value="industry">Industry</option>
                  </select>
                </FormGroup>
              )}
              <FormGroup>
                <Input label="Department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </FormGroup>
              <FormGroup>
                <Input label="Batch / Graduation Year" type="text" value={batch} onChange={(e) => setBatch(e.target.value)} />
              </FormGroup>
              {role === 'mentor' && (
                <>
                  <FormGroup>
                    <Input label="Company / Organization" type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </FormGroup>
                  <FormGroup>
                    <Input label="Designation / Title" type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} />
                  </FormGroup>
                </>
              )}
              <FormGroup>
                <Input label="Skills (comma separated)" type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g., Leadership, Coaching" />
              </FormGroup>
              <FormGroup>
                <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell us about yourself" />
              </FormGroup>
              <Button type="submit" className="button button-primary w-full">Save Changes</Button>
            </form>
          </Card>

          <Card>
            <h3>Security</h3>
            <p className="muted small">Change your password.</p>
            <form onSubmit={handleChangePassword} className="mt-3">
              {pwNotice && (
                <p className={`small ${pwNotice.includes('success') ? 'text-success' : 'text-danger'}`}>{pwNotice}</p>
              )}
              <FormGroup>
                <Input
                  label="Old Password"
                  type="password"
                  required
                  value={changePassword.old}
                  onChange={(e) => setChangePassword({ ...changePassword, old: e.target.value })}
                />
              </FormGroup>
              <FormGroup>
                <Input
                  label="New Password"
                  type="password"
                  required
                  minLength={6}
                  value={changePassword.new}
                  onChange={(e) => setChangePassword({ ...changePassword, new: e.target.value })}
                />
              </FormGroup>
              <FormGroup>
                <Input
                  label="Confirm New Password"
                  type="password"
                  required
                  value={changePassword.confirm}
                  onChange={(e) => setChangePassword({ ...changePassword, confirm: e.target.value })}
                />
              </FormGroup>
              <Button type="submit" className="button button-primary w-full">Change Password</Button>
            </form>
          </Card>
        </div>

        {user.role === 'admin' && (
          <div className="row">
            <div className="col-12">
              <Card>
                <h3>Admin Account Settings</h3>
                <p className="muted small">Update your email address and password.</p>
                {adminSettings.submitting && <p className="text-info small">Saving…</p>}
                {adminSettings.error && <p className="text-danger small">{adminSettings.error}</p>}
                {adminSettings.success && <p className="text-success small">{adminSettings.success}</p>}
                <form onSubmit={handleAdminSettings} className="mt-3">
                  <FormGroup>
                    <Input
                      label="Current Password"
                      type="password"
                      required
                      value={currentPasswordSetting}
                      onChange={(e) => setCurrentPasswordSetting(e.target.value)}
                    />
                  </FormGroup>
                  <FormGroup>
                    <Input
                      label="New Email"
                      type="email"
                      value={newEmailSetting}
                      onChange={(e) => setNewEmailSetting(e.target.value)}
                      placeholder="Enter new email address"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Input
                      label="New Password"
                      type="password"
                      minLength={6}
                      value={newPasswordSetting}
                      onChange={(e) => setNewPasswordSetting(e.target.value)}
                      placeholder="Enter new password (leave blank to keep current)"
                    />
                    <small className="muted small">Leave blank to keep current password</small>
                  </FormGroup>
                  <Button type="submit" className="button button-primary w-full">Save Settings</Button>
                </form>
              </Card>
            </div>
          </div>
        )}

        <div className="col-12 col-md-6">
          <Card>
            <div className="d-flex justify-content-between align-items-center">
              <h3>Notifications</h3>
              <span className="muted small">Unread: {unread}</span>
            </div>
            {notifications.length === 0 ? (
              <p className="muted small mt-2">No notifications yet.</p>
            ) : (
              <ul className="list-unstyled mt-2">
                {notifications.slice(0, 10).map((n, i) => (
                  <li key={n._id || i} className="mb-2" style={{ opacity: n.read ? 0.65 : 1 }}>
                    <strong className="small">{n.title}</strong>
                    <p className="muted xsmall">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <Button button-small onClick={() => markAllRead()}>Mark All Read</Button>
          </Card>

          <Card>
            <h3>Account</h3>
            <p className="muted small">Signed in as {user.email}.</p>
            <Button button-danger w-100 onClick={() => logout()}>Logout</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
