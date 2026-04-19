"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import {
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  Smartphone,
  Monitor,
  X,
  Check,
  Loader2,
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  type: string;
  features: string[];
  popular: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProductIdx, setEditProductIdx] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductItem>({
    id: "", name: "", description: "", price: 0, duration: 30, type: "mobile", features: [], popular: false,
  });
  const [featureInput, setFeatureInput] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const json = await res.json();
      setProducts(json.products || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingProducts(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function openAddProduct() {
    setEditProductIdx(null);
    setProductForm({ id: "", name: "", description: "", price: 0, duration: 30, type: "mobile", features: [], popular: false });
    setFeatureInput("");
    setShowProductForm(true);
  }

  function openEditProduct(idx: number) {
    setEditProductIdx(idx);
    setProductForm({ ...products[idx] });
    setFeatureInput("");
    setShowProductForm(true);
  }

  function addFeature() {
    if (!featureInput.trim()) return;
    setProductForm(p => ({ ...p, features: [...p.features, featureInput.trim()] }));
    setFeatureInput("");
  }

  function removeFeature(i: number) {
    setProductForm(p => ({ ...p, features: p.features.filter((_, idx) => idx !== i) }));
  }

  async function handleSaveProduct() {
    if (!productForm.name || !productForm.price || !productForm.id) return;
    setSavingProduct(true);
    const updated = [...products];
    if (editProductIdx !== null) {
      updated[editProductIdx] = productForm;
    } else {
      updated.push(productForm);
    }
    
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: JSON.stringify(updated) }),
      });
      setProducts(updated);
      setShowProductForm(false);
      setEditProductIdx(null);
    } catch (e) {
      console.error(e);
    }
    setSavingProduct(false);
  }

  async function handleDeleteProduct(idx: number) {
    const updated = products.filter((_, i) => i !== idx);
    setSavingProduct(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: JSON.stringify(updated) }),
      });
      setProducts(updated);
    } catch (e) {
      console.error(e);
    }
    setSavingProduct(false);
  }

  return (
    <>
      <Topbar title="Kelola Produk" subtitle="Manajemen katalog produk dan pengaturan harga" />

      <div className="px-4 md:px-8 pb-8 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Katalog Produk</h2>
              <p className="text-xs text-[var(--text-muted)]">Atur produk yang akan tampil di marketplace</p>
            </div>
            <button onClick={openAddProduct} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", border: "none", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
              <Plus size={16} /> Tambah Produk
            </button>
          </div>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-[#818cf8]" /></div>
          ) : products.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <ShoppingBag size={40} className="mx-auto text-[var(--text-muted)] mb-3 opacity-30" />
              <p className="text-sm text-[var(--text-muted)]">Belum ada produk. Klik &quot;Tambah Produk&quot; untuk mulai.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p, idx) => {
                const isMobile = p.type === "mobile";
                const ac = isMobile ? "#22c55e" : "#3b82f6";
                return (
                  <div key={p.id} className="glass-card p-4 transition-all relative group" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="absolute top-2 right-2 flex gap-1 transition-opacity">
                      <button onClick={() => openEditProduct(idx)} className="btn-icon" style={{ width: 26, height: 26 }}><Pencil size={11} /></button>
                      <button onClick={() => handleDeleteProduct(idx)} className="btn-icon hover:text-rose-400" style={{ width: 26, height: 26 }}><Trash2 size={11} /></button>
                    </div>
                    {p.popular && <span className="absolute -top-2 left-3 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", boxShadow: "0 2px 8px rgba(99,102,241,0.4)" }}>Best Seller</span>}
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>{p.id}</span>
                    <div className="flex items-center gap-2 mt-2 mb-1 pr-12">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${ac}15` }}>
                        {isMobile ? <Smartphone size={15} style={{ color: ac }} /> : <Monitor size={15} style={{ color: ac }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{p.duration} hari</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold mt-1" style={{ color: ac }}>{formatCurrency(p.price)}</p>
                    
                    <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${ac}15` }}>
                        <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">{p.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showProductForm && (
          <div className="modal-overlay" onClick={() => setShowProductForm(false)}>
            <div className="modal-content" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="font-semibold text-white text-lg">{editProductIdx !== null ? "Edit Produk" : "Tambah Produk Baru"}</h3>
                <button className="btn-icon" onClick={() => setShowProductForm(false)}><X size={18} /></button>
              </div>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="form-label">Kode SKU</label><input type="text" className="form-input font-mono uppercase" value={productForm.id} onChange={e => setProductForm(p => ({ ...p, id: e.target.value.toUpperCase().replace(/\s+/g, '-') }))} placeholder="CPM-30" /><p className="text-[10px] text-[var(--text-muted)] mt-1">Contoh: CPM-30, CPD-90</p></div>
                  <div><label className="form-label">Harga (Rp)</label><input type="number" className="form-input" value={productForm.price || ""} onChange={e => setProductForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} placeholder="15000" /></div>
                </div>
                <div><label className="form-label">Nama Produk</label><input type="text" className="form-input" value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} placeholder="CapCut Pro Mobile" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Tipe Produk</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setProductForm(p => ({ ...p, type: "mobile" }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${productForm.type === "mobile" ? "border-green-500 bg-green-500/15 text-green-400" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)]"}`}><Smartphone size={14} /> Mobile</button>
                      <button type="button" onClick={() => setProductForm(p => ({ ...p, type: "desktop" }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${productForm.type === "desktop" ? "border-blue-500 bg-blue-500/15 text-blue-400" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)]"}`}><Monitor size={14} /> Desktop</button>
                    </div>
                  </div>
                  <div><label className="form-label">Durasi (Hari)</label><select className="form-input" value={productForm.duration} onChange={e => setProductForm(p => ({ ...p, duration: parseInt(e.target.value) }))}><option value="30">30 Hari</option><option value="60">60 Hari</option><option value="90">90 Hari</option><option value="180">180 Hari</option><option value="365">365 Hari</option></select></div>
                </div>
                <div><label className="form-label">Deskripsi / Copywriting</label><textarea className="form-input" rows={2} value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} placeholder="Akses semua fitur premium CapCut di HP selama 30 hari" /></div>
                <div>
                  <label className="form-label">Fitur Unggulan</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {productForm.features.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>{f}<button onClick={() => removeFeature(i)} style={{ cursor: "pointer" }}><X size={10} /></button></span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" className="form-input flex-1" value={featureInput} onChange={e => setFeatureInput(e.target.value)} placeholder="Export tanpa watermark..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }} />
                    <button onClick={addFeature} className="btn-secondary" style={{ height: 40 }}><Plus size={14} /></button>
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-xl transition-all" style={{ background: productForm.popular ? "rgba(99,102,241,0.08)" : "transparent", border: `1px solid ${productForm.popular ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                  <input type="checkbox" checked={productForm.popular} onChange={e => setProductForm(p => ({ ...p, popular: e.target.checked }))} style={{ accentColor: "#6366f1" }} />
                  <div><span className="text-sm font-medium text-white">Tandai sebagai Best Seller</span><p className="text-[10px] text-[var(--text-muted)]">Produk ditampilkan paling menonjol di marketplace</p></div>
                </label>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowProductForm(false)}>Batal</button>
                <button className="btn-primary" onClick={handleSaveProduct} disabled={savingProduct || !productForm.name || !productForm.price || !productForm.id}>{savingProduct ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {editProductIdx !== null ? "Update Produk" : "Simpan Produk"}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
