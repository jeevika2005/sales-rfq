"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Building2, Pencil, Archive, ArchiveRestore } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/ActionsMenu";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/providers/ToastProvider";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyCode: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
};

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadCustomers() {
    try {
      // Management view shows archived customers too (with an Unarchive
      // action) — a customer picker elsewhere should omit this param so
      // archived customers never surface as quote-creation options.
      const response = await fetch("/api/customers?includeArchived=true");
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setCustomers(result.data);
      setError(null);
    } catch {
      setError("Failed to load customers.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(search.toLowerCase()) ||
          (customer.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (customer.companyCode ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [customers, search],
  );
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const pagedCustomers = filteredCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreateModal() {
    setEditingCustomer(null);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const phone = formData.get("phone");
    const companyCode = formData.get("companyCode");
    const notes = formData.get("notes");
    const body = {
      name: formData.get("name"),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(companyCode ? { companyCode } : {}),
      ...(notes ? { notes } : {}),
    };

    try {
      const response = await fetch(editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers", {
        method: editingCustomer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      showToast("success", editingCustomer ? "Customer updated successfully" : "Customer created successfully");
      setIsModalOpen(false);
      await loadCustomers();
    } catch (exception) {
      setFormError(exception instanceof Error ? exception.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleArchived(customer: Customer) {
    setActionError(null);
    const response = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !customer.archived }),
    });
    const result = await response.json();
    if (!result.success) {
      setActionError(result.message);
      return;
    }
    showToast("success", customer.archived ? "Customer unarchived" : "Customer archived");
    await loadCustomers();
  }

  const columns: DataTableColumn<Customer>[] = [
    {
      header: "Customer",
      cell: (customer) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-foreground">{customer.name}</p>
            <p className="text-[10px] text-muted-foreground">{customer.email ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Phone",
      cell: (customer) => <span className="text-foreground">{customer.phone ?? "—"}</span>,
    },
    {
      header: "Company Code",
      cell: (customer) => <span className="text-foreground">{customer.companyCode ?? "—"}</span>,
    },
    {
      header: "Status",
      cell: (customer) => (
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
            customer.archived ? "text-destructive" : "text-emerald-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${customer.archived ? "bg-destructive" : "bg-emerald-500"}`} />
          {customer.archived ? "archived" : "active"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Customers</h2>
          <p className="text-xs text-muted-foreground">Manage customer records used when creating quotes.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {actionError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {actionError}
        </p>
      ) : null}

      <DataTable
        data={pagedCustomers}
        columns={columns}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search customers..."
        isLoading={isLoading}
        error={error}
        emptyMessage="No customers found."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        actions={(customer) => (
          <ActionsMenu>
            <ActionsMenuItem onClick={() => openEditModal(customer)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => handleToggleArchived(customer)}>
              {customer.archived ? (
                <ArchiveRestore className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {customer.archived ? "Unarchive" : "Archive"}
            </ActionsMenuItem>
          </ActionsMenu>
        )}
      />

      {isModalOpen ? (
        <Modal title={editingCustomer ? "Edit Customer" : "Add Customer"} onClose={() => setIsModalOpen(false)}>
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
                defaultValue={editingCustomer?.name}
                placeholder="e.g. Acme Industries"
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
                defaultValue={editingCustomer?.email ?? ""}
                placeholder="buyer@company.com"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-[12px] font-medium text-foreground">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                defaultValue={editingCustomer?.phone ?? ""}
                placeholder="+1 555 000 0000"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="companyCode" className="text-[12px] font-medium text-foreground">
                Company Code
              </label>
              <input
                id="companyCode"
                name="companyCode"
                type="text"
                defaultValue={editingCustomer?.companyCode ?? ""}
                placeholder="e.g. ACM-001"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="notes" className="text-[12px] font-medium text-foreground">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={editingCustomer?.notes ?? ""}
                placeholder="Optional internal notes"
                className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
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
              {isSaving ? "Saving…" : editingCustomer ? "Save changes" : "Create customer"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
