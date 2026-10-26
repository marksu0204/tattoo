import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, RefreshCw, Shield, UserCog, UserX } from 'lucide-react';
import { db } from '../services/mockBackend';
import { useAdminBrand } from '../context/AdminBrandContext';
import type { AdminUserListItem } from '../types';

type ModalMode = 'create' | 'edit' | 'resetPassword' | null;

const emptyCreateForm = () => ({
  email: '',
  displayName: '',
  password: '',
  brandCodes: [] as string[],
});

const AdminUsersPanel: React.FC = () => {
  const { admin, accessibleBrands } = useAdminBrand();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({ displayName: '', brandCodes: [] as string[], isActive: true });
  const [resetPassword, setResetPassword] = useState('');

  const brandOptions = useMemo(
    () => accessibleBrands.map((b) => ({ code: b.code, name: b.name, isActive: b.isActive })),
    [accessibleBrands]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await db.getAdminUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法載入管理員列表');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const toggleBrandCode = (codes: string[], code: string): string[] => {
    return codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm());
    setModalMode('create');
  };

  const openEdit = (user: AdminUserListItem) => {
    setSelectedUser(user);
    setEditForm({
      displayName: user.displayName,
      brandCodes: user.accessibleBrands.map((b) => b.code),
      isActive: user.isActive,
    });
    setModalMode('edit');
  };

  const openResetPassword = (user: AdminUserListItem) => {
    setSelectedUser(user);
    setResetPassword('');
    setModalMode('resetPassword');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setResetPassword('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.brandCodes.length === 0) {
      alert('請至少選擇一個品牌');
      return;
    }
    setSaving(true);
    try {
      await db.createAdminUser({
        email: createForm.email,
        displayName: createForm.displayName,
        password: createForm.password,
        brandCodes: createForm.brandCodes,
      });
      closeModal();
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!selectedUser.isSuperAdmin && editForm.brandCodes.length === 0) {
      alert('請至少選擇一個品牌');
      return;
    }
    setSaving(true);
    try {
      await db.updateAdminUser({
        id: selectedUser.id,
        displayName: editForm.displayName,
        ...(selectedUser.isSuperAdmin ? {} : { brandCodes: editForm.brandCodes }),
        isActive: editForm.isActive,
      });
      closeModal();
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !resetPassword) return;
    setSaving(true);
    try {
      await db.resetAdminPassword({ id: selectedUser.id, password: resetPassword });
      closeModal();
      alert('密碼已重設，該帳號需重新登入');
    } catch (err) {
      alert(err instanceof Error ? err.message : '重設密碼失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: AdminUserListItem) => {
    const nextActive = !user.isActive;
    const label = nextActive ? '啟用' : '停用';
    if (!window.confirm(`確定要${label}「${user.email}」？${nextActive ? '' : ' 停用後現有登入會立即失效。'}`)) {
      return;
    }
    setSaving(true);
    try {
      await db.setAdminUserActive({ id: user.id, isActive: nextActive });
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : `${label}失敗`);
    } finally {
      setSaving(false);
    }
  };

  const isSelf = (user: AdminUserListItem) => admin?.id === user.id;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCog size={20} className="text-primary" />
            管理員帳號
          </h2>
          <p className="text-sm text-gray-400 mt-1">SUPER_ADMIN 專用 — 建立與管理品牌管理員</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading || saving}
            className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className="inline mr-1" />
            重新整理
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-black font-bold hover:bg-yellow-500 disabled:opacity-50"
          >
            <Plus size={16} className="inline mr-1" />
            新增管理員
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">載入中…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">顯示名稱</th>
                <th className="px-4 py-3 text-left">角色</th>
                <th className="px-4 py-3 text-left">品牌</th>
                <th className="px-4 py-3 text-left">狀態</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{user.email}</td>
                  <td className="px-4 py-3 text-gray-200">{user.displayName}</td>
                  <td className="px-4 py-3">
                    {user.isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Shield size={14} /> SUPER_ADMIN
                      </span>
                    ) : (
                      <span className="text-gray-300">BRAND_ADMIN</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {user.accessibleBrands.map((b) => b.name).join('、') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={user.isActive ? 'text-emerald-400' : 'text-gray-500'}>
                      {user.isActive ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        disabled={saving}
                        className="p-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                        title="編輯"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openResetPassword(user)}
                        disabled={saving}
                        className="p-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                        title="重設密碼"
                      >
                        <KeyRound size={15} />
                      </button>
                      {!isSelf(user) && (
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(user)}
                          disabled={saving}
                          className="p-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                          title={user.isActive ? '停用' : '啟用'}
                        >
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    尚無管理員資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalMode === 'create' && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={(e) => void handleCreate(e)} className="w-full max-w-lg bg-card border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">新增品牌管理員</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-400">Email</span>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">顯示名稱</span>
                <input
                  required
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="mt-1 w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">初始密碼</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className="mt-1 w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
              <fieldset>
                <legend className="text-sm text-gray-400 mb-2">可管理品牌（至少一個）</legend>
                <div className="space-y-2">
                  {brandOptions.map((brand) => (
                    <label key={brand.code} className="flex items-center gap-2 text-gray-200">
                      <input
                        type="checkbox"
                        checked={createForm.brandCodes.includes(brand.code)}
                        onChange={() =>
                          setCreateForm((f) => ({
                            ...f,
                            brandCodes: toggleBrandCode(f.brandCodes, brand.code),
                          }))
                        }
                      />
                      {brand.name}
                      {!brand.isActive && <span className="text-xs text-gray-500">(inactive)</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800">
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-black font-bold disabled:opacity-50"
              >
                {saving ? '建立中…' : '建立'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalMode === 'edit' && selectedUser && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={(e) => void handleEdit(e)} className="w-full max-w-lg bg-card border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-1">編輯管理員</h3>
            <p className="text-sm text-gray-400 mb-4">{selectedUser.email}</p>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-400">顯示名稱</span>
                <input
                  required
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="mt-1 w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
              {!selectedUser.isSuperAdmin && (
                <fieldset>
                  <legend className="text-sm text-gray-400 mb-2">可管理品牌</legend>
                  <div className="space-y-2">
                    {brandOptions.map((brand) => (
                      <label key={brand.code} className="flex items-center gap-2 text-gray-200">
                        <input
                          type="checkbox"
                          checked={editForm.brandCodes.includes(brand.code)}
                          onChange={() =>
                            setEditForm((f) => ({
                              ...f,
                              brandCodes: toggleBrandCode(f.brandCodes, brand.code),
                            }))
                          }
                        />
                        {brand.name}
                        {!brand.isActive && <span className="text-xs text-gray-500">(inactive)</span>}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {!isSelf(selectedUser) && (
                <label className="flex items-center gap-2 text-gray-200">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  帳號啟用
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800">
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-black font-bold disabled:opacity-50"
              >
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalMode === 'resetPassword' && selectedUser && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={(e) => void handleResetPassword(e)} className="w-full max-w-md bg-card border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-1">重設密碼</h3>
            <p className="text-sm text-gray-400 mb-4">{selectedUser.email}</p>
            <label className="block">
              <span className="text-sm text-gray-400">新密碼</span>
              <input
                type="password"
                required
                minLength={8}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="mt-1 w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </label>
            <p className="text-xs text-amber-300/80 mt-2">重設後該帳號所有登入 session 會立即失效。</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800">
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-black font-bold disabled:opacity-50"
              >
                {saving ? '重設中…' : '重設密碼'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPanel;
