"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Power } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/ActionsMenu";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

type LeftMenu = {
  id: string;
  menuKey: string;
  name: string;
  icon: string | null;
  url: string | null;
  isParent: boolean;
  parentId: string | null;
  parent: { name: string } | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type DropdownOption = {
  id: string;
  name: string;
  isParent: boolean;
};

const PAGE_SIZE = 10;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LeftMenuPage() {
  const [menus, setMenus] = useState<LeftMenu[]>([]);
  const [parentOptions, setParentOptions] = useState<DropdownOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editingMenu, setEditingMenu] = useState<LeftMenu | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isParentChecked, setIsParentChecked] = useState(false);

  async function loadMenus() {
    try {
      const [listResponse, dropdownResponse] = await Promise.all([
        fetch("/api/left-menu"),
        fetch("/api/left-menu/dropdown"),
      ]);
      const listResult = await listResponse.json();
      const dropdownResult = await dropdownResponse.json();
      if (!listResult.success) throw new Error(listResult.message);
      setMenus(listResult.data);
      setParentOptions(dropdownResult.success ? dropdownResult.data.filter((m: DropdownOption) => m.isParent) : []);
      setError(null);
    } catch {
      setError("Failed to load left menu.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadMenus();
  }, []);

  const filteredMenus = useMemo(
    () =>
      menus.filter(
        (menu) =>
          menu.name.toLowerCase().includes(search.toLowerCase()) ||
          menu.menuKey.toLowerCase().includes(search.toLowerCase()),
      ),
    [menus, search],
  );
  const totalPages = Math.max(1, Math.ceil(filteredMenus.length / PAGE_SIZE));
  const pagedMenus = filteredMenus.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreateModal() {
    setEditingMenu(null);
    setIsParentChecked(false);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(menu: LeftMenu) {
    setEditingMenu(menu);
    setIsParentChecked(menu.isParent);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const isParent = formData.get("isParent") === "on";
    const parentId = formData.get("parentId");

    const body = {
      menuKey: formData.get("menuKey"),
      name: formData.get("name"),
      icon: formData.get("icon") || undefined,
      url: formData.get("url") || undefined,
      isParent,
      parentId: isParent || !parentId ? undefined : parentId,
    };

    try {
      const response = await fetch(editingMenu ? `/api/left-menu/${editingMenu.id}` : "/api/left-menu", {
        method: editingMenu ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      setIsModalOpen(false);
      await loadMenus();
    } catch (exception) {
      setFormError(exception instanceof Error ? exception.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(menu: LeftMenu) {
    await fetch(`/api/left-menu/${menu.id}/status`, { method: "PATCH" });
    await loadMenus();
  }

  async function handleDelete(menu: LeftMenu) {
    if (!confirm(`Delete menu "${menu.name}"?`)) return;
    await fetch(`/api/left-menu/${menu.id}`, { method: "DELETE" });
    await loadMenus();
  }

  const columns: DataTableColumn<LeftMenu>[] = [
    { header: "Menu Name", cell: (menu) => <span className="font-medium text-foreground">{menu.name}</span> },
    { header: "Menu Key", cell: (menu) => <span className="text-muted-foreground">{menu.menuKey}</span> },
    { header: "URL", cell: (menu) => <span className="text-muted-foreground">{menu.url ?? "—"}</span> },
    { header: "Icon", cell: (menu) => <span className="text-muted-foreground">{menu.icon ?? "—"}</span> },
    { header: "Parent", cell: (menu) => <span className="text-muted-foreground">{menu.parent?.name ?? "—"}</span> },
    {
      header: "Is Parent",
      cell: (menu) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            menu.isParent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {menu.isParent ? "Yes" : "No"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (menu) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            menu.active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
          }`}
        >
          {menu.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    { header: "Created", cell: (menu) => <span className="text-muted-foreground">{formatDate(menu.createdAt)}</span> },
    { header: "Updated", cell: (menu) => <span className="text-muted-foreground">{formatDate(menu.updatedAt)}</span> },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Left Menus</h2>
          <p className="text-xs text-muted-foreground">Manage your dynamic sidebar navigation.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Menu
        </button>
      </div>

      <DataTable
        data={pagedMenus}
        columns={columns}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search menus..."
        isLoading={isLoading}
        error={error}
        emptyMessage="No menu entries found."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        actions={(menu) => (
          <ActionsMenu>
            <ActionsMenuItem onClick={() => openEditModal(menu)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => handleToggleStatus(menu)}>
              <Power className="h-3.5 w-3.5" />
              Toggle status
            </ActionsMenuItem>
            <ActionsMenuItem destructive onClick={() => handleDelete(menu)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </ActionsMenuItem>
          </ActionsMenu>
        )}
      />

      {isModalOpen ? (
        <Modal title={editingMenu ? "Edit Menu" : "Add Menu"} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="menuKey" className="text-[12px] font-medium text-foreground">
                Menu Key
              </label>
              <input
                id="menuKey"
                name="menuKey"
                type="text"
                required
                defaultValue={editingMenu?.menuKey}
                placeholder="e.g. customers"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-[12px] font-medium text-foreground">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={editingMenu?.name}
                placeholder="e.g. Customers"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="icon" className="text-[12px] font-medium text-foreground">
                  Icon
                </label>
                <input
                  id="icon"
                  name="icon"
                  type="text"
                  defaultValue={editingMenu?.icon ?? ""}
                  placeholder="optional"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="url" className="text-[12px] font-medium text-foreground">
                  URL
                </label>
                <input
                  id="url"
                  name="url"
                  type="text"
                  defaultValue={editingMenu?.url ?? ""}
                  placeholder="optional"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[12px] font-medium text-foreground">
              <input
                type="checkbox"
                name="isParent"
                checked={isParentChecked}
                onChange={(event) => setIsParentChecked(event.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              This is a parent menu
            </label>

            {!isParentChecked ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="parentId" className="text-[12px] font-medium text-foreground">
                  Parent Menu
                </label>
                <select
                  id="parentId"
                  name="parentId"
                  defaultValue={editingMenu?.parentId ?? ""}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                >
                  <option value="">None</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

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
              {isSaving ? "Saving…" : editingMenu ? "Save changes" : "Create menu"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
