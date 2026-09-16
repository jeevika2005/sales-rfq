"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Pencil, Power, Trash2, KeyRound } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/ActionsMenu";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

type DataScope = "CREATED" | "ASSIGNED" | "ALL";

type Role = {
  id: string;
  name: string;
  dataScope: DataScope;
  active: boolean;
  createdAt: string;
};

const DATA_SCOPES: DataScope[] = ["CREATED", "ASSIGNED", "ALL"];
const PAGE_SIZE = 10;

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadRoles() {
    try {
      const response = await fetch("/api/roles");
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setRoles(result.data);
      setError(null);
    } catch {
      setError("Failed to load roles.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadRoles();
  }, []);

  const filteredRoles = useMemo(
    () => roles.filter((role) => role.name.toLowerCase().includes(search.toLowerCase())),
    [roles, search],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE));
  const pagedRoles = filteredRoles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreateModal() {
    setEditingRole(null);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(role: Role) {
    setEditingRole(role);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const body = {
      name: formData.get("name"),
      dataScope: formData.get("dataScope"),
    };

    try {
      const response = await fetch(editingRole ? `/api/roles/${editingRole.id}` : "/api/roles", {
        method: editingRole ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      setIsModalOpen(false);
      await loadRoles();
    } catch (exception) {
      setFormError(exception instanceof Error ? exception.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(role: Role) {
    await fetch(`/api/roles/${role.id}/status`, { method: "PATCH" });
    await loadRoles();
  }

  async function handleDelete(role: Role) {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    await loadRoles();
  }

  const columns: DataTableColumn<Role>[] = [
    {
      header: "Role Name",
      cell: (role) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-foreground">{role.name}</p>
            <p className="text-[10px] text-muted-foreground">ID: {role.id}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Data Scope",
      cell: (role) => (
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {role.dataScope}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (role) => (
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
            role.active ? "text-emerald-500" : "text-destructive"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${role.active ? "bg-emerald-500" : "bg-destructive"}`} />
          {role.active ? "active" : "inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Role Management</h2>
          <p className="text-xs text-muted-foreground">Create and manage system roles and permissions.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add New Role
        </button>
      </div>

      <DataTable
        data={pagedRoles}
        columns={columns}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search roles..."
        isLoading={isLoading}
        error={error}
        emptyMessage="No roles found."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        actions={(role) => (
          <ActionsMenu>
            <ActionsMenuItem onClick={() => router.push(`/permissions?roleId=${role.id}`)}>
              <KeyRound className="h-3.5 w-3.5" />
              Permissions
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => openEditModal(role)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => handleToggleStatus(role)}>
              <Power className="h-3.5 w-3.5" />
              Toggle status
            </ActionsMenuItem>
            <ActionsMenuItem destructive onClick={() => handleDelete(role)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </ActionsMenuItem>
          </ActionsMenu>
        )}
      />

      {isModalOpen ? (
        <Modal title={editingRole ? "Edit Role" : "Add Role"} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-[12px] font-medium text-foreground">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={editingRole?.name}
                placeholder="e.g. Sales Manager"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="dataScope" className="text-[12px] font-medium text-foreground">
                Data Scope
              </label>
              <select
                id="dataScope"
                name="dataScope"
                required
                defaultValue={editingRole?.dataScope ?? "CREATED"}
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              >
                {DATA_SCOPES.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
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
              {isSaving ? "Saving…" : editingRole ? "Save changes" : "Create role"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
