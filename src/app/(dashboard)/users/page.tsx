"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, UserCog, Pencil, Power, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/ActionsMenu";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

type UserRole = "admin" | "manager" | "sales" | "viewer";

type User = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
};

const USER_ROLES: UserRole[] = ["admin", "manager", "sales", "viewer"];
const PAGE_SIZE = 10;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadUsers() {
    try {
      const response = await fetch("/api/users");
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setUsers(result.data);
      setError(null);
    } catch {
      setError("Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadUsers();
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.fullName.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [users, search],
  );
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreateModal() {
    setEditingUser(null);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const body = {
      email: formData.get("email"),
      fullName: formData.get("fullName"),
      role: formData.get("role"),
      ...(password ? { password } : {}),
    };

    try {
      const response = await fetch(editingUser ? `/api/users/${editingUser.id}` : "/api/users", {
        method: editingUser ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      setIsModalOpen(false);
      await loadUsers();
    } catch (exception) {
      setFormError(exception instanceof Error ? exception.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(user: User) {
    const response = await fetch(`/api/users/${user.id}/status`, { method: "PATCH" });
    const result = await response.json();
    if (!result.success) {
      alert(result.message);
      return;
    }
    await loadUsers();
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.fullName}"?`)) return;
    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.success) {
      alert(result.message);
      return;
    }
    await loadUsers();
  }

  const columns: DataTableColumn<User>[] = [
    {
      header: "User",
      cell: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCog className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-foreground">{user.fullName}</p>
            <p className="text-[10px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Role",
      cell: (user) => (
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {user.role}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (user) => (
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
            user.active ? "text-emerald-500" : "text-destructive"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${user.active ? "bg-emerald-500" : "bg-destructive"}`} />
          {user.active ? "active" : "inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">User Management</h2>
          <p className="text-xs text-muted-foreground">Create and manage system users and their roles.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add New User
        </button>
      </div>

      <DataTable
        data={pagedUsers}
        columns={columns}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search users..."
        isLoading={isLoading}
        error={error}
        emptyMessage="No users found."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        actions={(user) => (
          <ActionsMenu>
            <ActionsMenuItem onClick={() => openEditModal(user)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => handleToggleStatus(user)}>
              <Power className="h-3.5 w-3.5" />
              Toggle status
            </ActionsMenuItem>
            <ActionsMenuItem destructive onClick={() => handleDelete(user)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </ActionsMenuItem>
          </ActionsMenu>
        )}
      />

      {isModalOpen ? (
        <Modal title={editingUser ? "Edit User" : "Add User"} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-[12px] font-medium text-foreground">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                defaultValue={editingUser?.fullName}
                placeholder="e.g. Jane Doe"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[12px] font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={editingUser?.email}
                placeholder="you@company.com"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-[12px] font-medium text-foreground">
                Role
              </label>
              <select
                id="role"
                name="role"
                required
                defaultValue={editingUser?.role ?? "viewer"}
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[12px] font-medium text-foreground">
                Password {editingUser ? <span className="text-muted-foreground">(leave blank to keep)</span> : null}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required={!editingUser}
                minLength={8}
                placeholder="••••••••"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            {formError ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="mt-2 rounded-lg bg-primary py-2.5 text-[12px] font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : editingUser ? "Save changes" : "Create user"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
