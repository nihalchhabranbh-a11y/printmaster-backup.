import { useMemo, useState } from "react";
import { db } from "./supabase.js";

const emptyForm = () => ({
  name: "",
  category: "product",
  itemCode: "",
  hsnCode: "",
  unit: "PCS",
  defaultRate: 0,
  taxRate: 0,
  purchasePrice: 0,
  openingStock: 0,
  stockAsOf: new Date().toISOString().slice(0, 10),
  size: "",
  description: "",
  active: true,
});

const fmtCur = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EnhancedProductsPage({ products, setProducts, showToast, user }) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      category: item.category || "product",
      itemCode: item.item_code || item.itemCode || "",
      hsnCode: item.hsn_code || item.hsnCode || "",
      unit: item.unit || "PCS",
      defaultRate: item.default_rate ?? item.defaultRate ?? 0,
      taxRate: item.tax_rate ?? item.taxRate ?? 0,
      purchasePrice: item.purchase_price ?? item.purchasePrice ?? 0,
      openingStock: item.opening_stock ?? item.openingStock ?? 0,
      stockAsOf: item.stock_as_of || item.stockAsOf || new Date().toISOString().slice(0, 10),
      size: item.size || "",
      description: item.description || "",
      active: item.active !== false,
    });
    setShowModal(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter((p) =>
      [p.name, p.item_code, p.itemCode, p.hsn_code, p.hsnCode, p.unit, p.size, p.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [products, search]);

  const save = async () => {
    if (!form.name.trim()) {
      showToast("Enter item name", "error");
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      itemCode: form.itemCode.trim() || null,
      hsnCode: form.hsnCode.trim() || null,
      unit: form.unit.trim().toUpperCase() || null,
      defaultRate: Number(form.defaultRate) || 0,
      taxRate: Number(form.taxRate) || 0,
      purchasePrice: Number(form.purchasePrice) || 0,
      openingStock: Number(form.openingStock) || 0,
      stockAsOf: form.stockAsOf || null,
      size: form.size.trim() || null,
      description: form.description.trim() || null,
      active: !!form.active,
      organisationId: user?.organisationId,
    };

    try {
      if (editing) {
        await db.updateProduct(editing.id, payload);
        setProducts((list) =>
          list.map((p) =>
            p.id === editing.id
              ? {
                  ...p,
                  ...payload,
                  item_code: payload.itemCode,
                  hsn_code: payload.hsnCode,
                  default_rate: payload.defaultRate,
                  tax_rate: payload.taxRate,
                  purchase_price: payload.purchasePrice,
                  opening_stock: payload.openingStock,
                  stock_as_of: payload.stockAsOf,
                }
              : p
          )
        );
        showToast("Item updated");
      } else {
        const created = await db.addProduct(payload);
        setProducts((list) => [created, ...list]);
        showToast("Item added");
      }
      setShowModal(false);
      resetForm();
    } catch (e) {
      showToast(e.message || "Failed to save item", "error");
    }
  };

  const archive = async (item) => {
    await db.updateProduct(item.id, { active: false });
    setProducts((list) => list.map((p) => (p.id === item.id ? { ...p, active: false } : p)));
    showToast("Item archived");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-bar" style={{ width: 300 }}>
          <input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openNew}>Create Item</button>
      </div>

      <div className="card">
        <div className="card-title">Items</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>HSN</th>
                <th>Stock QTY</th>
                <th>Selling Price</th>
                <th>Tax %</th>
                <th>Purchase Price</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 28, color: "var(--text3)" }}>
                    No items yet. Add your products/services with HSN code, unit, and prices.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--text3)" }}>{item.size || item.description || item.category || "product"}</div>
                    </td>
                    <td>{item.item_code || item.itemCode || "-"}</td>
                    <td>{item.hsn_code || item.hsnCode || "-"}</td>
                    <td>{`${Number(item.opening_stock ?? item.openingStock ?? 0) || 0} ${item.unit || ""}`.trim()}</td>
                    <td className="font-mono">{fmtCur(item.default_rate ?? item.defaultRate ?? 0)}</td>
                    <td>{Number(item.tax_rate ?? item.taxRate ?? 0)}%</td>
                    <td className="font-mono">{fmtCur(item.purchase_price ?? item.purchasePrice ?? 0)}</td>
                    <td>{item.unit || "-"}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(item)}>Edit</button>
                        {item.active !== false ? <button className="btn btn-sm btn-danger" onClick={() => archive(item)}>Archive</button> : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal ? (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && (setShowModal(false), resetForm())}>
          <div className="modal" style={{ maxWidth: 960 }}>
            <div className="modal-title">{editing ? "Edit Item" : "Create New Item"}</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Item Type *</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                </select>
              </div>
              <div className="form-group full">
                <label>Item Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Flex banner / Rubber stamp / Design work" />
              </div>
              <div className="form-group">
                <label>Item Code</label>
                <input value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value.toUpperCase() })} placeholder="ITM12549" />
              </div>
              <div className="form-group">
                <label>HSN Code</label>
                <input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} placeholder="4010" />
              </div>
              <div className="form-group">
                <label>Measuring Unit</label>
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value.toUpperCase() })} placeholder="PCS / SQFT / FT" />
              </div>
              <div className="form-group">
                <label>Default Size</label>
                <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="A4 / 10x4 ft / custom" />
              </div>
              <div className="form-group">
                <label>Sales Price</label>
                <input type="number" min={0} step="0.01" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>GST Tax Rate (%)</label>
                <input type="number" min={0} step="0.01" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} placeholder="0 / 5 / 12 / 18" />
              </div>
              <div className="form-group">
                <label>Purchase Price</label>
                <input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Opening Stock</label>
                <input type="number" step="0.01" value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: e.target.value })} />
              </div>
              <div className="form-group">
                <label>As of Date</label>
                <input type="date" value={form.stockAsOf} onChange={(e) => setForm({ ...form, stockAsOf: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description or notes" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <div className="toggle-wrap" onClick={() => setForm({ ...form, active: !form.active })}>
                  <button className={`toggle ${form.active ? "on" : ""}`} />
                  <span className="toggle-label">{form.active ? "Active" : "Archived"}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
